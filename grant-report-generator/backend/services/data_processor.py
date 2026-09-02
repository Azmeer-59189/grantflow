"""Validate grant rows and calculate dashboard KPIs for 50-column structure."""

from __future__ import annotations
from dataclasses import asdict, dataclass
import re
from typing import Any

# Snake case versions of all 50 column headers
REQUIRED_FIELDS = {
    "region",
    "grant_number",
    "supplier",
    "item",
    "currency",
    "payment_status",
    "report_status",
}

# Optional fields — can be blank
OPTIONAL_FIELDS = {
    "project_type", "department", "po_wo_number", "sub_grant_no",
    "total_grant_amount_orig", "total_grant_amount_usd", "sub_grant_amount",
    "current_payment_orig", "current_payment_usd", "remaining_payment",
    "payment_reference", "grant_receiving_date", "grant_application_sent_date",
    "date_dr_zafar_signed_application", "date_of_approval_by_khaleeq_sb",
    "date_of_email_to_int_chapter", "payment_date",
    "shipping_documents_status", "shipping_documents_comment",
    "link_to_shipping_documents", "link_to_complete_documents",
    "commercial_invoice_no", "bill_of_lading", "packing_list_reference",
    "grn_receiving_status", "receiving_date", "grn_number", "link_to_grn",
    "grn_receiving_comments", "installation_date", "location",
    "building_name", "floor", "room", "item_model", "item_serial_number",
    "quantity", "ihhn_asset_tag_number", "pictures_status", "pictures",
    "poc_for_pictures", "no_of_beneficiaries",
    "link_to_utilization_report", "item_description",
}

# Valid dropdown values
VALID_REGIONS = {
    "FOIH USA", "IDF Canada", "FOIH Germany",
    "Indus Health UAE", "FOIH Australia"
}
VALID_PROJECT_TYPES = {"Expansion", "Non-Expansion", ""}
VALID_CURRENCIES = {"USD", "CAD", "EUR", "AED", "AUD", ""}
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
VALID_REPORT_STATUS = {"Pending", "Report Complete"}

# Currency per region
REGION_CURRENCY = {
    "FOIH USA": "USD",
    "IDF Canada": "CAD",
    "FOIH Germany": "EUR",
    "Indus Health UAE": "AED",
    "FOIH Australia": "AUD",
}


class GrantDataValidationError(ValueError):
    """Raised when a row has missing or invalid data."""


def _parse_number(value: str, field_name: str, row_number: int) -> float:
    """Parse a number from a string, stripping currency symbols."""
    if not str(value).strip():
        return 0.0
    cleaned = re.sub(r"[^0-9.\-]", "", str(value))
    try:
        result = float(cleaned) if cleaned else 0.0
    except ValueError as error:
        raise GrantDataValidationError(
            f"Row {row_number}: {field_name} must be a number."
        ) from error
    return result


@dataclass(frozen=True)
class GrantRecord:
    """Represents one grant row from the sheet."""
    region: str
    grant_number: str
    project_type: str
    department: str
    supplier: str
    item: str
    po_wo_number: str
    sub_grant_no: str
    currency: str
    total_grant_amount_orig: float
    total_grant_amount_usd: float
    sub_grant_amount: float
    current_payment_orig: float
    current_payment_usd: float
    remaining_payment: float
    payment_status: str
    payment_reference: str
    grant_receiving_date: str
    grant_application_sent_date: str
    date_dr_zafar_signed_application: str
    date_of_approval_by_khaleeq_sb: str
    date_of_email_to_int_chapter: str
    payment_date: str
    shipping_documents_status: str
    shipping_documents_comment: str
    link_to_shipping_documents: str
    link_to_complete_documents: str
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
    quantity: float
    ihhn_asset_tag_number: str
    pictures_status: str
    pictures: str
    poc_for_pictures: str
    no_of_beneficiaries: float
    report_status: str
    link_to_utilization_report: str
    item_description: str

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

    def as_dict(self) -> dict[str, Any]:
        return {
            "grants": [g.as_dict() for g in self.grants],
            "total_grants": self.total_grants,
            "total_paid_usd": self.total_paid_usd,
            "total_grant_value_usd": self.total_grant_value_usd,
            "pending_reports": self.pending_reports,
            "shipping_issues": self.shipping_issues,
        }


def validate_grant_dict(grant: dict, is_new: bool = True) -> None:
    """Validate a grant dictionary before writing to sheet."""

    # Check required fields
    for field in REQUIRED_FIELDS:
        if not str(grant.get(field, "")).strip():
            label = field.replace("_", " ").title()
            raise GrantDataValidationError(f"{label} is required.")

    # Validate dropdowns
    if grant.get("region") not in VALID_REGIONS:
        raise GrantDataValidationError(
            f"Region must be one of: {', '.join(sorted(VALID_REGIONS))}"
        )
    if grant.get("payment_status") not in VALID_PAYMENT_STATUS:
        raise GrantDataValidationError(
            f"Payment Status must be one of: {', '.join(VALID_PAYMENT_STATUS)}"
        )
    if grant.get("report_status") not in VALID_REPORT_STATUS:
        raise GrantDataValidationError(
            f"Report Status must be one of: {', '.join(VALID_REPORT_STATUS)}"
        )


