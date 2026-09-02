"""Read clean grant rows from the team's Google Sheet.

The Google service account only needs Viewer access to the sheet. Configure
``GOOGLE_SHEET_ID`` plus either ``GOOGLE_SERVICE_ACCOUNT_JSON`` (the complete
service-account JSON object) or ``GOOGLE_SERVICE_ACCOUNT_FILE`` (a local path)
in the root ``.env`` file. Never commit either secret.
"""

import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly"
DEFAULT_TAB_NAME = os.getenv("GOOGLE_SHEET_TAB", "Grants")


class GoogleSheetsConfigurationError(RuntimeError):
    """Raised when Google Sheets credentials or the sheet ID are missing."""


class GoogleSheetsReadError(RuntimeError):
    """Raised when Google Sheets cannot return a usable Grants tab."""


def _get_credentials() -> Credentials:
    """Create service-account credentials from the configured local secret."""

    raw_credentials = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    credentials_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")

    if raw_credentials:
        try:
            info = json.loads(raw_credentials)
        except json.JSONDecodeError as error:
            raise GoogleSheetsConfigurationError(
                "GOOGLE_SERVICE_ACCOUNT_JSON must contain valid JSON."
            ) from error
        return Credentials.from_service_account_info(info, scopes=[SHEETS_READONLY_SCOPE])

    if credentials_file:
        credentials_path = Path(credentials_file).expanduser()
        if not credentials_path.is_absolute():
            credentials_path = PROJECT_ROOT / credentials_path
        if not credentials_path.is_file():
            raise GoogleSheetsConfigurationError(
                "GOOGLE_SERVICE_ACCOUNT_FILE does not point to a readable file."
            )
        return Credentials.from_service_account_file(
            credentials_path, scopes=[SHEETS_READONLY_SCOPE]
        )

    raise GoogleSheetsConfigurationError(
        "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE in .env."
    )


def _normalise_header(value: str) -> str:
    """Convert a sheet heading into a predictable dictionary key."""

    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def _clean_cell(value: Any) -> str:
    """Return a spreadsheet value as a trimmed string for later validation."""

    return str(value).strip() if value is not None else ""


def _rows_to_records(values: list[list[Any]]) -> list[dict[str, str]]:
    """Turn a header row and data rows into clean dictionaries.

    Blank rows are ignored. Headers become snake_case, so later report code
    does not depend on whitespace or capitalization in the Sheet.
    """

    if not values:
        return []

    headers = [_normalise_header(_clean_cell(cell)) for cell in values[0]]
    if not any(headers):
        raise GoogleSheetsReadError("The Grants tab needs a non-empty header row.")
    if any(not header for header in headers):
        raise GoogleSheetsReadError("The Grants tab header row cannot contain blank cells.")
    if len(headers) != len(set(headers)):
        raise GoogleSheetsReadError(
            "The Grants tab has duplicate headers after normalising their names."
        )

    records: list[dict[str, str]] = []
    for row in values[1:]:
        cells = [_clean_cell(cell) for cell in row]
        if not any(cells):
            continue
        records.append(
            {header: cells[index] if index < len(cells) else "" for index, header in enumerate(headers)}
        )
    return records


def fetch_grant_rows(tab_name: str = DEFAULT_TAB_NAME) -> list[dict[str, str]]:
    """Fetch all populated rows from the Google Sheet's Grants tab.

    The future API route will cache successful reads through ``supabase_service``
    and can fall back to that cache if Google Sheets is unavailable.
    """

    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if not sheet_id:
        raise GoogleSheetsConfigurationError("GOOGLE_SHEET_ID must be set in .env.")
    if not tab_name.strip():
        raise ValueError("tab_name cannot be blank.")

    try:
        service = build("sheets", "v4", credentials=_get_credentials(), cache_discovery=False)
        response = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=sheet_id, range=f"{tab_name}!A:ZZ")
            .execute()
        )
    except HttpError as error:
        raise GoogleSheetsReadError("Google Sheets could not read the Grants tab.") from error
    except (OSError, ValueError) as error:
        raise GoogleSheetsConfigurationError("Google service-account credentials are invalid.") from error

    return _rows_to_records(response.get("values", []))
