"""Validate grant rows, auto-calculate report status, and compute KPIs."""

from __future__ import annotations
from dataclasses import asdict, dataclass, fields
import hashlib
import json
import math
import re
from typing import Any

# Required fields for report status calculation
# If any of these are empty → Incomplete Information
# If all filled but link_to_utilization_report empty → Pending
# If all filled including link_to_utilization_report → Complete
REQUIRED_FOR_STATUS = {
    "country", "chapter", "grant_number", "project_type", "department",
    "supplier", "item", "po_wo_number", "sub_grant_no",
    "link_to_complete_documents", "secondary_currency",
    "total_grant_amount_orig", "total_grant_amount_usd",
    "current_payment_orig", "current_payment_usd",
    "remaining_payment_orig", "remaining_payment_usd",
    "payment_status", "payment_reference",
    "grant_receiving_date", "grant_application_sent_date",
    "date_dr_zafar_signed_application", "date_of_approval_by_khaleeq_sb",
    "date_of_email_to_int_chapter", "payment_date",
    "date_ceo_signed_application",
    "shipping_documents_status", "shipping_documents_comment",
    "link_to_shipping_documents", "commercial_invoice_no",
    "bill_of_lading", "packing_list_reference",
    "grn_receiving_status", "receiving_date", "grn_number",
    "link_to_grn", "grn_receiving_comments", "installation_date",
    "location", "building_name", "floor", "room",
    "item_model", "item_serial_number", "quantity",
    "ihhn_asset_tag_number", "department_for_pictures",
    "picture", "pictures_status", "no_of_beneficiaries",
    "item_description",
}

# Valid dropdown values
VALID_COUNTRIES = {
    "United States", "Canada", "United Kingdom",
    "Germany", "Switzerland", "UAE"
}
VALID_PROJECT_TYPES = {"Expansion", "Non-Expansion"}

# Chapters that run only one kind of project. A chapter not listed allows both.
CHAPTER_PROJECT_TYPES = {
    "IHN UK": {"Expansion"},
}
VALID_CHAPTERS = {
    "FOIHUS", "IDF", "TIH UAE", "IHN UK",
    "FOIH Germany", "FOIH Switzerland"
}
VALID_SECONDARY_CURRENCIES = {"CAD", "EUR", "AED", "AUD", "GBP", ""}
VALID_PAYMENT_STATUS = {"Pending", "Partial", "Complete"}
VALID_SHIPPING_STATUS = {
    "Not received", "Received", "Received with discrepancy",
    "Received with comments", "Partial shipment documents",
    "Not required", "Not applicable", ""
}
VALID_GRN_STATUS = {
    "Not received", "Received",
    "Received with comments", "Not required", ""
}
VALID_PICTURES_STATUS = {"Yes", "No", "Consumable", "Not applicable", ""}


class GrantDataValidationError(ValueError):
    """Raised when a row has missing or invalid data."""


# Zero means "not entered" for these: every grant has a value, an item and
# people it serves. Other amounts (e.g. remaining payment) can genuinely be 0.
NONZERO_FOR_STATUS = {
    "total_grant_amount_orig", "total_grant_amount_usd",
    "quantity", "no_of_beneficiaries",
}

NUMBER_LABELS = {
    "total_grant_amount_orig": "Total Grant Amount (orig)",
    "total_grant_amount_usd": "Total Grant Amount (USD)",
    "sub_grant_amount": "Sub Grant Amount",
    "current_payment_orig": "Current Payment (orig)",
    "current_payment_usd": "Current Payment (USD)",
    "remaining_payment_orig": "Remaining Payment (orig)",
    "remaining_payment_usd": "Remaining Payment (USD)",
    "quantity": "Quantity",
    "no_of_beneficiaries": "No. of Beneficiaries",
    "exchange_rate": "Exchange Rate",
}


