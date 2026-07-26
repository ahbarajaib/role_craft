"""PDF rendering service.

Converts DOCX documents into clean, styled PDF files.

Primary Engine:
- Uses pure-python ReportLab + python-docx to render professional PDF documents
  without requiring external binary dependencies.
- If LibreOffice (`soffice`) is installed on the host system, it will automatically
  use `soffice --headless` for native binary conversion.
"""

import os
import re
import shutil
import subprocess
from pathlib import Path
import docx
from loguru import logger

from app.core.exceptions import NotFoundError


def _escape_xml(text: str) -> str:
    """Safely escape XML special characters."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class PDFService:
    """Service for converting DOCX resumes into downloadable PDF files."""

    def __init__(self, upload_dir: Path) -> None:
        self._upload_dir = upload_dir

    def convert_docx_to_pdf(self, docx_path: Path, pdf_path: Path) -> Path:
        """Convert a DOCX file at docx_path into a PDF file at pdf_path."""
        if not docx_path.exists():
            raise NotFoundError(f"Source DOCX document '{docx_path.name}' not found.")

        pdf_path.parent.mkdir(parents=True, exist_ok=True)

        # 1. Try LibreOffice CLI if available on the system (including standard macOS app path)
        mac_soffice = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")
        soffice_bin = shutil.which("soffice") or shutil.which("libreoffice") or (str(mac_soffice) if mac_soffice.exists() else None)
        if soffice_bin:
            try:
                cmd = [
                    soffice_bin,
                    "--headless",
                    "--convert-to",
                    "pdf",
                    str(docx_path),
                    "--outdir",
                    str(pdf_path.parent),
                ]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                generated_pdf = pdf_path.parent / f"{docx_path.stem}.pdf"
                if res.returncode == 0 and generated_pdf.exists():
                    if generated_pdf != pdf_path:
                        shutil.move(generated_pdf, pdf_path)
                    logger.info("Successfully converted DOCX to PDF using LibreOffice CLI", path=str(pdf_path))
                    return pdf_path
            except Exception as exc:
                logger.warning("LibreOffice CLI conversion failed, falling back to ReportLab", error=str(exc))

        # 2. Universal Python Fallback using ReportLab + python-docx
        try:
            return self._render_pdf_reportlab(docx_path, pdf_path)
        except Exception as exc:
            logger.error("PDF conversion failed", error=str(exc), path=str(docx_path))
            raise BadRequestError(
                f"PDF generation failed for this document: {str(exc)}. Please download the DOCX version or contact support."
            )

    def _render_pdf_reportlab(self, docx_path: Path, pdf_path: Path) -> Path:
        """Pure-python fallback to convert DOCX paragraphs into a PDF using ReportLab with high-fidelity formatting."""
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import inch
        from docx.oxml.ns import qn

        doc = docx.Document(docx_path)
        pdf_doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=letter,
            leftMargin=0.4 * inch,
            rightMargin=0.4 * inch,
            topMargin=0.4 * inch,
            bottomMargin=0.4 * inch,
        )

        styles = getSampleStyleSheet()

        # Helper to extract shading fill color from paragraph XML
        def _get_p_shading_color(p) -> str | None:
            try:
                pPr = p._p.find(qn("w:pPr"))
                if pPr is not None:
                    shd = pPr.find(qn("w:shd"))
                    if shd is not None:
                        fill = shd.get(qn("w:fill"))
                        if fill and fill != "auto":
                            return f"#{fill}"
            except Exception:
                pass
            return None

        # Custom styles matching resume DOCX font hierarchy & colors
        style_name = ParagraphStyle(
            "CandidateName",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            alignment=1,  # Center
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=2,
        )

        style_subtitle = ParagraphStyle(
            "CandidateSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            alignment=1,  # Center
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=2,
        )

        style_contact = ParagraphStyle(
            "CandidateContact",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=1,  # Center
            textColor=colors.HexColor("#475569"),
            spaceAfter=6,
        )

        style_section_banner = ParagraphStyle(
            "SectionBanner",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            alignment=1,  # Center
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=0,
            spaceAfter=0,
        )

        style_job_title = ParagraphStyle(
            "JobTitleHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=4,
            spaceAfter=1,
        )

        style_company = ParagraphStyle(
            "CompanyHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#334155"),
            spaceBefore=0,
            spaceAfter=2,
        )

        style_body = ParagraphStyle(
            "ResumeBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12.5,
            textColor=colors.HexColor("#334155"),
            spaceBefore=1.5,
            spaceAfter=1.5,
        )

        style_bullet = ParagraphStyle(
            "ResumeBullet",
            parent=style_body,
            leftIndent=14,
            firstLineIndent=-10,
            spaceBefore=1.5,
            spaceAfter=1.5,
        )

        story = []

        try:
            total_paras = len(doc.paragraphs)

            for idx, p in enumerate(doc.paragraphs):
                raw_text = p.text.strip()
                if not raw_text:
                    continue

                style_name_raw = p.style.name.lower() if p.style else ""
                shading_hex = _get_p_shading_color(p)

                # Format runs preserving bold/italic
                html_runs = []
                for run in p.runs:
                    r_text = _escape_xml(run.text)
                    if not r_text:
                        continue
                    if run.bold:
                        r_text = f"<b>{r_text}</b>"
                    if run.italic:
                        r_text = f"<i>{r_text}</i>"
                    html_runs.append(r_text)

                formatted_text = "".join(html_runs) if html_runs else _escape_xml(raw_text)

                # 1. Candidate Name Header (Top Line)
                if idx == 0 and len(raw_text) < 50:
                    story.append(Paragraph(formatted_text, style_name))
                    continue

                # 2. Subtitle / Target Title (Top 1-3 lines)
                if idx in (1, 2) and ("heading 1" in style_name_raw or idx == 1):
                    if "@" in raw_text or "http" in raw_text or ("|" in raw_text and len(raw_text) > 40):
                        story.append(Paragraph(formatted_text, style_contact))
                    else:
                        story.append(Paragraph(formatted_text, style_subtitle))
                    continue

                if idx in (2, 3) and ("@" in raw_text or "http" in raw_text or "linkedin" in raw_text):
                    story.append(Paragraph(formatted_text, style_contact))
                    continue

                # 3. Section Banners (e.g. Professional Summary, Technical Skills, Professional Experiences)
                is_banner = (
                    shading_hex is not None
                    or raw_text in ["Professional Summary", "Technical Skills", "Professional Experiences", "Projects", "Education"]
                    or ("heading" in style_name_raw and len(raw_text) < 40 and not raw_text.startswith("•"))
                )

                if is_banner and len(raw_text) < 45:
                    # Use extracted XML shading color if available, or fall back to soft blue fill
                    banner_color = colors.HexColor(shading_hex) if shading_hex else colors.HexColor("#93c5fd")
                    banner_p = Paragraph(f"<b>{_escape_xml(raw_text)}</b>", style_section_banner)
                    banner_table = Table(
                        [[banner_p]],
                        colWidths=[7.2 * inch],
                    )
                    banner_table.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, -1), banner_color),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ]))
                    story.append(Spacer(1, 4))
                    story.append(banner_table)
                    story.append(Spacer(1, 4))
                    continue

                # 4. Job Role Title Header Line (Heading 2 / Heading 3)
                if "heading 2" in style_name_raw or "heading 3" in style_name_raw:
                    story.append(Paragraph(formatted_text, style_job_title))
                    continue

                # 5. Company / Metadata Line
                lower_line = raw_text.lower()
                is_company = (
                    (raw_text.endswith(".") or "," in raw_text)
                    and any(c in lower_line for c in ["fze", "llc", "ltd", "inc", "dubai", "bangalore", "india", "remote", "freelance"])
                    and len(raw_text) < 80
                )
                if is_company:
                    story.append(Paragraph(formatted_text, style_company))
                    continue

                # 6. Bullets vs Body
                bullet_symbols = ["•", "-", "*", "–", "—", "▪", "▸"]
                is_bullet = any(raw_text.startswith(s) for s in bullet_symbols)

                if is_bullet:
                    bullet_match = next((s for s in bullet_symbols if raw_text.startswith(s)), None)
                    clean_text = formatted_text
                    if bullet_match:
                        # strip bullet symbol from start of formatted text
                        clean_text = formatted_text.lstrip(bullet_match + " ").strip()
                    story.append(Paragraph(f"• &nbsp; {clean_text}", style_bullet))
                else:
                    story.append(Paragraph(formatted_text, style_body))

            if not story:
                story.append(Paragraph("<b>Resume Document</b>", style_body))

            pdf_doc.build(story)
            logger.info("Successfully generated PDF using ReportLab engine", path=str(pdf_path))
            return pdf_path

        except Exception as exc:
            logger.error("ReportLab generation failed on primary pass, attempting safe plain-text render", error=str(exc))
            story = []
            for p in doc.paragraphs:
                raw_text = p.text.strip()
                if not raw_text:
                    continue
                safe_txt = _escape_xml(raw_text)
                story.append(Paragraph(safe_txt, style_body))

            pdf_doc.build(story)
            return pdf_path
