"""Resume Parser Service.

Parses raw resume files (DOCX or PDF) into a normalized `StructuredResume` object.
Handles text extraction, formatting signal detection, AI schema parsing via OpenAI,
confidence evaluation, and template matching.
"""

from pathlib import Path
from typing import Optional
from loguru import logger
import docx
import pymupdf as fitz  # PyMuPDF

from app.ai.provider import OpenAIProvider
from app.ai.resume_parser_prompts import (
    PARSE_RESUME_SYSTEM_INSTRUCTIONS,
    build_parse_resume_input,
)
from app.core.exceptions import BadRequestError
from app.schemas.structured_resume import (
    ParseConfidence,
    StructuredResume,
    StructuredResumeParseModel,
    convert_parsed_to_structured,
)


class ResumeParserService:
    """Service to parse DOCX and PDF documents into structured resume JSON."""

    def __init__(self, ai_provider: OpenAIProvider) -> None:
        self._ai = ai_provider

    def extract_text_from_file(self, file_path: Path) -> tuple[str, str]:
        """Extract raw text from a DOCX or PDF file.

        Returns (raw_text, format_type) where format_type is 'docx' or 'pdf'.
        """
        if not file_path.exists():
            raise BadRequestError(f"File not found: {file_path.name}")

        ext = file_path.suffix.lower()
        if ext == ".docx":
            text = self._extract_docx_text(file_path)
            return text, "docx"
        elif ext == ".pdf":
            text = self._extract_pdf_text(file_path)
            return text, "pdf"
        else:
            raise BadRequestError("Unsupported file type. Only .docx and .pdf files are supported.")

    def _extract_docx_text(self, file_path: Path) -> str:
        """Extract text from DOCX paragraphs and tables preserving structural lines and hyperlink URLs."""
        try:
            doc = docx.Document(file_path)
            lines: list[str] = []

            for p in doc.paragraphs:
                txt = p.text.strip()
                if not txt:
                    continue

                # Extract embedded hyperlink URLs in this paragraph
                urls: list[str] = []
                try:
                    for child in p._element.xpath('.//*[local-name()="hyperlink"]'):
                        r_id = child.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                        if r_id and r_id in p.part.rels:
                            target = p.part.rels[r_id].target_ref
                            if target and target not in txt:
                                urls.append(target)
                except Exception:
                    pass

                line_content = txt
                if urls:
                    line_content += f" ({', '.join(urls)})"

                has_bold = any(run.bold for run in p.runs if run.text.strip())
                if has_bold and len(txt) < 80:
                    lines.append(f"[BOLD] {line_content}")
                else:
                    lines.append(line_content)

            # Also extract tables
            for table in doc.tables:
                for row in table.rows:
                    row_txt = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_txt:
                        lines.append(row_txt)

            return "\n".join(lines)
        except Exception as exc:
            logger.error("Failed to parse DOCX text", error=str(exc), path=str(file_path))
            raise BadRequestError(f"Failed to read Word document: {str(exc)}")

    def _extract_pdf_text(self, file_path: Path) -> str:
        """Extract text from PDF pages using PyMuPDF, including link annotations."""
        try:
            doc = fitz.open(file_path)
            lines: list[str] = []
            for page in doc:
                text = page.get_text("text")
                page_links: list[str] = []
                try:
                    for link in page.get_links():
                        uri = link.get("uri")
                        if uri and uri not in text:
                            page_links.append(uri)
                except Exception:
                    pass

                if text.strip():
                    lines.append(text.strip())
                if page_links:
                    lines.append("Links: " + ", ".join(page_links))
            doc.close()
            return "\n\n".join(lines)
        except Exception as exc:
            logger.error("Failed to parse PDF text", error=str(exc), path=str(file_path))
            raise BadRequestError(f"Failed to read PDF document: {str(exc)}")

    def detect_docx_template_match(self, file_path: Path) -> Optional[str]:
        """Check if uploaded DOCX font/style matches one of our 3 ATS templates.

        - clean_classic: Times New Roman or Garamond font
        - modern_professional: Calibri or Arial font with horizontal lines or shading
        - executive_profile: Aptos or Calibri font
        """
        if file_path.suffix.lower() != ".docx":
            return None

        try:
            doc = docx.Document(file_path)
            fonts: set[str] = set()

            for p in doc.paragraphs[:20]:
                for r in p.runs:
                    if r.font and r.font.name:
                        fonts.add(r.font.name.lower())

            font_str = " ".join(fonts)
            if "times" in font_str or "garamond" in font_str or "georgia" in font_str:
                return "clean_classic"
            elif "aptos" in font_str:
                return "executive_profile"
            elif "calibri" in font_str or "arial" in font_str:
                return "modern_professional"
            return "clean_classic"
        except Exception:
            return None

    def parse_document(self, file_path: Path, filename: str) -> StructuredResume:
        """Extract text from file and parse into StructuredResume JSON using AI."""
        raw_text, format_type = self.extract_text_from_file(file_path)

        if len(raw_text.strip()) < 50:
            raise BadRequestError("Extracted resume text is too short or empty.")

        input_prompt = build_parse_resume_input(raw_text, filename)

        try:
            parsed_raw = self._ai.parse_response(
                instructions=PARSE_RESUME_SYSTEM_INSTRUCTIONS,
                input_text=input_prompt,
                response_format=StructuredResumeParseModel,
            )
            parsed = convert_parsed_to_structured(parsed_raw)
        except Exception as exc:
            logger.error("AI parse failed, building fallback structured resume", error=str(exc))
            raise BadRequestError(f"Failed to parse resume content with AI: {str(exc)}")

        parsed.source_format = format_type
        if format_type == "docx":
            parsed.preferred_template = self.detect_docx_template_match(file_path)
        else:
            # For PDF, layout cannot be directly retained, user will pick a template
            parsed.preferred_template = None

        # Post-process low confidence fields if any required fields are empty
        low_conf = list(parsed.parse_confidence.low_confidence_fields) if parsed.parse_confidence else []

        if not parsed.contact_info.full_name:
            low_conf.append("contact_info.full_name")
        if not parsed.contact_info.email:
            low_conf.append("contact_info.email")
        if not parsed.contact_info.phone:
            low_conf.append("contact_info.phone")

        for idx, sec in enumerate(parsed.sections):
            if sec.section_type == "experience":
                entries = sec.content.get("entries", [])
                for e_idx, entry in enumerate(entries):
                    if isinstance(entry, dict):
                        if not entry.get("job_title"):
                            low_conf.append(f"sections.{idx}.content.entries.{e_idx}.job_title")
                        if not entry.get("company"):
                            low_conf.append(f"sections.{idx}.content.entries.{e_idx}.company")

        # Unique deduplicated low confidence list
        unique_low_conf = list(dict.fromkeys(low_conf))
        parsed.parse_confidence = ParseConfidence(
            low_confidence_fields=unique_low_conf,
            overall_confidence=0.7 if unique_low_conf else 1.0,
        )

        return parsed
