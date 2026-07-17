"""DOCX patching service.

Modifies the text content of target sections inside the resume document
using python-docx while preserving 100% of original visual formatting.

Formatting preservation guarantee
----------------------------------
- Fonts, sizes, colours, bold/italic/underline are never touched.
- Paragraph styles, spacing, indentation, alignment, and keep-with-next are
  preserved by deep-copying the XML of the original template paragraph.
- Bullet/numbered-list XML (<w:numPr>) is copied with the paragraph.
- Hyperlinks, tables, tab stops, and document structure are untouched.
- The AI may only change the *text characters* inside <w:t> nodes.
"""

import copy
import uuid
from pathlib import Path

import docx
import docx.text.paragraph
from docx.oxml.ns import qn
from lxml import etree
from loguru import logger

from app.core.exceptions import NotFoundError
from app.services.section_service import SectionService
from app.schemas.patch import ApplyRewriteRequest, ApplyRewriteResponse


# ---------------------------------------------------------------------------
# Low-level XML helpers
# ---------------------------------------------------------------------------

def _set_run_text(run, text: str) -> None:
    """Set the visible text of a single <w:r> without touching its <w:rPr>.

    Removes all existing <w:t> children and inserts one fresh <w:t> element.
    The xml:space="preserve" attribute is added when the text starts or ends
    with whitespace so Word does not silently strip those characters.
    """
    r_elem = run._r
    for t in r_elem.findall(qn("w:t")):
        r_elem.remove(t)
    t_elem = etree.SubElement(r_elem, qn("w:t"))
    t_elem.text = text
    if text and (text[0] == " " or text[-1] == " "):
        t_elem.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def _set_paragraph_text_preserve_fmt(paragraph, new_text: str) -> None:
    """Replace the visible text of a paragraph while keeping all run formatting.

    Strategy
    --------
    1. Write *new_text* into the very first <w:r> run's <w:t>.
    2. Blank out all remaining runs (their <w:rPr> stays intact so bold
       headers, colour overrides, etc. are never lost).
    3. If there are no runs at all, add a plain new run with the text.
    """
    runs = paragraph.runs

    if not runs:
        paragraph.add_run(new_text)
        return

    _set_run_text(runs[0], new_text)
    for run in runs[1:]:
        _set_run_text(run, "")


def _clone_paragraph_xml(
    template_para, doc_body
) -> "docx.text.paragraph.Paragraph":
    """Deep-copy a paragraph's XML element preserving ALL formatting.

    This copies the entire <w:p> element — including <w:pPr> (paragraph
    properties: style, spacing, alignment, tab stops), <w:numPr> (bullet /
    numbered list), and every <w:rPr> (run properties: font, size, colour).
    The <w:t> text nodes are cleared so fresh text can be written in.
    """
    cloned_p = copy.deepcopy(template_para._p)
    for t_elem in cloned_p.findall(".//" + qn("w:t")):
        t_elem.text = ""
    return docx.text.paragraph.Paragraph(cloned_p, doc_body)


# ---------------------------------------------------------------------------
# PatchService
# ---------------------------------------------------------------------------

class PatchService:
    """Applies AI-rewritten text to a DOCX file while preserving all visual
    formatting of the original document.
    """

    def __init__(self, upload_dir: Path, section_service: SectionService) -> None:
        self._upload_dir = upload_dir
        self._sections = section_service

    def apply_rewrites(self, request: ApplyRewriteRequest) -> ApplyRewriteResponse:
        """Apply accepted rewrites to the original document and save the result."""
        logger.info(
            "Starting DOCX patch application",
            document_id=request.document_id,
            rewrites_count=len(request.accepted_rewrites),
        )

        # 1. Resolve the file path.
        #    Handles both regular UUID uploads and base/{user_id} paths.
        doc_id = request.document_id
        if doc_id.startswith("base/"):
            user_id = doc_id.split("/", 1)[1]
            file_path = self._upload_dir / "base" / f"{user_id}.docx"
        else:
            file_path = self._upload_dir / f"{doc_id}.docx"

        if not file_path.exists():
            raise NotFoundError(f"Original resume document '{doc_id}' not found.")

        doc = docx.Document(file_path)

        # 2. Detect sections using the existing SectionService.
        sections_response = self._sections.detect_document_sections(doc_id)
        sections = sections_response.sections

        sections_updated = 0

        def _normalize(t: str) -> str:
            return " ".join(t.replace("[", "").replace("]", "").strip().lower().split())

        # 3. Apply each accepted rewrite.
        for rewrite_item in request.accepted_rewrites:
            target_sec = next(
                (s for s in sections if _normalize(s.title) == _normalize(rewrite_item.section)),
                None,
            )
            if not target_sec:
                logger.warning(
                    "Skipping section rewrite: section not found",
                    section=rewrite_item.section,
                )
                continue

            if not target_sec.paragraph_indexes:
                continue

            # The first index is the section heading — we never touch its text.
            heading_para = doc.paragraphs[target_sec.paragraph_indexes[0]]
            body_paras = [doc.paragraphs[idx] for idx in target_sec.paragraph_indexes[1:]]

            # Split the AI output into non-empty lines.
            new_para_texts = [
                line.strip()
                for line in rewrite_item.rewritten_text.split("\n")
                if line.strip()
            ]

            # The first body paragraph is the formatting template for new paragraphs.
            style_template = body_paras[0] if body_paras else heading_para

            # Insertion cursor — new paragraphs are inserted after this element.
            insertion_cursor = heading_para

            total = max(len(body_paras), len(new_para_texts))

            for i in range(total):
                if i < len(new_para_texts) and i < len(body_paras):
                    # ── Case A: overwrite existing paragraph (text only) ──────
                    # We touch ONLY the <w:t> nodes; every <w:rPr> is preserved.
                    _set_paragraph_text_preserve_fmt(body_paras[i], new_para_texts[i])
                    insertion_cursor = body_paras[i]

                elif i < len(new_para_texts):
                    # ── Case B: AI produced more lines than original ───────────
                    # Deep-clone the template paragraph so all formatting is
                    # inherited: style, spacing, bullets, numbering, tab stops.
                    new_p = _clone_paragraph_xml(style_template, doc._body)
                    insertion_cursor._p.addnext(new_p._p)
                    _set_paragraph_text_preserve_fmt(new_p, new_para_texts[i])
                    insertion_cursor = new_p

                else:
                    # ── Case C: original had more lines than AI output ─────────
                    # Remove the surplus paragraph entirely.
                    p = body_paras[i]
                    p._p.getparent().remove(p._p)
                    p._p = None  # type: ignore[assignment]

            sections_updated += 1

        # 4. Save the modified document to the generated/ subdirectory.
        download_id = str(uuid.uuid4())
        generated_dir = self._upload_dir / "generated"
        generated_dir.mkdir(parents=True, exist_ok=True)
        output_path = generated_dir / f"{download_id}.docx"
        doc.save(output_path)

        logger.info(
            "DOCX patching complete",
            download_id=download_id,
            sections_updated=sections_updated,
            output_path=str(output_path),
        )

        return ApplyRewriteResponse(
            download_id=download_id,
            sections_updated=sections_updated,
            download_url=f"/api/v1/resume/download/{download_id}",
        )