def _parse_number(value, field_name: str, row_number: int) -> float | None:
    """Parse a number from a sheet cell. Blank cells stay blank (None)."""
    if value is None or not str(value).strip():
        return None
    cleaned = re.sub(r"\b(?:USD|CAD|EUR|AED|AUD|GBP|PKR)\b", "", str(value), flags=re.IGNORECASE)
    cleaned = re.sub(r"[\s,$£€]", "", cleaned)
    try:
        result = float(cleaned)
        if not math.isfinite(result):
            raise ValueError("Non-finite number")
    except ValueError as error:
        raise GrantDataValidationError(
            f"Row {row_number}: {field_name} must be a number."
        ) from error
    return result


def _is_filled(field: str, value) -> bool:
    if value is None or not str(value).strip():
        return False
    if field in NONZERO_FOR_STATUS:
        try:
            return _parse_number(value, field, 0) != 0
        except GrantDataValidationError:
            return True  # Present but invalid; reported as a row error instead.
    return True


def calculate_report_status(row: dict) -> str:
    """Calculate report status from filled fields.

    Complete: all fields filled including link_to_utilization_report
    Pending: all fields filled except link_to_utilization_report
    Incomplete Information: any required field is empty
    """
    if not all(_is_filled(field, row.get(field)) for field in REQUIRED_FOR_STATUS):
        return "Incomplete Information"
    if _is_filled("link_to_utilization_report", row.get("link_to_utilization_report")):
        return "Complete"
    return "Pending"


def row_version(row: dict) -> str:
    """Fingerprint of a raw sheet row, used to detect edits made by someone else."""
    encoded = json.dumps(sorted((str(k), str(v)) for k, v in row.items()), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:20]


@dataclass(frozen=True)
class GrantRecord:
    """Represents one grant row from the sheet."""
    year: str
    country: str
    chapter: str
    grant_number: str
    project_type: str
    department: str
    supplier: str
    item: str
    po_wo_number: str
    sub_grant_no: str
    link_to_complete_documents: str
    secondary_currency: str
    total_grant_amount_orig: float | None
    total_grant_amount_usd: float | None
    sub_grant_amount: float | None
    current_payment_orig: float | None
    current_payment_usd: float | None
    remaining_payment_orig: float | None
    remaining_payment_usd: float | None
    payment_status: str
    payment_reference: str
    grant_receiving_date: str
    grant_application_sent_date: str
    date_dr_zafar_signed_application: str
    date_of_approval_by_khaleeq_sb: str
    date_of_email_to_int_chapter: str
    payment_date: str
    date_ceo_signed_application: str
    shipping_documents_status: str
    shipping_documents_comment: str
    link_to_shipping_documents: str
    commercial_invoice_no: str
    bill_of_lading: str
    packing_list_reference: str
    grn_receiving_status: str
    receiving_date: str
    grn_number: str
    link_to_grn: str
    grn_receiving_comments: str
    installation_date: str
    location: str
    building_name: str
    floor: str
    room: str
    item_model: str
    item_serial_number: str
    quantity: float | None
    ihhn_asset_tag_number: str
    department_for_pictures: str
    picture: str
    pictures_status: str
    no_of_beneficiaries: float | None
    report_status: str
    link_to_utilization_report: str
    item_description: str
    version: str = ""
    exchange_rate: float | None = None  # optional Sheet column

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class GrantSummary:
    """Dashboard KPI calculations from all grant rows."""
    grants: tuple[GrantRecord, ...]
    total_grants: int
    total_paid_usd: float
    pending_reports: int
    shipping_issues: int
    total_grant_value_usd: float
    row_errors: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return {
            "grants": [g.as_dict() for g in self.grants],
            "total_grants": self.total_grants,
            "total_paid_usd": self.total_paid_usd,
            "total_grant_value_usd": self.total_grant_value_usd,
            "pending_reports": self.pending_reports,
            "shipping_issues": self.shipping_issues,
            "row_errors": list(self.row_errors),
        }


