"""PDF rendering service.

Converts DOCX documents into clean, styled PDF files.

Primary Engine:
- Uses pure-python ReportLab + python-docx to render professional PDF documents
  without requiring external binary dependencies.
- If LibreOffice (`soffice`) is installed on the host system, it will automatically
  use `soffice --headless` for native binary conversion.
"""

import os
import shutil
import subprocess
from pathlib import Path
import docx
from loguru import logger

from app.core.exceptions import NotFoundError


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
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
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

        # Custom styles for resume elements
        style_heading = ParagraphStyle(
            "ResumeHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=8,
            spaceAfter=4,
            borderPadding=(0, 0, 2, 0),
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

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            # Determine if this paragraph is a section header or bullet point
            style_name = p.style.name.lower() if p.style else ""
            is_heading = (
                "heading" in style_name
                or "title" in style_name
                or text.isupper()
                or (len(text) < 40 and not text.endswith(".") and (text.startswith("[") or ":" in text))
            )

            # Format runs to HTML for ReportLab Paragraph (support <b>, <i>)
            html_runs = []
            for run in p.runs:
                r_text = run.text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                if not r_text:
                    continue
                if run.bold:
                    r_text = f"<b>{r_text}</b>"
                if run.italic:
                    r_text = f"<i>{r_text}</i>"
                html_runs.append(r_text)

            formatted_text = "".join(html_runs) if html_runs else text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

            if is_heading:
                # Add horizontal divider or bold heading
                story.append(Paragraph(f"<b>{formatted_text.upper()}</b>", style_heading))
                story.append(Spacer(1, 2))
            else:
                if text.startswith("•") or text.startswith("-") or text.startswith("*"):
                    clean_text = formatted_text.lstrip("•-* ").strip()
                    story.append(Paragraph(f"• {clean_text}", style_bullet))
                else:
                    story.append(Paragraph(formatted_text, style_body))

        pdf_doc.build(story)
        logger.info("Successfully generated PDF using ReportLab engine", path=str(pdf_path))
        return pdf_path
