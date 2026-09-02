"""API routes for GrantFlow — 50 column structure."""

from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.data_processor import (
    GrantDataValidationError,
    GrantSummary,
    process_grant_rows,
    validate_grant_dict,
)
from services.pdf_generator import create_pdf_report
from services.sheets_reader import (
    GoogleSheetsConfigurationError,
    GoogleSheetsReadError,
    fetch_grant_rows,
)
from services.sheets_writer import (
    GoogleSheetsWriteError,
    append_grant,
    check_grant_number_exists,
    update_grant,
)
from services.word_generator import create_word_report


router = APIRouter(prefix="/api", tags=["Grants"])
REPORTS_DIR = Path(__file__).resolve().parents[1] / "generated_reports"


# ── Request body model — 50 columns ────────────────────────────────────────
class ReportSections(BaseModel):
    """Which sections to include in the report."""
    sections: dict = {}

class GrantPayload(BaseModel):
    """What the frontend sends when creating or updating a grant."""
    region: str
    grant_number: str
    project_type: Optional[str] = ""
    department: Optional[str] = ""
    supplier: str
    item: str
    po_wo_number: Optional[str] = ""
    sub_grant_no: Optional[str] = ""
    currency: Optional[str] = ""
    total_grant_amount_orig: Optional[float] = 0.0
    total_grant_amount_usd: Optional[float] = 0.0
    sub_grant_amount: Optional[float] = 0.0
    current_payment_orig: Optional[float] = 0.0
    current_payment_usd: Optional[float] = 0.0
    remaining_payment: Optional[float] = 0.0
    payment_status: str = "Pending"
    payment_reference: Optional[str] = ""
    grant_receiving_date: Optional[str] = ""
    grant_application_sent_date: Optional[str] = ""
    date_dr_zafar_signed_application: Optional[str] = ""
    date_of_approval_by_khaleeq_sb: Optional[str] = ""
    date_of_email_to_int_chapter: Optional[str] = ""
    payment_date: Optional[str] = ""
    shipping_documents_status: Optional[str] = ""
    shipping_documents_comment: Optional[str] = ""
    link_to_shipping_documents: Optional[str] = ""
    link_to_complete_documents: Optional[str] = ""
    commercial_invoice_no: Optional[str] = ""
    bill_of_lading: Optional[str] = ""
    packing_list_reference: Optional[str] = ""
    grn_receiving_status: Optional[str] = ""
    receiving_date: Optional[str] = ""
    grn_number: Optional[str] = ""
    link_to_grn: Optional[str] = ""
    grn_receiving_comments: Optional[str] = ""
    installation_date: Optional[str] = ""
    location: Optional[str] = ""
    building_name: Optional[str] = ""
    floor: Optional[str] = ""
    room: Optional[str] = ""
    item_model: Optional[str] = ""
    item_serial_number: Optional[str] = ""
    quantity: Optional[float] = 0.0
    ihhn_asset_tag_number: Optional[str] = ""
    pictures_status: Optional[str] = ""
    pictures: Optional[str] = ""
    poc_for_pictures: Optional[str] = ""
    no_of_beneficiaries: Optional[float] = 0.0
    report_status: str = "Pending"
    link_to_utilization_report: Optional[str] = ""
    item_description: Optional[str] = ""


# ── Helpers ─────────────────────────────────────────────────────────────────
def _get_summary() -> GrantSummary:
    try:
        return process_grant_rows(fetch_grant_rows())
    except GrantDataValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (GoogleSheetsConfigurationError, GoogleSheetsReadError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


def _get_single_grant(grant_number: str) -> dict:
    summary = _get_summary()
    for grant in summary.grants:
        if grant.grant_number == grant_number:
            return grant.as_dict()
    raise HTTPException(
        status_code=404,
        detail=f"Grant '{grant_number}' not found."
    )


# ── GET /api/grants ──────────────────────────────────────────────────────────
@router.get("/grants")
def get_grants() -> dict:
    """Return all grants and dashboard KPIs."""
    return _get_summary().as_dict()


# ── GET /api/grants/{grant_number} ───────────────────────────────────────────
@router.get("/grants/{grant_number}")
def get_grant(grant_number: str) -> dict:
    """Return a single grant by its grant number."""
    return _get_single_grant(grant_number)


# ── POST /api/grants ─────────────────────────────────────────────────────────
@router.post("/grants", status_code=201)
def add_grant(payload: GrantPayload) -> dict:
    """Add a new grant row to the Google Sheet."""
    grant_data = payload.model_dump()

    try:
        validate_grant_dict(grant_data, is_new=True)
    except GrantDataValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    try:
        if check_grant_number_exists(grant_data["grant_number"]):
            raise HTTPException(
                status_code=409,
                detail=f"Grant number '{grant_data['grant_number']}' already exists."
            )
    except GoogleSheetsWriteError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    try:
        append_grant(grant_data)
    except GoogleSheetsWriteError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {
        "message": "Grant added successfully.",
        "grant_number": grant_data["grant_number"]
    }


# ── PUT /api/grants/{grant_number} ───────────────────────────────────────────
@router.put("/grants/{grant_number}")
def edit_grant(grant_number: str, payload: GrantPayload) -> dict:
    """Update an existing grant row in the Google Sheet."""
    grant_data = payload.model_dump()

    try:
        validate_grant_dict(grant_data, is_new=False)
    except GrantDataValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    try:
        update_grant(grant_number, grant_data)
    except GoogleSheetsWriteError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {
        "message": "Grant updated successfully.",
        "grant_number": grant_number
    }


# ── POST /api/reports/pdf/{grant_number} ─────────────────────────────────────
@router.post("/reports/pdf/{grant_number}")
def download_pdf(
    grant_number: str,
    payload: ReportSections = None
) -> FileResponse:
    grant = _get_single_grant(grant_number)
    sections = payload.sections if payload else {}
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = REPORTS_DIR / f"grant-{grant_number}-{timestamp}.pdf"
    try:
        create_pdf_report(grant, output_path, sections=sections)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not generate PDF: {error}"
        ) from error

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=output_path.name
    )


# ── POST /api/reports/word/{grant_number} ────────────────────────────────────
@router.post("/reports/word/{grant_number}")
def download_word(
    grant_number: str,
    payload: ReportSections = None
) -> FileResponse:
    """Generate and download a Word report for one specific grant."""
    grant = _get_single_grant(grant_number)
    sections = payload.model_dump() if payload else {}
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = REPORTS_DIR / f"grant-{grant_number}-{timestamp}.docx"

    try:
        create_word_report(grant, output_path, sections=sections)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not generate Word report: {error}"
        ) from error

    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=output_path.name
    )