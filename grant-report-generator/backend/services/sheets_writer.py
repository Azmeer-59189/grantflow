"""Write grant rows to the team's Google Sheet.

Columns are matched by their header names, never by position, so adding or
moving a column in the Sheet cannot shift values into the wrong cells. Only
the columns GrantFlow owns are written; any extra columns are left untouched.
"""

import json
import os
from pathlib import Path

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import PROJECT_ROOT
from services.data_processor import row_version
from services.sheets_reader import (
    GoogleSheetsReadError,
    _normalise_header,
    parse_headers,
    row_record,
)


SHEETS_WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets"

# Every column GrantFlow writes. The Sheet may order them however it likes.
COLUMN_ORDER = [
    "Year", "Country", "Chapter", "Grant Number", "Project Type", "Department",
    "Supplier", "Item", "PO / WO Number", "Sub Grant No.",
    "Link to Complete Documents",
    "Secondary Currency", "Total Grant Amount (orig)",
    "Total Grant Amount (USD)", "Sub Grant Amount",
    "Current Payment (orig)", "Current Payment (USD)",
    "Remaining Payment (orig)", "Remaining Payment (USD)",
    "Payment Status", "Payment Reference",
    "Grant Receiving Date", "Grant Application Sent Date",
    "Date Dr. Zafar Signed Application",
    "Date of Approval by Khaleeq Sb",
    "Date of Email to Int. Chapter", "Payment Date",
    "Date CEO Signed Application",
    "Shipping Documents Status", "Shipping Documents Comment",
    "Link to Shipping Documents",
    "Commercial Invoice No.", "Bill of Lading",
    "Packing List Reference", "GRN / Receiving Status",
    "Receiving Date", "GRN Number", "Link to GRN",
    "GRN / Receiving Comments", "Installation Date",
    "Location", "Building Name", "Floor", "Room",
    "Item Model", "Item Serial Number", "Quantity",
    "IHHN Asset Tag Number", "Department for Pictures",
    "Picture", "Pictures' Status",
    "No. of Beneficiaries", "Report Status",
    "Link to Utilization Report", "Item Description",
]
REQUIRED_KEYS = {_normalise_header(label): label for label in COLUMN_ORDER}
# Written only when the Sheet has a matching column.
OPTIONAL_KEYS = {"region", "exchange_rate"}
DEFAULT_TAB_NAME = os.getenv("GOOGLE_SHEET_TAB", "Grants")


class GoogleSheetsWriteError(RuntimeError):
    """Raised when writing to Google Sheets fails."""


class GoogleSheetsConfigurationError(RuntimeError):
    """Raised when credentials or sheet ID are missing."""


class WriteRejectedError(GoogleSheetsWriteError):
    """Raised before anything is written, when the write would be unsafe."""


class DuplicateGrantError(WriteRejectedError):
    """The grant number already exists in the Sheet."""


class GrantConflictError(WriteRejectedError):
    """The row changed after the editor loaded it."""


def _get_write_credentials() -> Credentials:
    raw_credentials = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    credentials_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")

    if raw_credentials:
        try:
            info = json.loads(raw_credentials)
        except json.JSONDecodeError as error:
            raise GoogleSheetsConfigurationError(
                "GOOGLE_SERVICE_ACCOUNT_JSON must contain valid JSON."
            ) from error
        return Credentials.from_service_account_info(
            info, scopes=[SHEETS_WRITE_SCOPE]
        )

    if credentials_file:
        credentials_path = Path(credentials_file).expanduser()
        if not credentials_path.is_absolute():
            credentials_path = PROJECT_ROOT / credentials_path
        if not credentials_path.is_file():
            raise GoogleSheetsConfigurationError(
                "GOOGLE_SERVICE_ACCOUNT_FILE does not point to a readable file."
            )
        return Credentials.from_service_account_file(
            credentials_path, scopes=[SHEETS_WRITE_SCOPE]
        )

    raise GoogleSheetsConfigurationError(
        "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE in .env."
    )


def _values_api():
    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if not sheet_id:
        raise GoogleSheetsConfigurationError("GOOGLE_SHEET_ID must be set in .env.")
    service = build("sheets", "v4", credentials=_get_write_credentials(), cache_discovery=False)
    return service.spreadsheets().values(), sheet_id


