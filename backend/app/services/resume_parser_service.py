import re
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
    ContactInfo,
    ResumeSection,
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
        """Check if uploaded DOCX font/style matches one of our 3 ATS templates."""
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

    def _try_fast_deterministic_parse(
        self,
        raw_text: str,
        filename: str,
        format_type: str,
        file_path: Path,
    ) -> Optional[StructuredResume]:
        """Fast 1ms deterministic parser for resumes with standard headers.

        Bypasses OpenAI network I/O if resume has standard section headings and contact info.
        """
        try:
            email_match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", raw_text)
            phone_match = re.search(r"(\+?\d{1,4}[\s.-]?)?\(?\d{3,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}", raw_text)
            loc_match = re.search(r"\b([A-Z][a-zA-Z\s]+,\s*(?:UAE|USA|UK|India|Dubai|Abu Dhabi|Singapore|Canada|Qatar|Saudi Arabia|Germany))\b", raw_text)

            email = email_match.group(0) if email_match else ""
            phone = phone_match.group(0) if phone_match else ""
            location = loc_match.group(1) if loc_match else ""

            raw_lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
            full_name = ""
            for line in raw_lines[:6]:
                clean_line = re.sub(r"^\[BOLD\]\s*", "", line).strip()
                if (
                    clean_line
                    and "@" not in clean_line
                    and not re.search(r"\d{3}", clean_line)
                    and len(clean_line) < 45
                    and not any(kw in clean_line.lower() for kw in ["curriculum", "resume", "cv", "page"])
                ):
                    full_name = clean_line
                    break

            if not full_name or not email:
                return None

            contact_info = ContactInfo(
                full_name=full_name,
                email=email,
                phone=phone,
                location=location,
                job_title="",
            )

            header_pattern = re.compile(
                r"^\s*(?:\[BOLD\]\s*)?(" + "|".join([
                    "EXPERIENCES?", "WORK EXPERIENCES?", "PROFESSIONAL EXPERIENCES?", "EMPLOYMENT HISTOR(?:Y|IES)", "CAREER HISTOR(?:Y|IES)",
                    "TECHNICAL SKILLS?", "SKILLS?", "CORE COMPETENCIES", "SKILLS & COMPETENCIES", "TECHNOLOGIES",
                    "PROJECTS?", "KEY PROJECTS?", "PERSONAL PROJECTS?",
                    "SUMMARY", "PROFESSIONAL SUMMARY", "EXECUTIVE SUMMARY", "PROFILE", "ABOUT ME",
                    "EDUCATION", "CERTIFICATIONS?", "LICENSES?"
                ]) + r")\s*$",
                re.IGNORECASE | re.MULTILINE
            )

            matches = list(header_pattern.finditer(raw_text))
            if not matches:
                return None

            section_kw_map = {
                "experience": ["experience", "work experience", "professional experience", "employment", "career"],
                "skills": ["skill", "competenc", "technolog"],
                "projects": ["project", "portfolio"],
                "summary": ["summary", "profile", "about"],
                "education": ["education", "academic", "qualification"],
                "certifications": ["certification", "license", "certificate"],
            }

            sections_list: list[ResumeSection] = []
            summary_text = ""
            order_counter = 1

            for i, match in enumerate(matches):
                title = match.group(1).strip()
                start_pos = match.end()
                end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(raw_text)
                sec_text = raw_text[start_pos:end_pos].strip()

                title_lower = title.lower()
                sec_type = "custom"
                for stype, kws in section_kw_map.items():
                    if any(kw in title_lower for kw in kws):
                        sec_type = stype
                        break

                content_dict: dict = {}

                if sec_type == "summary":
                    summary_text = sec_text
                    content_dict = {"text": sec_text}

                elif sec_type == "skills":
                    cats = []
                    skill_lines = [l.strip() for l in sec_text.split("\n") if l.strip()]
                    for sline in skill_lines:
                        clean_sl = re.sub(r"^\[BOLD\]\s*", "", sline).strip()
                        if ":" in clean_sl:
                            cat_name, skills_str = clean_sl.split(":", 1)
                            skill_items = [s.strip() for s in skills_str.split(",") if s.strip()]
                            if cat_name.strip() and skill_items:
                                cats.append({"category_name": cat_name.strip(), "skills": skill_items})
                        elif "," in clean_sl:
                            skill_items = [s.strip() for s in clean_sl.split(",") if s.strip()]
                            if skill_items:
                                cats.append({"category_name": "Technical Skills", "skills": skill_items})
                    if not cats and skill_lines:
                        cats.append({"category_name": "Core Skills", "skills": skill_lines})
                    content_dict = {"categories": cats}

                elif sec_type == "experience":
                    entries = []
                    lines = [l.strip() for l in sec_text.split("\n") if l.strip()]
                    current_entry = None

                    for line in lines:
                        clean_line = re.sub(r"^\[BOLD\]\s*", "", line).strip()
                        is_bullet = clean_line.startswith(("•", "-", "*", "▪", "▸")) or (clean_line.startswith("[BOLD]") and len(clean_line) > 55)

                        if is_bullet:
                            bullet_text = re.sub(r"^[•\-\*▪▸]\s*", "", clean_line).strip()
                            if current_entry:
                                current_entry["bullets"].append(bullet_text)
                            else:
                                current_entry = {
                                    "job_title": "Role Entry",
                                    "company": "",
                                    "location": "",
                                    "start_date": "",
                                    "end_date": "Present",
                                    "bullets": [bullet_text]
                                }
                                entries.append(current_entry)
                        else:
                            date_match = re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|19\d\d|20\d\d)\b.*?\b(Present|19\d\d|20\d\d)\b", clean_line, re.IGNORECASE)
                            if date_match or (current_entry is None) or len(current_entry["bullets"]) > 0:
                                current_entry = {
                                    "job_title": clean_line,
                                    "company": "",
                                    "location": "",
                                    "start_date": "",
                                    "end_date": "Present",
                                    "bullets": []
                                }
                                entries.append(current_entry)
                            elif current_entry and not current_entry["company"]:
                                current_entry["company"] = clean_line

                    content_dict = {"entries": entries}

                elif sec_type == "projects":
                    entries = []
                    lines = [l.strip() for l in sec_text.split("\n") if l.strip()]
                    cur_p = None
                    for line in lines:
                        clean_line = re.sub(r"^\[BOLD\]\s*", "", line).strip()
                        if clean_line.startswith(("•", "-", "*", "▪", "▸")):
                            b_text = re.sub(r"^[•\-\*▪▸]\s*", "", clean_line).strip()
                            if cur_p:
                                cur_p["bullets"].append(b_text)
                        else:
                            cur_p = {"name": clean_line, "url": "", "technologies": [], "bullets": []}
                            entries.append(cur_p)
                    content_dict = {"entries": entries}

                else:
                    lines = [l.strip() for l in sec_text.split("\n") if l.strip()]
                    content_dict = {"entries": lines}

                sections_list.append(
                    ResumeSection(
                        section_type=sec_type,
                        section_title=title,
                        order=order_counter,
                        visible=True,
                        content=content_dict
                    )
                )
                order_counter += 1

            if not any(s.section_type == "experience" for s in sections_list):
                return None

            logger.info("⚡ Fast 1ms Deterministic Parser Succeeded!", user_name=full_name, sections_count=len(sections_list))

            return StructuredResume(
                contact_info=contact_info,
                summary=summary_text,
                sections=sections_list,
                parse_confidence=ParseConfidence(low_confidence_fields=[], overall_confidence=1.0),
                source_format=format_type,
                preferred_template=self.detect_docx_template_match(file_path) if format_type == "docx" else None
            )

        except Exception as exc:
            logger.debug("Fast deterministic parse bypassed", error=str(exc))
            return None

    def parse_document(self, file_path: Path, filename: str) -> StructuredResume:
        """Extract text from file and parse into StructuredResume JSON using AI."""
        raw_text, format_type = self.extract_text_from_file(file_path)

        if len(raw_text.strip()) < 50:
            raise BadRequestError("Extracted resume text is too short or empty.")

        # ⚡ Step 1: Try Fast 1ms Deterministic Extraction
        fast_structured = self._try_fast_deterministic_parse(raw_text, filename, format_type, file_path)
        if fast_structured is not None:
            return fast_structured

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
