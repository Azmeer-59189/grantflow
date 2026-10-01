"""Chapter-specific Word/PDF reports built from .docx templates.

Each chapter can have its own Word template in ``backend/templates/``.
Placeholders inside the template look like ``{{ grant_number }}``.
To add a chapter: drop its template into ``templates/`` and add one line to
``CHAPTER_TEMPLATES`` below. Chapters without a template fall back to the
generic report generators.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from docxtpl import DocxTemplate, RichText

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates"

# Chapter value (as stored in the sheet) -> template file name
CHAPTER_TEMPLATES = {
    "IDF": "IDF_Canada.docx",
    # "FOIHUS": "FOIHUS_USA.docx",
    # "TIH UAE": "TIH_UAE.docx",
    # "IHN UK": "IHN_UK.docx",
    # "FOIH Germany": "FOIH_Germany.docx",
    # "FOIH Switzerland": "FOIH_Switzerland.docx",
}

# Sheet field -> label shown in the "Attachments" list (only filled ones appear)
ATTACHMENT_FIELDS = [
    ("link_to_complete_documents", "Complete Documents (Application, PO & Invoice)"),
    ("payment_reference", "Payment Reference"),
    ("link_to_shipping_documents", "Shipping Documents"),
    ("link_to_grn", "Goods Receipt Note (GRN)"),
    ("link_to_utilization_report", "Utilization Report"),
    ("picture", "Pictures"),
]

CHECKED = "\u2611"    # ☑
UNCHECKED = "\u2610"  # ☐


class TemplateReportError(RuntimeError):
    """Raised when a template report cannot be produced."""


# ── helpers ─────────────────────────────────────────────────────────────────
def get_template_path(chapter: str) -> Path | None:
    """Return the template path for a chapter, or None if it has none."""
    name = CHAPTER_TEMPLATES.get((chapter or "").strip())
    if not name:
        return None
    path = TEMPLATES_DIR / name
    return path if path.is_file() else None


def has_template(chapter: str) -> bool:
    return get_template_path(chapter) is not None


def _fmt_date(value) -> str:
    """Format dates like 'February 10, 2023'. Unparseable text is kept as is."""
    text = str(value or "").strip()
    if not text:
        return ""
    # Google Sheets date serial numbers (e.g. 46296 -> October 1, 2026)
    try:
        serial = float(text)
        if 20000 < serial < 80000:
            parsed = datetime(1899, 12, 30) + timedelta(days=int(serial))
            return f"{parsed.strftime('%B')} {parsed.day}, {parsed.year}"
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            return f"{parsed.strftime('%B')} {parsed.day}, {parsed.year}"
        except ValueError:
            continue
    return text


def _fmt_number(value) -> str:
    """1.0 -> '1', 1234.5 -> '1,234.5', empty/0 -> ''."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value or "").strip()
    if number == 0:
        return ""
    return f"{number:,.0f}" if number.is_integer() else f"{number:,.2f}"


def _is_url(value: str) -> bool:
    return str(value or "").strip().lower().startswith(("http://", "https://"))


def _build_context(grant: dict, tpl: DocxTemplate) -> dict:
    g = lambda key: str(grant.get(key, "") or "").strip()

    floor, room = g("floor"), g("room")
    floor_room = " / ".join(part for part in (floor, room) if part)

    attachments = []
    for key, label in ATTACHMENT_FIELDS:
        url = g(key)
        if not _is_url(url):
            continue
        rich = RichText()
        rich.add(
            label,
            url_id=tpl.build_url_id(url),
            color="0563C1",
            underline="single",
            size=18,
        )
        attachments.append({"rt": rich})

    has_util_report = _is_url(g("link_to_utilization_report"))

    return {
        # 1. Report information
        "report_date": _fmt_date(datetime.now().strftime("%Y-%m-%d")),
        "reporting_period": "",          # no field yet
        # 2 / 3
        "grant_number": g("grant_number"),
        "payment_date": _fmt_date(grant.get("payment_date")),
        # 4. Equipment
        "item": g("item"),
        "manufacturer": "",              # no field yet
        "item_model": g("item_model"),
        "item_serial_number": g("item_serial_number"),
        "quantity": _fmt_number(grant.get("quantity")),
        "ihhn_asset_tag_number": g("ihhn_asset_tag_number"),
        "capacity": "",                  # no field yet
        # 5. Shipping & receipt
        "commercial_invoice_no": g("commercial_invoice_no"),
        "bill_of_lading": g("bill_of_lading"),
        "packing_list_reference": g("packing_list_reference"),
        "grn_number": g("grn_number"),
        "receiving_date": _fmt_date(grant.get("receiving_date")),
        # 6. Installation
        "installation_date": _fmt_date(grant.get("installation_date")),
        "building_name": g("building_name"),
        "floor_room": floor_room,
        # 7. Beneficiaries
        "no_of_beneficiaries": _fmt_number(grant.get("no_of_beneficiaries")),
        "util_yes": CHECKED if has_util_report else UNCHECKED,
        "util_no": UNCHECKED if has_util_report else CHECKED,
        # 9. Attachments
        "attachments": attachments,
    }


# ── public API ──────────────────────────────────────────────────────────────
def create_template_word_report(grant: dict, output_path: Path) -> Path:
    """Fill the chapter's Word template and save it to ``output_path``."""
    template_path = get_template_path(grant.get("chapter", ""))
    if template_path is None:
        raise TemplateReportError(
            f"No report template configured for chapter '{grant.get('chapter', '')}'."
        )
    tpl = DocxTemplate(str(template_path))
    tpl.render(_build_context(grant, tpl))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tpl.save(str(output_path))
    return output_path


def _find_soffice() -> str | None:
    found = shutil.which("soffice") or shutil.which("libreoffice")
    if found:
        return found
    for candidate in (
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ):
        if os.path.isfile(candidate):
            return candidate
    return None


def pdf_conversion_available() -> bool:
    return _find_soffice() is not None


def convert_docx_to_pdf(docx_path: Path, pdf_path: Path) -> Path:
    """Convert a .docx to PDF with headless LibreOffice."""
    soffice = _find_soffice()
    if soffice is None:
        raise TemplateReportError(
            "LibreOffice is not installed on this server, so PDF conversion is unavailable."
        )
    with tempfile.TemporaryDirectory() as tmp_dir:
        profile = Path(tmp_dir) / "profile"   # private profile avoids lock clashes
        try:
            subprocess.run(
                [
                    soffice,
                    f"-env:UserInstallation={profile.as_uri()}",
                    "--headless",
                    "--convert-to", "pdf",
                    "--outdir", tmp_dir,
                    str(docx_path),
                ],
                check=True,
                capture_output=True,
                timeout=120,
            )
        except (subprocess.SubprocessError, OSError) as error:
            raise TemplateReportError(f"PDF conversion failed: {error}") from error
        produced = Path(tmp_dir) / (docx_path.stem + ".pdf")
        if not produced.is_file():
            raise TemplateReportError("PDF conversion produced no file.")
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(produced), str(pdf_path))
    return pdf_path