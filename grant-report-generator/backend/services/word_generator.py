"""Generate a per-grant Word report for GrantFlow."""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


# Color constants
NAVY = RGBColor(11, 37, 69)
BLUE = RGBColor(11, 76, 140)
MUTED = RGBColor(88, 97, 116)
GREEN = RGBColor(29, 111, 184)
AMBER = RGBColor(232, 169, 22)
RED = RGBColor(192, 39, 45)

# Status to color mapping
STATUS_COLORS = {
    "Paid": GREEN,
    "Submitted": GREEN,
    "Received": GREEN,
    "Pending": AMBER,
    "Partial": AMBER,
    "Overdue": RED,
    "Discrepancy": RED,
    "Not Received": RED,
}


def _status_color(value: str) -> RGBColor:
    """Return RGBColor for a status value."""
    return STATUS_COLORS.get(value, MUTED)


def _shade(cell, fill: str) -> None:
    """Apply background color to a table cell."""
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(shading)


def _font(run, size: float, bold: bool = False, color: RGBColor | None = None) -> None:
    """Apply font settings to a run of text."""
    run.font.name = "Calibri"
    run._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    run._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = color


def _set_widths(table, widths: list[float]) -> None:
    """Set fixed column widths on a table."""
    table.autofit = False
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    table._tbl.tblPr.append(layout)
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            cell.width = Inches(width)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cell.paragraphs[0].paragraph_format.space_after = Pt(0)


def _add_section_heading(document: Document, text: str) -> None:
    """Add a styled section heading paragraph."""
    heading = document.add_paragraph()
    heading.paragraph_format.space_before = Pt(16)
    heading.paragraph_format.space_after = Pt(8)
    _font(heading.add_run(text), 13, bold=True, color=BLUE)


def _add_detail_table(document: Document, rows: list[tuple]) -> None:
    """Add a two-column label/value table.

    rows: list of (label, value, optional_color) tuples
    """
    table = document.add_table(rows=len(rows), cols=2)
    _set_widths(table, [2.2, 4.3])

    for index, row_data in enumerate(rows):
        label = row_data[0]
        value = str(row_data[1])
        color = row_data[2] if len(row_data) > 2 else MUTED

        # Label cell — shaded background
        label_cell = table.cell(index, 0)
        _shade(label_cell, "E8EEF5")
        _font(label_cell.paragraphs[0].add_run(label), 10, bold=True, color=NAVY)

        # Value cell
        value_cell = table.cell(index, 1)
        _font(value_cell.paragraphs[0].add_run(value), 10, color=color)


REPORT_FIELDS = {
    'overview': ('Grant Overview', 'year country chapter project_type supplier item department po_wo_number sub_grant_no link_to_complete_documents'),
    'financial': ('Financial Summary', 'secondary_currency total_grant_amount_orig total_grant_amount_usd sub_grant_amount current_payment_orig current_payment_usd remaining_payment_orig remaining_payment_usd payment_status payment_reference'),
    'dates': ('Key Dates', 'grant_receiving_date grant_application_sent_date date_dr_zafar_signed_application date_of_approval_by_khaleeq_sb date_of_email_to_int_chapter payment_date date_ceo_signed_application'),
    'shipping': ('Shipping & Documents', 'shipping_documents_status shipping_documents_comment link_to_shipping_documents commercial_invoice_no bill_of_lading packing_list_reference'),
    'grn': ('GRN / Receiving', 'grn_receiving_status receiving_date grn_number link_to_grn grn_receiving_comments'),
    'location': ('Installation & Location', 'installation_date location building_name floor room'),
    'item': ('Item Details', 'item_model item_serial_number quantity ihhn_asset_tag_number no_of_beneficiaries item_description'),
    'pictures': ('Pictures', 'department_for_pictures picture pictures_status'),
    'report': ('Report Status', 'report_status link_to_utilization_report'),
}


def create_word_report(grant: dict, output_path: Path, sections: dict | None = None) -> Path:
    """Generate a report using the current sheet schema and selected sections."""
    sections = sections or {}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    document = Document()
    section = document.sections[0]
    section.top_margin = section.bottom_margin = Inches(0.8)
    section.left_margin = section.right_margin = Inches(0.75)
    document.add_heading('IHHN GrantFlow | Grant Utilization Report', 0)
    document.add_paragraph(f"Grant: {grant.get('grant_number', '')}")
    document.add_paragraph(f'Generated: {date.today().isoformat()}')
    for key, (title, fields) in REPORT_FIELDS.items():
        if not sections.get(key, True):
            continue
        _add_section_heading(document, title)
        rows = []
        for field in fields.split():
            value = grant.get(field)
            if value is None or value == '':
                value = '—'
            elif isinstance(value, (int, float)):
                value = f'{value:,.2f}'
            rows.append((field.replace('_', ' ').title(), value))
        _add_detail_table(document, rows)
    document.add_paragraph('Confidential — For internal use only.')
    document.save(output_path)
    return output_path
