"""PDF rendering service.

Converts DOCX documents into clean, styled PDF files.

Primary Engine:
- Uses pure-python ReportLab + python-docx to render professional PDF documents
  without requiring external binary dependencies.
- If LibreOffice (`soffice`) is installed on the host system, it will automatically
  use `soffice --headless` for native binary conversion.
"""

import contextlib
import re
import shutil
import subprocess
from pathlib import Path

import docx
from loguru import logger

from app.core.exceptions import BadRequestError, NotFoundError


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
                else:
                    logger.warning(
                        "LibreOffice CLI exited with non-zero code or PDF not generated, falling back to ReportLab",
                        returncode=res.returncode,
                        stdout=res.stdout,
                        stderr=res.stderr,
                    )
            except Exception as exc:
                logger.warning("LibreOffice CLI conversion failed, falling back to ReportLab", error=str(exc))

        # 2. Universal Python Fallback using ReportLab + python-docx
        try:
            return self._render_pdf_reportlab(docx_path, pdf_path)
        except Exception as exc:
            logger.error("PDF conversion failed", error=str(exc), path=str(docx_path))
            raise BadRequestError(
                f"PDF generation failed for this document: {exc!s}. Please download the DOCX version or contact support."
            )

    def _render_pdf_reportlab(self, docx_path: Path, pdf_path: Path) -> Path:
        """Pure-python fallback to convert DOCX paragraphs into a PDF using ReportLab with high-fidelity formatting."""
        from docx.oxml.ns import qn
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

        doc = docx.Document(docx_path)

        # Check if document is a Cover Letter
        is_cover_letter = "cover" in docx_path.name.lower() or any(
            p.text.strip().lower().startswith("dear ") for p in doc.paragraphs
        )
        if is_cover_letter:
            return self._render_cover_letter_pdf_reportlab(doc, pdf_path)

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

        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        # Register custom TTF fonts if present in backend/app/fonts/
        fonts_dir = Path(__file__).parent.parent / "fonts"
        font_regular = "Helvetica"
        font_bold = "Helvetica-Bold"

        if fonts_dir.exists():
            for fname, reg_name in [
                ("Aptos.ttf", "Aptos"),
                ("Aptos-Bold.ttf", "Aptos-Bold"),
                ("Calibri.ttf", "Calibri"),
                ("Calibrib.ttf", "Calibri-Bold"),
                ("Arial.ttf", "ArialCustom"),
                ("Arial Bold.ttf", "ArialCustom-Bold"),
            ]:
                fpath = fonts_dir / fname
                if fpath.exists():
                    with contextlib.suppress(Exception):
                        pdfmetrics.registerFont(TTFont(reg_name, str(fpath)))

            # Detect document primary font family
            for p in doc.paragraphs:
                for r in p.runs:
                    if r.font and r.font.name:
                        fn = r.font.name.strip().lower()
                        if "aptos" in fn and (fonts_dir / "Aptos.ttf").exists():
                            font_regular = "Aptos"
                            font_bold = "Aptos-Bold" if (fonts_dir / "Aptos-Bold.ttf").exists() else "Aptos"
                            break
                        elif "calibri" in fn and (fonts_dir / "Calibri.ttf").exists():
                            font_regular = "Calibri"
                            font_bold = "Calibri-Bold" if (fonts_dir / "Calibrib.ttf").exists() else "Calibri"
                            break
                        elif "arial" in fn and (fonts_dir / "Arial.ttf").exists():
                            font_regular = "ArialCustom"
                            font_bold = "ArialCustom-Bold" if (fonts_dir / "Arial Bold.ttf").exists() else "ArialCustom"
                            break
                if font_regular != "Helvetica":
                    break

        # Custom styles matching resume DOCX font hierarchy & colors
        style_name = ParagraphStyle(
            "CandidateName",
            parent=styles["Normal"],
            fontName=font_bold,
            fontSize=18,
            leading=22,
            alignment=1,  # Center
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=2,
        )

        style_subtitle = ParagraphStyle(
            "CandidateSubTitle",
            parent=styles["Normal"],
            fontName=font_bold,
            fontSize=11,
            leading=14,
            alignment=1,  # Center
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=2,
        )

        style_contact = ParagraphStyle(
            "CandidateContact",
            parent=styles["Normal"],
            fontName=font_regular,
            fontSize=9,
            leading=12,
            alignment=1,  # Center
            textColor=colors.HexColor("#475569"),
            spaceAfter=6,
        )

        style_section_banner = ParagraphStyle(
            "SectionBanner",
            parent=styles["Normal"],
            fontName=font_bold,
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
            fontName=font_bold,
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=4,
            spaceAfter=1,
        )

        style_company = ParagraphStyle(
            "CompanyHeader",
            parent=styles["Normal"],
            fontName=font_bold,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#334155"),
            spaceBefore=0,
            spaceAfter=2,
        )

        style_body = ParagraphStyle(
            "ResumeBody",
            parent=styles["Normal"],
            fontName=font_regular,
            fontSize=9,
            leading=12.5,
            textColor=colors.HexColor("#334155"),
            spaceBefore=1.5,
            spaceAfter=1.5,
        )

        style_bullet = ParagraphStyle(
            "ResumeBullet",
            parent=styles["Normal"],
            fontName=font_regular,
            fontSize=9,
            leading=12.5,
            textColor=colors.HexColor("#334155"),
            spaceBefore=1,
            spaceAfter=1,
            leftIndent=12,
            firstLineIndent=-12,
        )

        def _is_docx_bullet(p, text: str) -> bool:
            bullet_symbols = ["•", "-", "*", "–", "—", "▪", "▸", "\u2022"]
            if any(text.startswith(s) for s in bullet_symbols):
                return True
            try:
                pPr = p._p.get_or_add_pPr()
                if pPr.find(qn("w:numPr")) is not None:
                    return True
                if p.style and ("list" in p.style.name.lower() or "bullet" in p.style.name.lower()):
                    return True
            except Exception:
                pass
            return False

        KNOWN_MAIN_SECTIONS = {
            "professional summary", "summary", "profile", "executive summary", "about me",
            "core technical skills", "technical skills", "skills & competencies", "skills", "technologies", "core competencies",
            "professional experience", "professional experiences", "work experience", "experience", "employment history", "career progression", "career history",
            "quantified achievements", "key achievements", "selected achievements", "achievements", "accomplishments", "highlights",
            "selected projects", "projects", "featured projects", "personal projects", "key projects",
            "education", "academic background", "education & credentials", "academic qualifications",
            "certifications", "licenses & certifications", "certifications & training", "courses", "trainings"
        }

        # Helper to split job title and date (e.g., "Wordpress Developer Feb 2025 – Present")
        date_pattern = re.compile(
            r'(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\b20\d{2})\s*[\u2013\u2014\-]\s*(Present|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\b20\d{2})',
            re.IGNORECASE
        )

        style_job_left = ParagraphStyle(
            "JobTitleLeft",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#0f172a"),
        )
        style_job_right = ParagraphStyle(
            "JobTitleRight",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            alignment=2,  # Right align
            textColor=colors.HexColor("#0f172a"),
        )

        story = []

        try:
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

                # 2. Subtitle / Contact Info (Top 1-3 lines)
                if idx in (1, 2) and ("heading 1" in style_name_raw or idx == 1):
                    if "@" in raw_text or "http" in raw_text or ("|" in raw_text and len(raw_text) > 40):
                        story.append(Paragraph(formatted_text, style_contact))
                    else:
                        story.append(Paragraph(formatted_text, style_subtitle))
                    continue

                if idx in (2, 3) and ("@" in raw_text or "http" in raw_text or "linkedin" in raw_text):
                    story.append(Paragraph(formatted_text, style_contact))
                    continue

                # 3. Check BULLETS FIRST to prevent bullets from being misclassified as banners/headings
                if _is_docx_bullet(p, raw_text):
                    bullet_symbols = ["•", "-", "*", "–", "—", "▪", "▸", "\u2022"]
                    clean_text = formatted_text
                    bullet_match = next((s for s in bullet_symbols if raw_text.startswith(s)), None)
                    if bullet_match:
                        clean_text = formatted_text.lstrip(bullet_match + " ").strip()
                    story.append(Paragraph(f"• &nbsp; {clean_text}", style_bullet))
                    continue

                # 4. Main Section Banners (Professional Summary, Core Technical Skills, Achievements, Education, etc.)
                clean_lower = raw_text.lower().strip()
                is_heading_style = "heading 1" in style_name_raw or "heading 2" in style_name_raw or "heading" in style_name_raw
                is_all_caps = raw_text.isupper() and len(raw_text) > 3 and len(raw_text) < 45
                is_known_banner = clean_lower in KNOWN_MAIN_SECTIONS or any(clean_lower.startswith(sec) for sec in KNOWN_MAIN_SECTIONS)

                is_main_banner = (
                    is_known_banner
                    or (shading_hex is not None and len(raw_text) < 50 and not date_pattern.search(raw_text))
                    or (is_all_caps and not date_pattern.search(raw_text))
                    or (is_heading_style and len(raw_text) < 50 and not raw_text.endswith(".") and not date_pattern.search(raw_text))
                )

                if is_main_banner and len(raw_text) < 60:
                    banner_color = colors.HexColor(shading_hex) if shading_hex else colors.HexColor("#e2e8f0")
                    banner_p = Paragraph(f"<b>{_escape_xml(raw_text.upper())}</b>", style_section_banner)
                    banner_table = Table(
                        [[banner_p]],
                        colWidths=[7.2 * inch],
                    )
                    banner_table.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, -1), banner_color),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ]))
                    story.append(Spacer(1, 6))
                    story.append(banner_table)
                    story.append(Spacer(1, 4))
                    continue

                # 5. Job Role Titles with Dates (e.g. "Wordpress Developer Feb 2025 – Present")
                match_date = date_pattern.search(raw_text)
                if match_date or "heading 2" in style_name_raw or "heading 3" in style_name_raw:
                    if match_date:
                        date_start = match_date.start()
                        role_part = raw_text[:date_start].strip()
                        date_part = raw_text[date_start:].strip()

                        if role_part:
                            role_p = Paragraph(f"<b>{_escape_xml(role_part)}</b>", style_job_left)
                            date_p = Paragraph(f"<b>{_escape_xml(date_part)}</b>", style_job_right)
                            job_table = Table([[role_p, date_p]], colWidths=[5.0 * inch, 2.2 * inch])
                            job_table.setStyle(TableStyle([
                                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                ("TOPPADDING", (0, 0), (-1, -1), 3),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                            ]))
                            story.append(job_table)
                            continue

                    story.append(Paragraph(formatted_text, style_job_title))
                    continue

                # 6. Company / Metadata Line
                lower_line = raw_text.lower()
                is_company = (
                    (raw_text.endswith(".") or "," in raw_text)
                    and any(c in lower_line for c in ["fze", "llc", "ltd", "inc", "dubai", "bangalore", "india", "remote", "freelance", "project"])
                    and len(raw_text) < 90
                )
                if is_company:
                    story.append(Paragraph(formatted_text, style_company))
                    continue

                # 7. Fallback Body Paragraph
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

    def _render_cover_letter_pdf_reportlab(self, doc: docx.Document, pdf_path: Path) -> Path:
        """Render a cover letter DOCX into a high-fidelity, beautifully styled PDF matching executive DOCX formatting."""
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import Paragraph, SimpleDocTemplate

        pdf_doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=letter,
            leftMargin=0.85 * inch,
            rightMargin=0.85 * inch,
            topMargin=0.8 * inch,
            bottomMargin=0.8 * inch,
        )

        styles = getSampleStyleSheet()

        style_cl_name = ParagraphStyle(
            "CLName",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            alignment=0,  # Left aligned
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=2,
        )

        style_cl_role = ParagraphStyle(
            "CLRole",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            alignment=0,  # Left aligned
            textColor=colors.HexColor("#475569"),
            spaceAfter=4,
        )

        style_cl_contact = ParagraphStyle(
            "CLContact",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            alignment=0,  # Left aligned
            textColor=colors.HexColor("#64748B"),
            spaceAfter=16,
        )

        style_cl_date = ParagraphStyle(
            "CLDate",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            alignment=0,
            textColor=colors.HexColor("#334155"),
            spaceAfter=12,
        )

        style_cl_salutation = ParagraphStyle(
            "CLSalutation",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            alignment=0,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=8,
            spaceAfter=10,
        )

        style_cl_body = ParagraphStyle(
            "CLBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            alignment=0,
            textColor=colors.HexColor("#334155"),
            spaceAfter=10,
        )

        style_cl_signoff = ParagraphStyle(
            "CLSignoff",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=11,
            leading=15,
            alignment=0,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=14,
            spaceAfter=4,
        )

        story = []
        non_empty_paras = [p for p in doc.paragraphs if p.text.strip()]

        for idx, p in enumerate(non_empty_paras):
            text = p.text.strip()
            escaped_text = _escape_xml(text)

            html_runs = []
            for run in p.runs:
                r_txt = _escape_xml(run.text)
                if not r_txt:
                    continue
                if run.bold:
                    r_txt = f"<b>{r_txt}</b>"
                if run.italic:
                    r_txt = f"<i>{r_txt}</i>"
                html_runs.append(r_txt)
            if html_runs:
                escaped_text = "".join(html_runs)

            lower_text = text.lower()

            if idx == 0:
                story.append(Paragraph(escaped_text, style_cl_name))
            elif idx == 1 and not lower_text.startswith("dear ") and "@" not in lower_text:
                story.append(Paragraph(escaped_text, style_cl_role))
            elif (idx == 2 or idx == 1) and ("|" in lower_text or "@" in lower_text or "http" in lower_text or "linkedin" in lower_text):
                story.append(Paragraph(escaped_text, style_cl_contact))
            elif lower_text.startswith("dear ") or lower_text.startswith("to the "):
                story.append(Paragraph(escaped_text, style_cl_salutation))
            elif lower_text.startswith("sincerely") or lower_text.startswith("best regards") or lower_text.startswith("warm regards"):
                story.append(Paragraph(escaped_text, style_cl_signoff))
            elif any(month in lower_text for month in ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]) and len(text) < 25:
                story.append(Paragraph(escaped_text, style_cl_date))
            else:
                story.append(Paragraph(escaped_text, style_cl_body))

        if not story:
            story.append(Paragraph("Cover Letter", style_cl_body))

        pdf_doc.build(story)
        logger.info("Successfully generated executive cover letter PDF via ReportLab", path=str(pdf_path))
        return pdf_path
