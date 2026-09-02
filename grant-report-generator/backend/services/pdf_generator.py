"""Generate a per-grant PDF report matching IHHN GrantFlow template."""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable
)

# ── Color palette ──────────────────────────────────────────────────────────
NAVY      = colors.HexColor("#08325C")
BLUE      = colors.HexColor("#0B4C8C")
AMBER     = colors.HexColor("#E8A916")
RED       = colors.HexColor("#C0272D")
GREEN     = colors.HexColor("#1D6FB8")
MUTED     = colors.HexColor("#5B6B82")
LIGHT_BG  = colors.HexColor("#EEF3F8")
LINE      = colors.HexColor("#D8DEE8")
WHITE     = colors.white

STATUS_COLORS = {
    "Complete":                    GREEN,
    "Report Complete":             GREEN,
    "Received":                    GREEN,
    "Paid":                        GREEN,
    "Pending":                     AMBER,
    "Partial":                     AMBER,
    "Received with comments":      AMBER,
    "Partial shipment documents":  AMBER,
    "Not received":                RED,
    "Received with discrepancy":   RED,
    "Overdue":                     RED,
    "Not required":                MUTED,
    "Not applicable":              MUTED,
}

def _status_color(value: str):
    return STATUS_COLORS.get(value, MUTED)


def _val(grant: dict, key: str, fallback: str = "—") -> str:
    v = grant.get(key, "")
    return str(v).strip() if v else fallback


def _money(grant: dict, key: str, currency: str = "") -> str:
    v = grant.get(key, "")
    try:
        amount = float(v)
        prefix = f"{currency} " if currency else ""
        return f"{prefix}{amount:,.2f}"
    except (ValueError, TypeError):
        return "—"


