"""Validate grant rows, auto-calculate report status, and compute KPIs."""

from __future__ import annotations
from dataclasses import asdict, dataclass
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


def _parse_number(value: str, field_name: str, row_number: int) -> float:
    """Parse a number from a string."""
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


def _calculate_report_status(row: dict) -> str:
    """Auto-calculate report status based on filled fields.
    
    Complete: all fields filled including link_to_utilization_report
    Pending: all fields filled except link_to_utilization_report
    Incomplete Information: any required field is empty
    """
    # Check if link to utilization report is filled
    has_report_link = bool(
        str(row.get("link_to_utilization_report", "")).strip()
    )

    # Check if all required fields are filled
    all_required_filled = all(
        str(row.get(field, "")).strip()
        for field in REQUIRED_FOR_STATUS
    )

    if all_required_filled and has_report_link:
        return "Complete"
    elif all_required_filled and not has_report_link:
        return "Pending"
    else:
        return "Incomplete Information"


@dataclass(frozen=True)
class GrantRecord:
    """Represents one grant row from the sheet."""
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
    total_grant_amount_orig: float
    total_grant_amount_usd: float
    sub_grant_amount: float
    current_payment_orig: float
    current_payment_usd: float
    remaining_payment_orig: float
    remaining_payment_usd: float
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
    quantity: float
    ihhn_asset_tag_number: str
    department_for_pictures: str
    picture: str
    pictures_status: str
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
    for field in ["country", "grant_number", "supplier", "item"]:
        if not str(grant.get(field, "")).strip():
            label = field.replace("_", " ").title()
            raise GrantDataValidationError(f"{label} is required.")

    # Validate dropdowns
    if grant.get("country") not in VALID_COUNTRIES:
        raise GrantDataValidationError(
            f"Country must be one of: {', '.join(sorted(VALID_COUNTRIES))}"
        )
    if grant.get("payment_status") not in VALID_PAYMENT_STATUS:
        raise GrantDataValidationError(
            f"Payment Status must be one of: {', '.join(VALID_PAYMENT_STATUS)}"
        )


def process_grant_rows(rows: list[dict[str, str]]) -> GrantSummary:
    """Process all grant rows from the sheet into a GrantSummary."""
    if not rows:
        return GrantSummary(
            grants=(), total_grants=0, total_paid_usd=0.0,
            pending_reports=0, shipping_issues=0,
            total_grant_value_usd=0.0,
        )

    grants: list[GrantRecord] = []

    for row_number, row in enumerate(rows, start=2):
        if not row.get("grant_number", "").strip():
            continue

        # Auto calculate report status
        report_status = _calculate_report_status(row)

        try:
            grants.append(GrantRecord(
                country=row.get("country", "").strip(),
                chapter=row.get("chapter", "").strip(),
                grant_number=row.get("grant_number", "").strip(),
                project_type=row.get("project_type", "").strip(),
                department=row.get("department", "").strip(),
                supplier=row.get("supplier", "").strip(),
                item=row.get("item", "").strip(),
                po_wo_number=row.get("po_wo_number", "").strip(),
                sub_grant_no=row.get("sub_grant_no", "").strip(),
                link_to_complete_documents=row.get(
                    "link_to_complete_documents", ""
                ).strip(),
                secondary_currency=row.get("secondary_currency", "").strip(),
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
                remaining_payment_orig=_parse_number(
                    row.get("remaining_payment_orig", "0"),
                    "Remaining Payment (orig)", row_number
                ),
                remaining_payment_usd=_parse_number(
                    row.get("remaining_payment_usd", "0"),
                    "Remaining Payment (USD)", row_number
                ),
                payment_status=row.get("payment_status", "Pending").strip(),
                payment_reference=row.get("payment_reference", "").strip(),
                grant_receiving_date=row.get(
                    "grant_receiving_date", ""
                ).strip(),
                grant_application_sent_date=row.get(
                    "grant_application_sent_date", ""
                ).strip(),
                date_dr_zafar_signed_application=row.get(
                    "date_dr_zafar_signed_application", ""
                ).strip(),
                date_of_approval_by_khaleeq_sb=row.get(
                    "date_of_approval_by_khaleeq_sb", ""
                ).strip(),
                date_of_email_to_int_chapter=row.get(
                    "date_of_email_to_int_chapter", ""
                ).strip(),
                payment_date=row.get("payment_date", "").strip(),
                date_ceo_signed_application=row.get(
                    "date_ceo_signed_application", ""
                ).strip(),
                shipping_documents_status=row.get(
                    "shipping_documents_status", ""
                ).strip(),
                shipping_documents_comment=row.get(
                    "shipping_documents_comment", ""
                ).strip(),
                link_to_shipping_documents=row.get(
                    "link_to_shipping_documents", ""
                ).strip(),
                commercial_invoice_no=row.get(
                    "commercial_invoice_no", ""
                ).strip(),
                bill_of_lading=row.get("bill_of_lading", "").strip(),
                packing_list_reference=row.get(
                    "packing_list_reference", ""
                ).strip(),
                grn_receiving_status=row.get(
                    "grn_receiving_status", ""
                ).strip(),
                receiving_date=row.get("receiving_date", "").strip(),
                grn_number=row.get("grn_number", "").strip(),
                link_to_grn=row.get("link_to_grn", "").strip(),
                grn_receiving_comments=row.get(
                    "grn_receiving_comments", ""
                ).strip(),
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
                ihhn_asset_tag_number=row.get(
                    "ihhn_asset_tag_number", ""
                ).strip(),
                department_for_pictures=row.get(
                    "department_for_pictures", ""
                ).strip(),
                picture=row.get("picture", "").strip(),
                pictures_status=row.get("pictures_status", "").strip(),
                no_of_beneficiaries=_parse_number(
                    row.get("no_of_beneficiaries", "0"),
                    "No. of Beneficiaries", row_number
                ),
                report_status=report_status,
                link_to_utilization_report=row.get(
                    "link_to_utilization_report", ""
                ).strip(),
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
    )