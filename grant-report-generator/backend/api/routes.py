"""API routes for GrantFlow — 50 column structure."""

from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from starlette.background import BackgroundTask
from api.auth import require_user
import tempfile
import shutil
import re
import logging
from services import supabase_service
from services.sheets_writer import GoogleSheetsConfigurationError as WriteConfigurationError
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict

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

from services.template_report import (
    TemplateReportError,
    convert_docx_to_pdf,
    create_template_word_report,
    has_template,
)


router = APIRouter(prefix="/api", tags=["Grants"], dependencies=[Depends(require_user)])


# ── Request body model — 50 columns ────────────────────────────────────────
class ReportSections(BaseModel):
    """Which sections to include in the report."""
    sections: dict[str, bool] = Field(default_factory=dict)

class GrantPayload(BaseModel):
    """What the frontend sends when creating or updating a grant."""
    model_config = ConfigDict(allow_inf_nan=False)
    year: Optional[str] = ""
    region: Optional[str] = ""
    country: Optional[str] = ""
    chapter: Optional[str] = ""
    grant_number: str
    project_type: Optional[str] = ""
    department: Optional[str] = ""
    supplier: str
    item: str
    po_wo_number: Optional[str] = ""
    sub_grant_no: Optional[str] = ""
    link_to_complete_documents: Optional[str] = ""
    secondary_currency: Optional[str] = ""
    total_grant_amount_orig: Optional[float] = 0.0
    total_grant_amount_usd: Optional[float] = 0.0
    sub_grant_amount: Optional[float] = 0.0
    current_payment_orig: Optional[float] = 0.0
    current_payment_usd: Optional[float] = 0.0
    remaining_payment_orig: Optional[float] = 0.0
    remaining_payment_usd: Optional[float] = 0.0
    payment_status: str = "Pending"
    payment_reference: Optional[str] = ""
    grant_receiving_date: Optional[str] = ""
    grant_application_sent_date: Optional[str] = ""
    date_dr_zafar_signed_application: Optional[str] = ""
    date_of_approval_by_khaleeq_sb: Optional[str] = ""
    date_of_email_to_int_chapter: Optional[str] = ""
    payment_date: Optional[str] = ""
    date_ceo_signed_application: Optional[str] = ""
    shipping_documents_status: Optional[str] = ""
    shipping_documents_comment: Optional[str] = ""
    link_to_shipping_documents: Optional[str] = ""
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
    department_for_pictures: Optional[str] = ""
    picture: Optional[str] = ""
    pictures_status: Optional[str] = ""
    no_of_beneficiaries: Optional[float] = 0.0
    report_status: Optional[str] = "Incomplete Information"
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
    try:
        rows = fetch_grant_rows()
        result = process_grant_rows(rows).as_dict()
    except GrantDataValidationError as error:
        raise HTTPException(422, str(error)) from error
    except (GoogleSheetsConfigurationError, GoogleSheetsReadError) as error:
        try:
            cached = supabase_service.get_latest_sheet_cache()
            cached_at = datetime.fromisoformat(cached['cached_at'].replace('Z', '+00:00')) if cached else None
            age = (datetime.now(timezone.utc) - cached_at).total_seconds() if cached_at else float('inf')
            if age < 0 or age > int(os.getenv('SHEET_CACHE_MAX_AGE_SECONDS', '86400')):
                raise ValueError('No recent snapshot available')
            result = process_grant_rows(cached['data']).as_dict()
            result['cache_warning'] = f"Google Sheets is unavailable. Showing a saved snapshot from {cached['cached_at']}. Refresh before making decisions."
            return result
        except Exception:
            raise HTTPException(503, 'Google Sheets is unavailable and no recent valid snapshot is available.') from error
    try:
        supabase_service.cache_sheet_data(rows)
    except Exception:
        logging.exception('Could not save sheet snapshot')
    return result


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
    except (GoogleSheetsWriteError, WriteConfigurationError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    try:
        append_grant(grant_data)
    except (GoogleSheetsWriteError, WriteConfigurationError) as error:
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
    if grant_data['grant_number'] != grant_number:
        raise HTTPException(422, 'Grant number cannot be changed when editing a grant.')

    try:
        validate_grant_dict(grant_data, is_new=False)
    except GrantDataValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    try:
        update_grant(grant_number, grant_data)
    except (GoogleSheetsWriteError, WriteConfigurationError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {
        "message": "Grant updated successfully.",
        "grant_number": grant_number
    }


# ── POST /api/reports/pdf & word/{grant_number} ─────────────────────────────────────
@router.get('/reports/history')
def report_history() -> list:
    try:
        return supabase_service.get_report_history()
    except Exception as error:
        logging.exception('Could not load report history')
        raise HTTPException(503, 'Report history is unavailable.') from error


def _download_report(grant_number, payload, report_format, user):
    grant = _get_single_grant(grant_number)
    sections = payload.sections if payload else {}
    # Fixed chapter layouts apply to complete reports; customized reports use
    # the generic layout so every unchecked section is excluded.
    use_template = has_template(grant) and all(sections.values())
    directory = Path(tempfile.mkdtemp(prefix='grantflow-'))
    safe_number = re.sub(r'[^A-Za-z0-9_-]', '_', grant_number)[:80] or 'report'
    output = directory / f'grant-{safe_number}.{report_format}'
    try:
        if use_template:
            docx = output if report_format == 'docx' else output.with_suffix('.docx')
            create_template_word_report(grant, docx)
            if report_format == 'pdf':
                convert_docx_to_pdf(docx, output)
        elif report_format == 'pdf':
            create_pdf_report(grant, output, sections=sections)
        else:
            create_word_report(grant, output, sections=sections)
        supabase_service.save_report_metadata(
            generated_by=str(user.id), report_format='PDF' if report_format == 'pdf' else 'Word',
            row_count=1, total_received=grant.get('current_payment_usd', 0),
            total_beneficiaries=int(grant.get('no_of_beneficiaries', 0)),
        )
    except Exception as error:
        shutil.rmtree(directory, ignore_errors=True)
        logging.exception('Report generation failed')
        message = str(error) if isinstance(error, TemplateReportError) else 'Could not generate or record report. Please try again.'
        raise HTTPException(503, message) from error
    media_type = 'application/pdf' if report_format == 'pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    return FileResponse(output, media_type=media_type, filename=output.name,
                        background=BackgroundTask(shutil.rmtree, directory, ignore_errors=True))


@router.post('/reports/pdf/{grant_number}')
def download_pdf(grant_number: str, payload: ReportSections = None, user=Depends(require_user)):
    return _download_report(grant_number, payload, 'pdf', user)


@router.post('/reports/word/{grant_number}')
def download_word(grant_number: str, payload: ReportSections = None, user=Depends(require_user)):
    return _download_report(grant_number, payload, 'docx', user)
