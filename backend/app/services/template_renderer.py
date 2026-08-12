"""ATS Resume Template Renderer.

Programmatically builds clean, single-column DOCX resumes from a `StructuredResume` object.
Supports 3 ATS-friendly templates:
1. `clean_classic`: Single-column, Times New Roman, black text, traditional academic/corporate format.
2. `modern_professional`: Single-column, Calibri, navy accents, section divider lines.
3. `executive_profile`: Single-column, Aptos/Calibri, blue accents, optional profile photo in header.
"""

from pathlib import Path
from typing import Optional
from loguru import logger
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from app.schemas.structured_resume import StructuredResume


def _set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set inner padding for a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def _add_bottom_border(paragraph, color_hex="1E3A5F", sz="6"):
    """Add a subtle horizontal border below a section title paragraph."""
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), sz)
    bottom.set(qn('w:space'), '4')
    bottom.set(qn('w:color'), color_hex)
    pBdr.append(bottom)
    pPr.append(pBdr)


class ATSTemplateRenderer:
    """Renders a StructuredResume into an ATS-friendly DOCX document."""

    def render_docx(
        self,
        resume: StructuredResume,
        output_path: Path,
        template_name: Optional[str] = None,
        profile_photo_abs_path: Optional[Path] = None,
    ) -> Path:
        """Render DOCX file based on selected template."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        template_key = (template_name or resume.preferred_template or "clean_classic").lower()

        doc = docx.Document()

        # Set 0.5 inch margins for standard ATS format
        sections = doc.sections
        for s in sections:
            s.top_margin = Inches(0.5)
            s.bottom_margin = Inches(0.5)
            s.left_margin = Inches(0.5)
            s.right_margin = Inches(0.5)

        if template_key == "executive_profile":
            self._render_executive_profile(doc, resume, profile_photo_abs_path)
        elif template_key == "modern_professional":
            self._render_modern_professional(doc, resume)
        else:
            self._render_clean_classic(doc, resume)

        doc.save(output_path)
        logger.info("Successfully generated ATS resume DOCX", template=template_key, path=str(output_path))
        return output_path

    def render_with_rewrites(
        self,
        resume: StructuredResume,
        accepted_rewrites: list[dict],
        output_path: Path,
        template_name: str = "clean_classic",
        profile_photo_abs_path: Optional[Path] = None,
    ) -> Path:
        """Render resume with accepted AI rewrites merged in-memory.

        The ``resume`` (master JSON) is **never mutated**. A deep copy is made,
        the accepted rewrite texts are merged into the copy's section content,
        and then the merged copy is rendered to a DOCX.

        ``accepted_rewrites`` is a list of dicts with keys:
          - ``section``: section title or normalized section_type
          - ``rewritten_text``: AI-generated replacement text for that section

        Original DOCX formatting is NOT preserved here — a fresh ATS template is
        rendered. If the user wants their original formatting, use PatchService instead.
        """
        import copy

        # Deep copy to avoid mutating the master JSON
        merged = copy.deepcopy(resume)

        for rw in accepted_rewrites:
            section_title = (rw.get("section") or "").strip().lower()
            rewritten_text = (rw.get("rewritten_text") or "").strip()
            if not section_title or not rewritten_text:
                continue

            # Match against merged.sections by section_title or section_type
            for sec in merged.sections:
                if (
                    sec.section_title.lower() == section_title
                    or sec.section_type.lower() == section_title
                ):
                    if sec.section_type == "summary":
                        sec.content["text"] = rewritten_text
                    elif sec.section_type == "skills":
                        lines = [line.strip() for line in rewritten_text.split("\n") if line.strip()]
                        categories = []
                        for line in lines:
                            if ":" in line:
                                cat_name, skills_str = line.split(":", 1)
                                skills = [s.strip() for s in skills_str.split(",") if s.strip()]
                                categories.append({"category_name": cat_name.strip(), "skills": skills})
                            else:
                                categories.append({"category_name": "Skills", "skills": [line]})
                        sec.content["categories"] = categories
                    elif sec.section_type == "experience":
                        # Store as plain-text override; renderer will use bullets from this
                        sec.content["_rewritten_text_override"] = rewritten_text
                    else:
                        lines = [line.strip() for line in rewritten_text.split("\n") if line.strip()]
                        sec.content["entries"] = lines
                    break

            # Handle top-level summary
            if "summary" in section_title and merged.summary is not None:
                merged.summary = rewritten_text

        return self.render_docx(
            resume=merged,
            output_path=output_path,
            template_name=template_name,
            profile_photo_abs_path=profile_photo_abs_path,
        )

    # ── Template 1: Clean Classic ────────────────────────────────────────────────
    def _render_clean_classic(self, doc: docx.Document, resume: StructuredResume) -> None:
        font_name = "Times New Roman"

        # Candidate Name
        p_name = doc.add_paragraph()
        p_name.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_name = p_name.add_run(resume.contact_info.full_name or "Candidate Name")
        r_name.font.name = font_name
        r_name.font.size = Pt(18)
        r_name.font.bold = True
        r_name.font.color.rgb = RGBColor(0, 0, 0)
        p_name.paragraph_format.space_after = Pt(2)

        # Contact Info Line
        contact_parts = []
        c = resume.contact_info
        if c.phone:
            contact_parts.append(c.phone)
        if c.email:
            contact_parts.append(c.email)
        if c.location:
            contact_parts.append(c.location)
        if c.linkedin_url:
            contact_parts.append(c.linkedin_url)
        if c.portfolio_url or c.github_url:
            contact_parts.append(c.portfolio_url or c.github_url)

        if contact_parts:
            p_contact = doc.add_paragraph()
            p_contact.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r_c = p_contact.add_run(" | ".join(contact_parts))
            r_c.font.name = font_name
            r_c.font.size = Pt(9.5)
            r_c.font.color.rgb = RGBColor(30, 30, 30)
            p_contact.paragraph_format.space_after = Pt(12)

        # Sections
        sorted_sections = sorted([s for s in resume.sections if s.visible], key=lambda s: s.order)

        # Append Summary if present and not in explicit section
        if resume.summary and not any(s.section_type == "summary" for s in sorted_sections):
            self._render_classic_section_title(doc, "PROFESSIONAL SUMMARY", font_name)
            p_sum = doc.add_paragraph()
            r_sum = p_sum.add_run(resume.summary)
            r_sum.font.name = font_name
            r_sum.font.size = Pt(10)
            p_sum.paragraph_format.space_after = Pt(8)

        for sec in sorted_sections:
            self._render_classic_section_title(doc, sec.section_title.upper(), font_name)
            self._render_section_content_classic(doc, sec, font_name)

    def _render_classic_section_title(self, doc: docx.Document, title: str, font_name: str) -> None:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(title)
        r.font.name = font_name
        r.font.size = Pt(11)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0, 0, 0)
        _add_bottom_border(p, color_hex="000000", sz="4")

    # ── Template 2: Modern Professional ─────────────────────────────────────────
    def _render_modern_professional(self, doc: docx.Document, resume: StructuredResume) -> None:
        font_name = "Calibri"
        navy = RGBColor(30, 58, 95)  # #1e3a5f

        # Candidate Name
        p_name = doc.add_paragraph()
        p_name.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_name = p_name.add_run(resume.contact_info.full_name or "Candidate Name")
        r_name.font.name = font_name
        r_name.font.size = Pt(20)
        r_name.font.bold = True
        r_name.font.color.rgb = navy
        p_name.paragraph_format.space_after = Pt(2)

        # Contact Info Line
        contact_parts = []
        c = resume.contact_info
        if c.phone:
            contact_parts.append(c.phone)
        if c.email:
            contact_parts.append(c.email)
        if c.location:
            contact_parts.append(c.location)
        if c.linkedin_url:
            contact_parts.append(c.linkedin_url)

        if contact_parts:
            p_contact = doc.add_paragraph()
            p_contact.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r_c = p_contact.add_run("  •  ".join(contact_parts))
            r_c.font.name = font_name
            r_c.font.size = Pt(9.5)
            r_c.font.color.rgb = RGBColor(70, 80, 95)
            p_contact.paragraph_format.space_after = Pt(12)

        sorted_sections = sorted([s for s in resume.sections if s.visible], key=lambda s: s.order)

        if resume.summary and not any(s.section_type == "summary" for s in sorted_sections):
            self._render_modern_section_title(doc, "PROFESSIONAL SUMMARY", font_name, "1E3A5F")
            p_sum = doc.add_paragraph()
            r_sum = p_sum.add_run(resume.summary)
            r_sum.font.name = font_name
            r_sum.font.size = Pt(10)
            p_sum.paragraph_format.space_after = Pt(8)

        for sec in sorted_sections:
            self._render_modern_section_title(doc, sec.section_title.upper(), font_name, "1E3A5F")
            self._render_section_content_classic(doc, sec, font_name)

    def _render_modern_section_title(self, doc: docx.Document, title: str, font_name: str, color_hex: str) -> None:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(title)
        r.font.name = font_name
        r.font.size = Pt(11.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(30, 58, 95)
        _add_bottom_border(p, color_hex=color_hex, sz="8")

    # ── Template 3: Executive Profile (with Photo Option) ───────────────────────
    def _render_executive_profile(
        self,
        doc: docx.Document,
        resume: StructuredResume,
        profile_photo_abs_path: Optional[Path],
    ) -> None:
        font_name = "Aptos"
        blue_accent = RGBColor(37, 99, 235)  # #2563eb

        # Header with optional Profile Photo on Right
        if profile_photo_abs_path and profile_photo_abs_path.exists():
            table = doc.add_table(rows=1, cols=2)
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            table.autofit = False

            # Cell 0: Text info (75% width)
            cell_left = table.rows[0].cells[0]
            cell_left.width = Inches(5.8)
            p_name = cell_left.paragraphs[0]
            r_name = p_name.add_run(resume.contact_info.full_name or "Candidate Name")
            r_name.font.name = font_name
            r_name.font.size = Pt(20)
            r_name.font.bold = True
            r_name.font.color.rgb = blue_accent
            p_name.paragraph_format.space_after = Pt(4)

            contact_parts = []
            c = resume.contact_info
            if c.email:
                contact_parts.append(c.email)
            if c.phone:
                contact_parts.append(c.phone)
            if c.location:
                contact_parts.append(c.location)
            if c.linkedin_url:
                contact_parts.append(c.linkedin_url)

            if contact_parts:
                p_c = cell_left.add_paragraph()
                r_c = p_c.add_run(" | ".join(contact_parts))
                r_c.font.name = font_name
                r_c.font.size = Pt(9.5)
                r_c.font.color.rgb = RGBColor(71, 85, 105)

            # Cell 1: Photo (25% width)
            cell_right = table.rows[0].cells[1]
            cell_right.width = Inches(1.5)
            cell_right.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p_photo = cell_right.paragraphs[0]
            p_photo.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            try:
                p_photo.add_run().add_picture(str(profile_photo_abs_path), width=Inches(1.2))
            except Exception as exc:
                logger.warning(f"Failed to embed profile photo: {exc}")

            doc.add_paragraph().paragraph_format.space_after = Pt(8)
        else:
            # Header without photo
            p_name = doc.add_paragraph()
            p_name.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r_name = p_name.add_run(resume.contact_info.full_name or "Candidate Name")
            r_name.font.name = font_name
            r_name.font.size = Pt(22)
            r_name.font.bold = True
            r_name.font.color.rgb = blue_accent
            p_name.paragraph_format.space_after = Pt(3)

            contact_parts = []
            c = resume.contact_info
            if c.phone:
                contact_parts.append(c.phone)
            if c.email:
                contact_parts.append(c.email)
            if c.location:
                contact_parts.append(c.location)
            if c.linkedin_url:
                contact_parts.append(c.linkedin_url)

            if contact_parts:
                p_contact = doc.add_paragraph()
                r_c = p_contact.add_run("  •  ".join(contact_parts))
                r_c.font.name = font_name
                r_c.font.size = Pt(9.5)
                r_c.font.color.rgb = RGBColor(71, 85, 105)
                p_contact.paragraph_format.space_after = Pt(12)

        sorted_sections = sorted([s for s in resume.sections if s.visible], key=lambda s: s.order)

        if resume.summary and not any(s.section_type == "summary" for s in sorted_sections):
            self._render_executive_section_title(doc, "EXECUTIVE SUMMARY", font_name, blue_accent)
            p_sum = doc.add_paragraph()
            r_sum = p_sum.add_run(resume.summary)
            r_sum.font.name = font_name
            r_sum.font.size = Pt(10)
            p_sum.paragraph_format.space_after = Pt(8)

        for sec in sorted_sections:
            self._render_executive_section_title(doc, sec.section_title.upper(), font_name, blue_accent)
            self._render_section_content_classic(doc, sec, font_name)

    def _render_executive_section_title(self, doc: docx.Document, title: str, font_name: str, color_rgb: RGBColor) -> None:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(title)
        r.font.name = font_name
        r.font.size = Pt(11.5)
        r.font.bold = True
        r.font.color.rgb = color_rgb
        _add_bottom_border(p, color_hex="2563EB", sz="8")

    # ── Section Content Dispatcher ───────────────────────────────────────────────
    def _render_section_content_classic(self, doc: docx.Document, sec: dict | any, font_name: str) -> None:
        stype = getattr(sec, "section_type", "custom")
        content = getattr(sec, "content", {}) or {}

        if stype == "summary":
            text = content.get("text") or content.get("summary") or ""
            if text:
                p = doc.add_paragraph()
                r = p.add_run(text)
                r.font.name = font_name
                r.font.size = Pt(10)
                p.paragraph_format.space_after = Pt(6)

        elif stype == "skills":
            categories = content.get("categories", [])
            for cat in categories:
                if isinstance(cat, dict):
                    cname = cat.get("category_name", "Skills")
                    skills = cat.get("skills", [])
                    if skills:
                        p = doc.add_paragraph()
                        r_c = p.add_run(f"{cname}: ")
                        r_c.font.name = font_name
                        r_c.font.size = Pt(10)
                        r_c.font.bold = True

                        r_s = p.add_run(", ".join(skills))
                        r_s.font.name = font_name
                        r_s.font.size = Pt(10)
                        p.paragraph_format.space_after = Pt(3)

        elif stype == "experience":
            entries = content.get("entries", [])
            for entry in entries:
                if isinstance(entry, dict):
                    title = entry.get("job_title", "")
                    company = entry.get("company", "")
                    loc = entry.get("location", "")
                    sdate = entry.get("start_date", "")
                    edate = entry.get("end_date", "")
                    bullets = entry.get("bullets", [])

                    # Header line: Job Title - Company | Dates
                    p_head = doc.add_paragraph()
                    p_head.paragraph_format.space_before = Pt(4)
                    p_head.paragraph_format.space_after = Pt(1)

                    r_t = p_head.add_run(title)
                    r_t.font.name = font_name
                    r_t.font.size = Pt(10.5)
                    r_t.font.bold = True

                    if company:
                        r_comp = p_head.add_run(f" — {company}")
                        r_comp.font.name = font_name
                        r_comp.font.size = Pt(10)
                        r_comp.font.bold = True

                    date_str = f"{sdate} – {edate}" if sdate or edate else ""
                    if date_str or loc:
                        right_info = f" ({loc})" if loc else ""
                        if date_str:
                            right_info = f"{date_str}{right_info}"
                        r_d = p_head.add_run(f" | {right_info}")
                        r_d.font.name = font_name
                        r_d.font.size = Pt(9.5)
                        r_d.font.italic = True

                    # Bullets
                    for b in bullets:
                        if b and str(b).strip():
                            p_b = doc.add_paragraph(style="List Bullet")
                            r_b = p_b.add_run(str(b).strip())
                            r_b.font.name = font_name
                            r_b.font.size = Pt(9.5)
                            p_b.paragraph_format.space_after = Pt(1.5)
                            p_b.paragraph_format.line_spacing = 1.15

        elif stype == "education":
            entries = content.get("entries", [])
            for entry in entries:
                if isinstance(entry, dict):
                    deg = entry.get("degree", "")
                    inst = entry.get("institution", "")
                    gdate = entry.get("graduation_date", "")
                    loc = entry.get("location", "")

                    p_edu = doc.add_paragraph()
                    p_edu.paragraph_format.space_before = Pt(3)
                    p_edu.paragraph_format.space_after = Pt(2)

                    r_d = p_edu.add_run(deg)
                    r_d.font.name = font_name
                    r_d.font.size = Pt(10)
                    r_d.font.bold = True

                    if inst:
                        r_i = p_edu.add_run(f", {inst}")
                        r_i.font.name = font_name
                        r_i.font.size = Pt(10)

                    if gdate or loc:
                        r_g = p_edu.add_run(f" ({gdate or loc})")
                        r_g.font.name = font_name
                        r_g.font.size = Pt(9.5)
                        r_g.font.italic = True

        elif stype == "projects":
            entries = content.get("entries", [])
            for entry in entries:
                if isinstance(entry, dict):
                    pname = entry.get("name", "")
                    url = entry.get("url", "")
                    desc = entry.get("description", "")
                    techs = entry.get("technologies", [])
                    bullets = entry.get("bullets", [])

                    p_proj = doc.add_paragraph()
                    p_proj.paragraph_format.space_before = Pt(3)
                    p_proj.paragraph_format.space_after = Pt(1)

                    r_p = p_proj.add_run(pname)
                    r_p.font.name = font_name
                    r_p.font.size = Pt(10)
                    r_p.font.bold = True

                    if url:
                        r_u = p_proj.add_run(f" ({url})")
                        r_u.font.name = font_name
                        r_u.font.size = Pt(9.5)
                        r_u.font.italic = True

                    if techs:
                        r_tech = p_proj.add_run(f" [{', '.join(techs)}]")
                        r_tech.font.name = font_name
                        r_tech.font.size = Pt(9.5)
                        r_tech.font.italic = True

                    if desc:
                        p_desc = doc.add_paragraph()
                        r_desc = p_desc.add_run(desc)
                        r_desc.font.name = font_name
                        r_desc.font.size = Pt(9.5)
                        p_desc.paragraph_format.space_after = Pt(1.5)

                    for b in bullets:
                        if b and str(b).strip():
                            p_b = doc.add_paragraph(style="List Bullet")
                            r_b = p_b.add_run(str(b).strip())
                            r_b.font.name = font_name
                            r_b.font.size = Pt(9.5)
                            p_b.paragraph_format.space_after = Pt(1.5)

        else:
            # Custom section: list of text entries
            entries = content.get("entries", [])
            for entry in entries:
                if entry and str(entry).strip():
                    p_c = doc.add_paragraph(style="List Bullet")
                    r_c = p_c.add_run(str(entry).strip())
                    r_c.font.name = font_name
                    r_c.font.size = Pt(9.5)
                    p_c.paragraph_format.space_after = Pt(2)
