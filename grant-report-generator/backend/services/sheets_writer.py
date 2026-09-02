"""Write grant rows to the team's Google Sheet — 50 column structure."""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

SHEETS_WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets"

# Column order must match sheet exactly — 50 columns
COLUMN_ORDER = [
    "Region", "Grant Number", "Project Type", "Department", "Supplier",
    "Item", "PO / WO Number", "Sub Grant No.", "Currency",
    "Total Grant Amount (orig)", "Total Grant Amount (USD)", "Sub Grant Amount",
    "Current Payment (orig)", "Current Payment (USD)", "Remaining Payment",
    "Payment Status", "Payment Reference", "Grant Receiving Date",
    "Grant Application Sent Date", "Date Dr. Zafar Signed Application",
    "Date of Approval by Khaleeq Sb", "Date of Email to Int. Chapter",
    "Payment Date", "Shipping Documents Status", "Shipping Documents Comment",
    "Link to Shipping Documents", "Link to Complete Documents",
    "Commercial Invoice No.", "Bill of Lading", "Packing List Reference",
    "GRN / Receiving Status", "Receiving Date", "GRN Number", "Link to GRN",
    "GRN / Receiving Comments", "Installation Date", "Location",
    "Building Name", "Floor", "Room", "Item Model", "Item Serial Number",
    "Quantity", "IHHN Asset Tag Number", "Pictures' Status", "Pictures",
    "POC for Pictures", "No. of Beneficiaries", "Report Status",
    "Link to Utilization Report", "Item Description",
]

# Last column letter for 50 columns = AX
LAST_COLUMN = "AX"

DEFAULT_TAB_NAME = os.getenv("GOOGLE_SHEET_TAB", "Grants")


class GoogleSheetsWriteError(RuntimeError):
    """Raised when writing to Google Sheets fails."""


class GoogleSheetsConfigurationError(RuntimeError):
    """Raised when credentials or sheet ID are missing."""


def _get_write_credentials() -> Credentials:
    """Create service-account credentials with write access."""
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


def _grant_to_row(grant: dict) -> list:
    """Convert grant dictionary to flat list matching 50 column order."""
    return [
        grant.get("region", ""),
        grant.get("grant_number", ""),
        grant.get("project_type", ""),
        grant.get("department", ""),
        grant.get("supplier", ""),
        grant.get("item", ""),
        grant.get("po_wo_number", ""),
        grant.get("sub_grant_no", ""),
        grant.get("currency", ""),
        grant.get("total_grant_amount_orig", ""),
        grant.get("total_grant_amount_usd", ""),
        grant.get("sub_grant_amount", ""),
        grant.get("current_payment_orig", ""),
        grant.get("current_payment_usd", ""),
        grant.get("remaining_payment", ""),
        grant.get("payment_status", "Pending"),
        grant.get("payment_reference", ""),
        grant.get("grant_receiving_date", ""),
        grant.get("grant_application_sent_date", ""),
        grant.get("date_dr_zafar_signed_application", ""),
        grant.get("date_of_approval_by_khaleeq_sb", ""),
        grant.get("date_of_email_to_int_chapter", ""),
        grant.get("payment_date", ""),
        grant.get("shipping_documents_status", ""),
        grant.get("shipping_documents_comment", ""),
        grant.get("link_to_shipping_documents", ""),
        grant.get("link_to_complete_documents", ""),
        grant.get("commercial_invoice_no", ""),
        grant.get("bill_of_lading", ""),
        grant.get("packing_list_reference", ""),
        grant.get("grn_receiving_status", ""),
        grant.get("receiving_date", ""),
        grant.get("grn_number", ""),
        grant.get("link_to_grn", ""),
        grant.get("grn_receiving_comments", ""),
        grant.get("installation_date", ""),
        grant.get("location", ""),
        grant.get("building_name", ""),
        grant.get("floor", ""),
        grant.get("room", ""),
        grant.get("item_model", ""),
        grant.get("item_serial_number", ""),
        grant.get("quantity", ""),
        grant.get("ihhn_asset_tag_number", ""),
        grant.get("pictures_status", ""),
        grant.get("pictures", ""),
        grant.get("poc_for_pictures", ""),
        grant.get("no_of_beneficiaries", ""),
        grant.get("report_status", "Pending"),
        grant.get("link_to_utilization_report", ""),
        grant.get("item_description", ""),
    ]


def append_grant(grant: dict, tab_name: str = DEFAULT_TAB_NAME) -> None:
    """Add a new grant as a new row at the bottom of the sheet."""
    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if not sheet_id:
        raise GoogleSheetsConfigurationError("GOOGLE_SHEET_ID must be set in .env.")

    row_values = _grant_to_row(grant)

    try:
        service = build(
            "sheets", "v4",
            credentials=_get_write_credentials(),
            cache_discovery=False
        )
        service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range=f"{tab_name}!A:{LAST_COLUMN}",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": [row_values]}
        ).execute()

    except HttpError as error:
        raise GoogleSheetsWriteError(
            f"Could not append grant to sheet: {error}"
        ) from error


def update_grant(
    grant_number: str,
    grant: dict,
    tab_name: str = DEFAULT_TAB_NAME
) -> None:
    """Find an existing grant by Grant Number and update its row."""
    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if not sheet_id:
        raise GoogleSheetsConfigurationError("GOOGLE_SHEET_ID must be set in .env.")

    try:
        service = build(
            "sheets", "v4",
            credentials=_get_write_credentials(),
            cache_discovery=False
        )

        # Read column B (Grant Number is column B now — region is A)
        response = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=f"{tab_name}!B:B"
        ).execute()

        all_grant_numbers = response.get("values", [])
        row_index = None

        for index, row in enumerate(all_grant_numbers):
            if index == 0:
                continue
            if row and row[0].strip() == grant_number.strip():
                row_index = index + 1
                break

        if row_index is None:
            raise GoogleSheetsWriteError(
                f"Grant Number '{grant_number}' not found in sheet."
            )

        row_values = _grant_to_row(grant)

        service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range=f"{tab_name}!A{row_index}:{LAST_COLUMN}{row_index}",
            valueInputOption="USER_ENTERED",
            body={"values": [row_values]}
        ).execute()

    except HttpError as error:
        raise GoogleSheetsWriteError(
            f"Could not update grant in sheet: {error}"
        ) from error


def check_grant_number_exists(
    grant_number: str,
    tab_name: str = DEFAULT_TAB_NAME
) -> bool:
    """Check if a Grant Number already exists — prevents duplicates."""
    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if not sheet_id:
        raise GoogleSheetsConfigurationError("GOOGLE_SHEET_ID must be set in .env.")

    try:
        service = build(
            "sheets", "v4",
            credentials=_get_write_credentials(),
            cache_discovery=False
        )

        # Grant Number is now column B
        response = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=f"{tab_name}!B:B"
        ).execute()

        all_values = response.get("values", [])

        for index, row in enumerate(all_values):
            if index == 0:
                continue
            if row and row[0].strip() == grant_number.strip():
                return True

        return False

    except HttpError as error:
        raise GoogleSheetsWriteError(
            f"Could not check grant number: {error}"
        ) from error