def _column_letter(index: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA."""
    letters = ""
    index += 1
    while index:
        index, remainder = divmod(index - 1, 26)
        letters = chr(ord("A") + remainder) + letters
    return letters


def _read_tab(values_api, sheet_id: str, tab_name: str) -> tuple[list[str], list[list]]:
    """Return normalised headers and all rows, refusing an unexpected layout."""
    response = values_api.get(spreadsheetId=sheet_id, range=f"{tab_name}!A:ZZ").execute()
    rows = response.get("values", [])
    if not rows:
        raise WriteRejectedError("The Grants tab has no header row. No changes were written.")
    try:
        headers = parse_headers(rows[0])
    except GoogleSheetsReadError as error:
        raise WriteRejectedError(f"{error} No changes were written.") from error
    missing = [label for key, label in REQUIRED_KEYS.items() if key not in headers]
    if missing:
        raise WriteRejectedError(
            f"The Grants tab is missing these columns: {', '.join(missing)}. "
            "No changes were written."
        )
    return headers, rows


def _cell(value):
    return "" if value is None else value


def _owned_columns(headers: list[str], grant: dict) -> list[int]:
    return [index for index, key in enumerate(headers)
            if key in grant and (key in REQUIRED_KEYS or key in OPTIONAL_KEYS)]


def _matching_rows(headers: list[str], rows: list[list], grant_number: str) -> list[int]:
    """0-based indexes into ``rows`` (header excluded) for a grant number."""
    key_index = headers.index("grant_number")
    wanted = grant_number.strip()
    return [index for index, row in enumerate(rows) if index > 0
            and len(row) > key_index and str(row[key_index]).strip() == wanted]


def append_grant(grant: dict, tab_name: str = DEFAULT_TAB_NAME) -> None:
    """Add a new grant as a new row at the bottom of the sheet."""
    values_api, sheet_id = _values_api()
    try:
        headers, rows = _read_tab(values_api, sheet_id, tab_name)
        if _matching_rows(headers, rows, grant["grant_number"]):
            raise DuplicateGrantError(
                f"Grant number '{grant['grant_number']}' already exists. No changes were written."
            )
        row_values = [""] * len(headers)
        for index in _owned_columns(headers, grant):
            row_values[index] = _cell(grant[headers[index]])
        values_api.append(
            spreadsheetId=sheet_id,
            range=f"{tab_name}!A:{_column_letter(len(headers) - 1)}",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [row_values]},
        ).execute()
    except HttpError as error:
        raise GoogleSheetsWriteError(f"Could not append grant to sheet: {error}") from error


def update_grant(
    grant_number: str,
    grant: dict,
    tab_name: str = DEFAULT_TAB_NAME,
    expected_version: str | None = None,
) -> None:
    """Update an existing grant's row, writing only GrantFlow's columns.

    When ``expected_version`` is given, the write is refused if the row no
    longer matches what the editor loaded.
    """
    values_api, sheet_id = _values_api()
    try:
        headers, rows = _read_tab(values_api, sheet_id, tab_name)
        matches = _matching_rows(headers, rows, grant_number)
        if not matches:
            raise GoogleSheetsWriteError(f"Grant Number '{grant_number}' not found in sheet.")
        if len(matches) > 1:
            raise WriteRejectedError(
                f"Grant number '{grant_number}' appears in rows "
                f"{', '.join(str(index + 1) for index in matches)}. "
                "Remove the duplicate in the Sheet before editing. No changes were written."
            )
        index = matches[0]
        if expected_version is not None and row_version(row_record(headers, rows[index])) != expected_version:
            raise GrantConflictError(
                "Someone else changed this grant after you opened it. "
                "Reload to see their changes, then apply yours again. No changes were written."
            )

        # Contiguous runs of owned columns become one range each, so extra
        # columns (formulas, notes) in between are never overwritten.
        sheet_row = index + 1
        data, run = [], []
        for column in _owned_columns(headers, grant) + [None]:
            if run and (column is None or column != run[-1] + 1):
                data.append({
                    "range": f"{tab_name}!{_column_letter(run[0])}{sheet_row}:{_column_letter(run[-1])}{sheet_row}",
                    "values": [[_cell(grant[headers[c]]) for c in run]],
                })
                run = []
            if column is not None:
                run.append(column)
        values_api.batchUpdate(
            spreadsheetId=sheet_id,
            body={"valueInputOption": "RAW", "data": data},
        ).execute()
    except HttpError as error:
        raise GoogleSheetsWriteError(f"Could not update grant in sheet: {error}") from error


def check_grant_number_exists(grant_number: str, tab_name: str = DEFAULT_TAB_NAME) -> bool:
    """Check if a Grant Number already exists, before an audit entry is created."""
    values_api, sheet_id = _values_api()
    try:
        headers, rows = _read_tab(values_api, sheet_id, tab_name)
    except HttpError as error:
        raise GoogleSheetsWriteError(f"Could not check grant number: {error}") from error
    return bool(_matching_rows(headers, rows, grant_number))