def create_pdf_report(
    grant: dict,
    output_path: Path,
    sections: dict = None
) -> Path:
    """Generate a PDF report for a single grant.
    
    sections: dict of section keys to bool — True means include.
    All sections included by default if not specified.
    """
    if sections is None:
        sections = {}

    # Returns True if section should be included
    def show(key: str) -> bool:
        return sections.get(key, True)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Styles ─────────────────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "GFTitle", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=20,
        textColor=NAVY, spaceAfter=2
    )
    subtitle_style = ParagraphStyle(
        "GFSubtitle", parent=styles["Normal"],
        fontName="Helvetica", fontSize=11,
        textColor=MUTED, spaceAfter=4
    )
    section_style = ParagraphStyle(
        "GFSection", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=9,
        textColor=BLUE, spaceBefore=14, spaceAfter=4,
    )
    muted_style = ParagraphStyle(
        "GFMuted", parent=styles["Normal"],
        fontName="Helvetica", fontSize=8,
        textColor=MUTED
    )
    notes_style = ParagraphStyle(
        "GFNotes", parent=styles["Normal"],
        fontName="Helvetica", fontSize=9,
        textColor=colors.HexColor("#374151"),
        leading=14
    )

    # ── Header — always shown ──────────────────────────────────────────────
    grant_number = _val(grant, "grant_number", "N/A")
    story.append(Paragraph(grant_number, title_style))
    story.append(Paragraph(
        f"Utilization Report Summary · "
        f"{_val(grant, 'region')} · "
        f"Generated {date.today().strftime('%B %d, %Y')}",
        subtitle_style
    ))
    story.append(HRFlowable(
        width="100%", thickness=1.5,
        color=NAVY, spaceAfter=14
    ))

    # ── Helper: two-column detail table ───────────────────────────────────
    def detail_table(rows: list) -> Table:
        table_data = []
        for row in rows:
            label = row[0]
            value = str(row[1]) if row[1] else "—"
            val_color = row[2] if len(row) > 2 else colors.HexColor("#111827")
            table_data.append([
                Paragraph(
                    f'<font name="Helvetica-Bold" color="#0B4C8C">{label}</font>',
                    styles["Normal"]
                ),
                Paragraph(
                    f'<font name="Helvetica">{value}</font>',
                    styles["Normal"]
                ),
            ])

        t = Table(table_data, colWidths=[2.3 * inch, 4.7 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, -1), LIGHT_BG),
            ("FONTSIZE",      (0, 0), (-1, -1), 9),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
            ("GRID",          (0, 0), (-1, -1), 0.5, LINE),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))
        return t

    def notes_box(text: str, title: str, bg: str, border: str) -> Table:
        box = Table(
            [[Paragraph(
                f'<font name="Helvetica-Bold" size="8">{title}</font>'
                f'<br/><font name="Helvetica" size="9">{text}</font>',
                styles["Normal"]
            )]],
            colWidths=[7.0 * inch]
        )
        box.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor(bg)),
            ("BOX",           (0, 0), (-1, -1), 0.5, colors.HexColor(border)),
            ("TOPPADDING",    (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LEFTPADDING",   (0, 0), (-1, -1), 12),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ]))
        return box

    currency = _val(grant, "currency", "USD")

    # ── Section 1: Grant Overview ──────────────────────────────────────────
    if show('overview'):
        story.append(Paragraph("GRANT OVERVIEW", section_style))
        story.append(detail_table([
            ("Supplier",        _val(grant, "supplier")),
            ("Item",            _val(grant, "item")),
            ("Project Type",    _val(grant, "project_type")),
            ("Department",      _val(grant, "department")),
            ("PO / WO Number",  _val(grant, "po_wo_number")),
            ("Sub Grant No.",   _val(grant, "sub_grant_no")),
        ]))

    # ── Section 2: Financial Summary ──────────────────────────────────────
    if show('financial'):
        payment_status = _val(grant, "payment_status", "Pending")
        story.append(Paragraph("FINANCIAL SUMMARY", section_style))
        story.append(detail_table([
            ("Currency",                  currency),
            ("Total Grant Amount (orig)", _money(grant, "total_grant_amount_orig", currency)),
            ("Total Grant Amount (USD)",  _money(grant, "total_grant_amount_usd")),
            ("Sub Grant Amount",          _money(grant, "sub_grant_amount", currency)),
            ("Current Payment (orig)",    _money(grant, "current_payment_orig", currency)),
            ("Current Payment (USD)",     _money(grant, "current_payment_usd")),
            ("Remaining Payment (USD)",   _money(grant, "remaining_payment")),
            ("Payment Status",            payment_status),
            ("Payment Reference",         _val(grant, "payment_reference")),
            ("Payment Date",              _val(grant, "payment_date")),
        ]))

    # ── Section 3: Key Dates ──────────────────────────────────────────────
    if show('dates'):
        story.append(Paragraph("KEY DATES", section_style))
        story.append(detail_table([
            ("Grant Receiving Date",         _val(grant, "grant_receiving_date")),
            ("Application Sent Date",        _val(grant, "grant_application_sent_date")),
            ("Dr. Zafar Signed",             _val(grant, "date_dr_zafar_signed_application")),
            ("Approval by Khaleeq Sb",       _val(grant, "date_of_approval_by_khaleeq_sb")),
            ("Email to Int. Chapter",        _val(grant, "date_of_email_to_int_chapter")),
        ]))

    # ── Section 4: Shipping & Documents ───────────────────────────────────
    if show('shipping'):
        ship_status = _val(grant, "shipping_documents_status")
        story.append(Paragraph("SHIPPING & DOCUMENTS", section_style))
        story.append(detail_table([
            ("Shipping Documents Status",  ship_status),
            ("Commercial Invoice No.",     _val(grant, "commercial_invoice_no")),
            ("Bill of Lading",             _val(grant, "bill_of_lading")),
            ("Packing List Reference",     _val(grant, "packing_list_reference")),
            ("Link to Shipping Docs",      _val(grant, "link_to_shipping_documents")),
            ("Link to Complete Docs",      _val(grant, "link_to_complete_documents")),
        ]))
        ship_comment = _val(grant, "shipping_documents_comment", "")
        if ship_comment and ship_comment != "—":
            story.append(Spacer(1, 6))
            story.append(notes_box(
                ship_comment, "SHIPPING NOTES",
                "#FEF9EC", "#E8A916"
            ))

    # ── Section 5: GRN / Receiving ────────────────────────────────────────
    if show('grn'):
        grn_status = _val(grant, "grn_receiving_status")
        story.append(Paragraph("GRN / RECEIVING", section_style))
        story.append(detail_table([
            ("GRN / Receiving Status", grn_status),
            ("Receiving Date",         _val(grant, "receiving_date")),
            ("GRN Number",             _val(grant, "grn_number")),
            ("Link to GRN",            _val(grant, "link_to_grn")),
        ]))
        grn_comment = _val(grant, "grn_receiving_comments", "")
        if grn_comment and grn_comment != "—":
            story.append(Spacer(1, 6))
            story.append(notes_box(
                grn_comment, "GRN COMMENTS",
                "#EEF3F8", "#D8DEE8"
            ))

    # ── Section 6: Installation & Location ───────────────────────────────
    if show('location'):
        story.append(Paragraph("INSTALLATION & LOCATION", section_style))
        story.append(detail_table([
            ("Installation Date", _val(grant, "installation_date")),
            ("Location",          _val(grant, "location")),
            ("Building Name",     _val(grant, "building_name")),
            ("Floor",             _val(grant, "floor")),
            ("Room",              _val(grant, "room")),
        ]))

    # ── Section 7: Item Details ───────────────────────────────────────────
    if show('item'):
        story.append(Paragraph("ITEM DETAILS", section_style))
        story.append(detail_table([
            ("Item Model",           _val(grant, "item_model")),
            ("Item Serial Number",   _val(grant, "item_serial_number")),
            ("Quantity",             _val(grant, "quantity")),
            ("IHHN Asset Tag No.",   _val(grant, "ihhn_asset_tag_number")),
            ("No. of Beneficiaries", _val(grant, "no_of_beneficiaries")),
        ]))
        item_desc = _val(grant, "item_description", "")
        if item_desc and item_desc != "—":
            story.append(Spacer(1, 6))
            story.append(notes_box(
                item_desc, "ITEM DESCRIPTION",
                "#EEF3F8", "#D8DEE8"
            ))

    # ── Section 8: Pictures ───────────────────────────────────────────────
    if show('pictures'):
        pic_status = _val(grant, "pictures_status")
        story.append(Paragraph("PICTURES", section_style))
        story.append(detail_table([
            ("Pictures' Status", pic_status),
            ("POC for Pictures", _val(grant, "poc_for_pictures")),
            ("Pictures Link",    _val(grant, "pictures")),
        ]))

    # ── Section 9: Report Status ──────────────────────────────────────────
    if show('report'):
        report_status = _val(grant, "report_status")
        story.append(Paragraph("REPORT STATUS", section_style))
        story.append(detail_table([
            ("Report Status",              report_status),
            ("Link to Utilization Report", _val(grant, "link_to_utilization_report")),
        ]))

    # ── Footer — always shown ─────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(
        width="100%", thickness=0.5,
        color=LINE, spaceAfter=8
    ))
    story.append(Paragraph(
        "Confidential — For internal use only. IHHN GrantFlow.",
        muted_style
    ))

    doc.build(story)
    return output_path