def process_grant_rows(rows: list[dict[str, str]]) -> GrantSummary:
    """Process all grant rows from the sheet into a GrantSummary."""

    if not rows:
        return GrantSummary(
            grants=(), total_grants=0, total_paid_usd=0.0,
            pending_reports=0, shipping_issues=0, total_grant_value_usd=0.0,
        )

    grants: list[GrantRecord] = []

    for row_number, row in enumerate(rows, start=2):
        # Skip rows where grant number is empty
        if not row.get("grant_number", "").strip():
            continue

        try:
            grants.append(GrantRecord(
                region=row.get("region", "").strip(),
                grant_number=row.get("grant_number", "").strip(),
                project_type=row.get("project_type", "").strip(),
                department=row.get("department", "").strip(),
                supplier=row.get("supplier", "").strip(),
                item=row.get("item", "").strip(),
                po_wo_number=row.get("po_wo_number", "").strip(),
                sub_grant_no=row.get("sub_grant_no", "").strip(),
                currency=row.get("currency", "").strip(),
                total_grant_amount_orig=_parse_number(
                    row.get("total_grant_amount_orig", "0"),
                    "Total Grant Amount (orig)", row_number
                ),
                total_grant_amount_usd=_parse_number(
                    row.get("total_grant_amount_usd", "0"),
                    "Total Grant Amount (USD)", row_number
                ),
                sub_grant_amount=_parse_number(
                    row.get("sub_grant_amount", "0"),
                    "Sub Grant Amount", row_number
                ),
                current_payment_orig=_parse_number(
                    row.get("current_payment_orig", "0"),
                    "Current Payment (orig)", row_number
                ),
                current_payment_usd=_parse_number(
                    row.get("current_payment_usd", "0"),
                    "Current Payment (USD)", row_number
                ),
                remaining_payment=_parse_number(
                    row.get("remaining_payment", "0"),
                    "Remaining Payment", row_number
                ),
                payment_status=row.get("payment_status", "Pending").strip(),
                payment_reference=row.get("payment_reference", "").strip(),
                grant_receiving_date=row.get("grant_receiving_date", "").strip(),
                grant_application_sent_date=row.get("grant_application_sent_date", "").strip(),
                date_dr_zafar_signed_application=row.get("date_dr_zafar_signed_application", "").strip(),
                date_of_approval_by_khaleeq_sb=row.get("date_of_approval_by_khaleeq_sb", "").strip(),
                date_of_email_to_int_chapter=row.get("date_of_email_to_int_chapter", "").strip(),
                payment_date=row.get("payment_date", "").strip(),
                shipping_documents_status=row.get("shipping_documents_status", "").strip(),
                shipping_documents_comment=row.get("shipping_documents_comment", "").strip(),
                link_to_shipping_documents=row.get("link_to_shipping_documents", "").strip(),
                link_to_complete_documents=row.get("link_to_complete_documents", "").strip(),
                commercial_invoice_no=row.get("commercial_invoice_no", "").strip(),
                bill_of_lading=row.get("bill_of_lading", "").strip(),
                packing_list_reference=row.get("packing_list_reference", "").strip(),
                grn_receiving_status=row.get("grn_receiving_status", "").strip(),
                receiving_date=row.get("receiving_date", "").strip(),
                grn_number=row.get("grn_number", "").strip(),
                link_to_grn=row.get("link_to_grn", "").strip(),
                grn_receiving_comments=row.get("grn_receiving_comments", "").strip(),
                installation_date=row.get("installation_date", "").strip(),
                location=row.get("location", "").strip(),
                building_name=row.get("building_name", "").strip(),
                floor=row.get("floor", "").strip(),
                room=row.get("room", "").strip(),
                item_model=row.get("item_model", "").strip(),
                item_serial_number=row.get("item_serial_number", "").strip(),
                quantity=_parse_number(
                    row.get("quantity", "0"), "Quantity", row_number
                ),
                ihhn_asset_tag_number=row.get("ihhn_asset_tag_number", "").strip(),
                pictures_status=row.get("pictures_status", "").strip(),
                pictures=row.get("pictures", "").strip(),
                poc_for_pictures=row.get("poc_for_pictures", "").strip(),
                no_of_beneficiaries=_parse_number(
                    row.get("no_of_beneficiaries", "0"),
                    "No. of Beneficiaries", row_number
                ),
                report_status=row.get("report_status", "Pending").strip(),
                link_to_utilization_report=row.get("link_to_utilization_report", "").strip(),
                item_description=row.get("item_description", "").strip(),
            ))
        except GrantDataValidationError:
            continue

    # Calculate KPIs
    total_paid_usd = sum(
        g.current_payment_usd for g in grants
        if g.payment_status == "Complete"
    )
    total_grant_value_usd = sum(g.total_grant_amount_usd for g in grants)
    pending_reports = sum(
        1 for g in grants if g.report_status == "Pending"
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
    )