def validate_grant_dict(grant: dict, is_new: bool = True) -> None:
    """Validate a grant dictionary before writing to sheet."""
    # Required fields
    for field in ["country", "grant_number", "supplier", "item"]:
        if not str(grant.get(field, "")).strip():
            label = field.replace("_", " ").title()
            raise GrantDataValidationError(f"{label} is required.")

    # Year (optional, but must be a 4-digit year if given)
    year = str(grant.get("year", "")).strip()
    if year and not re.fullmatch(r"20\d{2}", year):
        raise GrantDataValidationError("Year must be a 4-digit year, e.g. 2025.")

    # Chapter and Project Type decide which report template is used
    chapter = str(grant.get("chapter", "")).strip()
    project_type = str(grant.get("project_type", "")).strip()

    if chapter not in VALID_CHAPTERS:
        raise GrantDataValidationError(
            f"Chapter is required. Choose one of: {', '.join(sorted(VALID_CHAPTERS))}"
        )
    if project_type not in VALID_PROJECT_TYPES:
        raise GrantDataValidationError(
            "Project Type is required: choose Expansion or Non-Expansion."
        )
    allowed = CHAPTER_PROJECT_TYPES.get(chapter)
    if allowed and project_type not in allowed:
        raise GrantDataValidationError(
            f"{chapter} grants can only be: {', '.join(sorted(allowed))}."
        )

    rate = grant.get("exchange_rate")
    if rate is not None and not rate > 0:
        raise GrantDataValidationError("Exchange rate must be greater than 0.")

    # Dropdown values
    if grant.get("country") not in VALID_COUNTRIES:
        raise GrantDataValidationError(
            f"Country must be one of: {', '.join(sorted(VALID_COUNTRIES))}"
        )
    if grant.get("payment_status") not in VALID_PAYMENT_STATUS:
        raise GrantDataValidationError(
            f"Payment Status must be one of: {', '.join(VALID_PAYMENT_STATUS)}"
        )

def process_grant_rows(rows: list[dict[str, str]]) -> GrantSummary:
    """Process all grant rows from the sheet into a GrantSummary.

    Bad cells never hide the whole dashboard: an unreadable number is shown as
    blank and described in ``row_errors`` so someone can fix the Sheet.
    """
    grants: list[GrantRecord] = []
    row_errors: list[str] = []
    first_row: dict[str, int] = {}

    for row_number, row in enumerate(rows, start=2):
        grant_number = str(row.get("grant_number", "")).strip()
        if not grant_number:
            continue
        if grant_number in first_row:
            row_errors.append(
                f"Row {row_number}: grant number '{grant_number}' already appears in row "
                f"{first_row[grant_number]}. GrantFlow shows row {first_row[grant_number]} only."
            )
            continue
        first_row[grant_number] = row_number

        values: dict[str, Any] = {}
        for field in fields(GrantRecord):
            name = field.name
            if name in ("report_status", "version"):
                continue
            if name in NUMBER_LABELS:
                try:
                    values[name] = _parse_number(row.get(name), NUMBER_LABELS[name], row_number)
                except GrantDataValidationError:
                    values[name] = None
                    row_errors.append(
                        f"Row {row_number} ({grant_number}): {NUMBER_LABELS[name]} "
                        f"'{row.get(name)}' is not a number, so it is shown as blank."
                    )
            else:
                default = "Pending" if name == "payment_status" else ""
                values[name] = str(row.get(name, default) or "").strip()

        grants.append(GrantRecord(
            **values,
            report_status=calculate_report_status(row),
            version=row_version(row),
        ))

    # Calculate KPIs
    total_paid_usd = sum(
        g.current_payment_usd or 0 for g in grants
        if g.payment_status == "Complete"
    )
    total_grant_value_usd = sum(g.total_grant_amount_usd or 0 for g in grants)
    pending_reports = sum(
        1 for g in grants
        if g.report_status in ("Pending", "Incomplete Information")
    )
    shipping_issues = sum(
        1 for g in grants
        if "discrepancy" in g.shipping_documents_status.lower()
    )

    return GrantSummary(
        grants=tuple(grants),
        total_grants=len(grants),
        total_paid_usd=total_paid_usd,
        total_grant_value_usd=total_grant_value_usd,
        pending_reports=pending_reports,
        shipping_issues=shipping_issues,
        row_errors=tuple(row_errors),
    )
