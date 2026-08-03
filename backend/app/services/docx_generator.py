"""DOCX Generator for PDF-to-DOCX conversion.

Generates a clean, minimal, professional, ATS-optimized DOCX document from
a ParsedPdfResult.

Design Specification (Clean Minimal with Accent Color):
- Font: Calibri / Arial (Universal, ATS-safe)
- Primary Accent Color: #1B4F72 (Deep Professional Blue)
- Body Text: #222222 (Near Black)
- Layout: 1-Column, standard 1-inch margins
- Structure:
  - Header: Candidate Name (18pt Bold, Accent) + Contact Line (9.5pt Muted)
  - Section Headings: 11pt Bold, ALL CAPS, Accent Color, Bottom Border / Divider
  - Bullets: Native Word bullet format with proper indentation
  - Metadata: Bold job titles / degree names with regular dates
"""

from __future__ import annotations

import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import qn, nsdecls
from loguru import logger

from app.parsers.pdf_parser import ParsedPdfResult, ParsedPdfSection


# ── Styling Constants ──────────────────────────────────────────────────────────

FONT_NAME = "Calibri"
COLOR_ACCENT = RGBColor(0x1B, 0x4F, 0x72)   # Deep Blue #1B4F72
COLOR_BODY = RGBColor(0x22, 0x22, 0x22)     # Near Black
COLOR_MUTED = RGBColor(0x55, 0x55, 0x55)    # Slate Gray

BULLET_CHARACTERS = ["•", "-", "*", "–", "—", "▪", "▸"]


# ── Low-level XML Helpers ─────────────────────────────────────────────────────


def _add_bottom_border(paragraph, color_hex: str = "1B4F72", size: str = "12"):
    """Add a clean horizontal accent line under a heading paragraph in Word XML."""
    pPr = paragraph._p.get_or_add_pPr()
    pbdr = parse_xml(
        f'<w:pBdr {nsdecls("w")}>'
        f'  <w:bottom w:val="single" w:sz="{size}" w:space="4" w:color="{color_hex}"/>'
        f'</w:pBdr>'
    )
    pPr.append(pbdr)


# ── Public API ────────────────────────────────────────────────────────────────


def generate_docx_bytes(parsed: ParsedPdfResult) -> bytes:
    """Generate a clean, professional, ATS-optimized DOCX file from parsed PDF content.

    Parameters
    ----------
    parsed:
        ParsedPdfResult containing candidate name, contact line, and sections.

    Returns
    -------
    bytes
        Binary contents of the generated `.docx` document.
    """
    doc = docx.Document()

    # Set 1-inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Base Normal Style Configuration
    normal_style = doc.styles["Normal"]
    normal_style.font.name = FONT_NAME
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = COLOR_BODY
    normal_style.paragraph_format.space_after = Pt(3)
    normal_style.paragraph_format.space_before = Pt(0)
    normal_style.paragraph_format.line_spacing = 1.15

    # ── 1. HEADER (Candidate Name & Contact Details) ──────────────────────────
    if parsed.candidate_name:
        p_name = doc.add_paragraph()
        p_name.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_name.paragraph_format.space_after = Pt(2)
        p_name.paragraph_format.space_before = Pt(0)
        run_name = p_name.add_run(parsed.candidate_name)
        run_name.font.name = FONT_NAME
        run_name.font.size = Pt(18)
        run_name.font.bold = True
        run_name.font.color.rgb = COLOR_ACCENT

    if parsed.contact_line:
        p_contact = doc.add_paragraph()
        p_contact.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_contact.paragraph_format.space_after = Pt(12)
        run_contact = p_contact.add_run(parsed.contact_line)
        run_contact.font.name = FONT_NAME
        run_contact.font.size = Pt(9.5)
        run_contact.font.color.rgb = COLOR_MUTED

    # ── 2. SECTIONS ───────────────────────────────────────────────────────────
    for sec in parsed.sections:
        if not sec.heading and not sec.content_lines:
            continue

        # Add Section Heading
        if sec.heading:
            p_head = doc.add_paragraph()
            p_head.paragraph_format.space_before = Pt(12)
            p_head.paragraph_format.space_after = Pt(4)
            p_head.paragraph_format.keep_with_next = True

            run_head = p_head.add_run(sec.heading.upper())
            run_head.font.name = FONT_NAME
            run_head.font.size = Pt(11)
            run_head.font.bold = True
            run_head.font.color.rgb = COLOR_ACCENT

            _add_bottom_border(p_head, color_hex="1B4F72", size="8")

        # Add Content Lines
        for line in sec.content_lines:
            line_str = line.strip()
            if not line_str:
                continue

            is_bullet = any(line_str.startswith(b) for b in BULLET_CHARACTERS)
            clean_text = line_str
            if is_bullet:
                for b in BULLET_CHARACTERS:
                    if clean_text.startswith(b):
                        clean_text = clean_text[len(b):].strip()
                        break

            if is_bullet:
                p_item = doc.add_paragraph(style="List Bullet")
                p_item.paragraph_format.space_before = Pt(0)
                p_item.paragraph_format.space_after = Pt(2.5)
                p_item.paragraph_format.line_spacing = 1.1
                r = p_item.add_run(clean_text)
                r.font.name = FONT_NAME
                r.font.size = Pt(10)
                r.font.color.rgb = COLOR_BODY
            else:
                p_item = doc.add_paragraph()
                p_item.paragraph_format.space_before = Pt(0)
                p_item.paragraph_format.space_after = Pt(3)

                # Check if line contains a category prefix (e.g. "Languages: Python, JavaScript...")
                colon_idx = clean_text.find(":")
                if 0 < colon_idx < 40 and not clean_text.lower().startswith("http"):
                    label = clean_text[: colon_idx + 1]
                    rest = clean_text[colon_idx + 1 :]
                    r_lbl = p_item.add_run(label)
                    r_lbl.font.name = FONT_NAME
                    r_lbl.font.size = Pt(10)
                    r_lbl.font.bold = True
                    r_lbl.font.color.rgb = COLOR_BODY

                    r_rest = p_item.add_run(rest)
                    r_rest.font.name = FONT_NAME
                    r_rest.font.size = Pt(10)
                    r_rest.font.color.rgb = COLOR_BODY
                else:
                    r = p_item.add_run(clean_text)
                    r.font.name = FONT_NAME
                    r.font.size = Pt(10)
                    r.font.color.rgb = COLOR_BODY

    # Save to BytesIO stream
    import io
    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)
    logger.info("Generated clean DOCX from PDF content", byte_count=len(stream.getvalue()))
    return stream.getvalue()
