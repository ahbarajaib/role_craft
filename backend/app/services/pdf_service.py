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

        # 1. Try LibreOffice CLI if available on the system
        soffice_bin = shutil.which("soffice") or shutil.which("libreoffice")
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
        return self._render_pdf_reportlab(docx_path, pdf_path)

    def _render_pdf_reportlab(self, docx_path: Path, pdf_path: Path) -> Path:
        """Pure-python fallback to convert DOCX paragraphs into a PDF using ReportLab."""
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.units import inch

        doc = docx.Document(docx_path)
        pdf_doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=letter,
            leftMargin=0.5 * inch,
            rightMargin=0.5 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
        )

        styles = getSampleStyleSheet()

        style_heading = ParagraphStyle(
            "ResumeHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=6,
            spaceAfter=3,
        )

        style_body = ParagraphStyle(
            "ResumeBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#334155"),
            spaceBefore=2,
            spaceAfter=2,
        )

        style_bullet = ParagraphStyle(
            "ResumeBullet",
            parent=style_body,
            leftIndent=12,
            firstLineIndent=-8,
        )

        story = []

        try:
            for p in doc.paragraphs:
                raw_text = p.text.strip()
                if not raw_text:
                    continue

                style_name = p.style.name.lower() if p.style else ""
                is_heading = (
                    "heading" in style_name
                    or "title" in style_name
                    or raw_text.isupper()
                    or (len(raw_text) < 40 and not raw_text.endswith(".") and (raw_text.startswith("[") or ":" in raw_text))
                )

                # Format runs without breaking XML tags
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

                if is_heading:
                    heading_content = f"<b>{_escape_xml(raw_text.upper())}</b>"
                    story.append(Paragraph(heading_content, style_heading))
                    story.append(Spacer(1, 2))
                else:
                    if raw_text.startswith("•") or raw_text.startswith("-") or raw_text.startswith("*"):
                        clean_text = formatted_text.lstrip("•-* ").strip()
                        story.append(Paragraph(f"• {clean_text}", style_bullet))
                    else:
                        story.append(Paragraph(formatted_text, style_body))

            if not story:
                story.append(Paragraph("<b>Resume Document</b>", style_heading))

            pdf_doc.build(story)
            logger.info("Successfully generated PDF using ReportLab engine", path=str(pdf_path))
            return pdf_path

        except Exception as exc:
            logger.error("ReportLab generation failed on primary pass, attempting safe plain-text render", error=str(exc))
            # Safe Fallback: plain text without inline tags
            story = []
            for p in doc.paragraphs:
                raw_text = p.text.strip()
                if not raw_text:
                    continue
                safe_txt = _escape_xml(raw_text)
                if raw_text.isupper() or len(raw_text) < 30:
                    story.append(Paragraph(f"<b>{safe_txt}</b>", style_heading))
                else:
                    story.append(Paragraph(safe_txt, style_body))
            if not story:
                story.append(Paragraph("Resume Document", style_body))

            pdf_doc.build(story)
            return pdf_path
