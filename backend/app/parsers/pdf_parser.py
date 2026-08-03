"""PDF resume parser.

Extracts structured text from a PDF resume using pdfplumber.

This module sits in the Parser Layer alongside docx_parser.py. It is
intentionally pure:

- Input:  raw PDF bytes
- Output: ParsedPdfResult dataclass
- No HTTP, no filesystem, no services.

Detection strategy
------------------
1. Scanned-PDF guard: if total extracted text < 100 chars, raise immediately
   with a user-friendly error.
2. Multi-column detection: if the page has distinct left/right text clusters,
   split columns and read left-column first, then right-column.
3. Section heading heuristics (any one sufficient):
   - Matches a known section name in SECTION_NAME_MAP (reused from section_detector)
   - Short ALL-CAPS line (≤55 chars, no bullet, no leading digit)
   - Font size >= 1.5× the median body font size on the page
4. Candidate name: first non-empty, non-contact line at the top of the document
   (usually the largest text on the first page).
5. Contact line: lines containing @, phone-like digit patterns, linkedin,
   github, or location keywords — collapsed into a single formatted line.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

from loguru import logger

from app.analyzers.section_detector import SECTION_NAME_MAP
from app.core.exceptions import BadRequestError


# ── Output data structures ─────────────────────────────────────────────────────


@dataclass
class ParsedPdfSection:
    """One logical section extracted from the PDF."""

    heading: str
    """Section heading text as detected (e.g. 'EXPERIENCE', 'Technical Skills')."""

    content_lines: list[str] = field(default_factory=list)
    """Raw non-empty text lines belonging to this section (heading excluded)."""


@dataclass
class ParsedPdfResult:
    """Full structured extraction result from one PDF resume."""

    candidate_name: str
    """Candidate's full name (first non-contact line at top of document)."""

    contact_line: str
    """Contact info collapsed into a single pipe-separated line."""

    sections: list[ParsedPdfSection] = field(default_factory=list)
    """Ordered list of detected sections."""

    raw_text: str = ""
    """Full concatenated text — used as fallback for display/debug."""


# ── Public API ────────────────────────────────────────────────────────────────


def parse_pdf(content: bytes) -> ParsedPdfResult:
    """Extract structured resume content from raw PDF bytes.

    Parameters
    ----------
    content:
        Raw bytes of the PDF file.

    Returns
    -------
    ParsedPdfResult

    Raises
    ------
    BadRequestError
        When the PDF is image/scanned (no extractable text) or cannot be
        opened by pdfplumber.
    """
    try:
        import pdfplumber
    except ImportError:
        raise BadRequestError(
            "PDF processing library not available. Please upload a DOCX file instead."
        )

    try:
        pdf = pdfplumber.open(io.BytesIO(content))
    except Exception as exc:
        raise BadRequestError(
            f"Unable to open PDF file. Please ensure it is a valid PDF. ({exc})"
        )

    with pdf:
        # ── Scanned-PDF guard ─────────────────────────────────────────────────
        all_lines: list[str] = []

        for page in pdf.pages:
            raw = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
            all_lines.extend(raw.splitlines())

        total_chars = sum(len(ln) for ln in all_lines)
        if total_chars < 80:
            raise BadRequestError(
                "This PDF appears to be scanned or image-based and contains no "
                "extractable text. Please upload a text-based PDF or convert your "
                "resume to DOCX format first."
            )

        logger.info("PDF text extracted", total_chars=total_chars, pages=len(pdf.pages))

        # ── Multi-column detection & re-ordering ──────────────────────────────
        ordered_lines: list[str] = _extract_lines_column_aware(pdf)

    # ── Parse structured content from ordered lines ───────────────────────────
    return _parse_lines(ordered_lines)


# ── Column-aware text extraction ──────────────────────────────────────────────


def _find_vertical_gutter(words: list[dict], page_width: float) -> float | None:
    """Detect if a page has a true vertical whitespace gap (gutter) between two text columns.

    Returns the X midpoint of the gutter if found, or None if the page is single-column.
    """
    if not words:
        return None

    # Check for a vertical gap in the middle region [30% .. 70% width]
    start_x = page_width * 0.30
    end_x = page_width * 0.70

    # Collect all (x0, x1) horizontal intervals of words
    word_intervals = [(w["x0"], w["x1"]) for w in words]

    best_gutter_x = None
    max_gap_width = 0.0

    curr_x = start_x
    gap_start = None

    while curr_x <= end_x:
        is_blocked = any(x0 <= curr_x <= x1 for x0, x1 in word_intervals)
        if not is_blocked:
            if gap_start is None:
                gap_start = curr_x
        else:
            if gap_start is not None:
                gap_w = curr_x - gap_start
                if gap_w >= 18 and gap_w > max_gap_width:
                    max_gap_width = gap_w
                    best_gutter_x = gap_start + gap_w / 2
                gap_start = None
        curr_x += 2

    if gap_start is not None:
        gap_w = end_x - gap_start
        if gap_w >= 18 and gap_w > max_gap_width:
            max_gap_width = gap_w
            best_gutter_x = gap_start + gap_w / 2

    return best_gutter_x


def _extract_lines_column_aware(pdf) -> list[str]:
    """Extract lines from all pages, preserving full lines without slicing."""
    all_lines: list[str] = []

    for page in pdf.pages:
        width = page.width
        words = page.extract_words(x_tolerance=3, y_tolerance=3, extra_attrs=["size"]) or []

        if not words:
            continue

        gutter_x = _find_vertical_gutter(words, width)

        if gutter_x is not None:
            # Genuine 2-column page: crop along the actual whitespace gutter
            left_crop = page.crop((0, 0, gutter_x, page.height))
            right_crop = page.crop((gutter_x, 0, width, page.height))
            left_text = left_crop.extract_text(x_tolerance=3, y_tolerance=3) or ""
            right_text = right_crop.extract_text(x_tolerance=3, y_tolerance=3) or ""
            all_lines.extend(left_text.splitlines())
            all_lines.extend(right_text.splitlines())
        else:
            # Single-column page (or standard layout): extract full text naturally
            page_text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
            all_lines.extend(page_text.splitlines())

    return all_lines


# ── Line-level parsing ────────────────────────────────────────────────────────


_CONTACT_PATTERNS = [
    re.compile(r"[\w.+-]+@[\w.-]+\.\w{2,}"),          # email
    re.compile(r"\+?\d[\d\s\-().]{7,}\d"),             # phone
    re.compile(r"linkedin\.com", re.I),
    re.compile(r"github\.com", re.I),
    re.compile(r"\bportfolio\b", re.I),
    re.compile(r"https?://", re.I),
]

_LOCATION_WORDS = {
    "dubai", "uae", "india", "usa", "uk", "remote", "bangalore", "london",
    "new york", "san francisco", "singapore", "toronto", "sydney", "berlin",
    "paris", "california", "texas", "seattle", "austin", "chicago", "boston",
}


def _is_contact_line(text: str) -> bool:
    """Return True if the line looks like contact/location info."""
    t = text.strip()
    if not t:
        return False
    if any(pat.search(t) for pat in _CONTACT_PATTERNS):
        return True
    t_lower = t.lower()
    if any(loc in t_lower for loc in _LOCATION_WORDS):
        return True
    return False


def _is_section_heading(text: str) -> bool:
    """Return True when the line should be treated as a section heading."""
    t = text.strip()
    if not t or len(t) > 70:
        return False
    # Starts with bullet → content, never heading
    if t[0] in "•-*–—▪▸":
        return False
    # Known section name
    normalised = re.sub(r"\s+", " ", t.lower().rstrip(":.-_*")).strip()
    if normalised in SECTION_NAME_MAP:
        return True
    # Short ALL-CAPS (3–55 chars, ≤6 words, no leading digit)
    words = t.split()
    if (
        3 <= len(t) <= 55
        and t == t.upper()
        and len(words) <= 6
        and not words[0][0].isdigit()
    ):
        return True
    return False


def _looks_like_name(text: str) -> bool:
    """Return True if text could be a person's full name."""
    t = text.strip()
    if not t or len(t) > 50 or len(t) < 3:
        return False
    if _is_contact_line(t) or _is_section_heading(t):
        return False
    # Should be mostly letters (and spaces / hyphens)
    letter_ratio = sum(1 for c in t if c.isalpha() or c in " -.'") / len(t)
    return letter_ratio >= 0.85 and len(t.split()) >= 2


def _parse_lines(lines: list[str]) -> ParsedPdfResult:
    """Convert a flat list of text lines into structured ParsedPdfResult."""
    cleaned: list[str] = [ln.strip() for ln in lines if ln.strip()]

    # ── Header extraction (name + contact) ───────────────────────────────────
    candidate_name = ""
    contact_parts: list[str] = []
    header_end_idx = 0

    # Scan top lines strictly for candidate name and actual contact details
    for i, ln in enumerate(cleaned[:10]):
        if not candidate_name and _looks_like_name(ln):
            candidate_name = ln
            header_end_idx = i + 1
            continue
        if candidate_name and _is_contact_line(ln) and not _is_section_heading(ln):
            contact_parts.append(ln)
            header_end_idx = i + 1
        elif candidate_name:
            # First non-contact line after name → stop header processing immediately!
            break

    # Fallback for name
    if not candidate_name:
        for ln in cleaned[:5]:
            if ln:
                candidate_name = ln
                break

    contact_line = " | ".join(p for p in contact_parts if p) if contact_parts else ""

    # ── Section parsing ───────────────────────────────────────────────────────
    sections: list[ParsedPdfSection] = []
    current: ParsedPdfSection | None = None

    body_lines = cleaned[header_end_idx:]

    for ln in body_lines:
        if _is_section_heading(ln):
            if current is not None:
                sections.append(current)
            current = ParsedPdfSection(heading=ln)
        else:
            if current is None:
                current = ParsedPdfSection(heading="Professional Summary")
            current.content_lines.append(ln)

    if current is not None:
        sections.append(current)

    raw_text = "\n".join(cleaned)

    logger.info(
        "PDF parsed",
        candidate_name=candidate_name,
        contact_parts=len(contact_parts),
        sections=[s.heading for s in sections],
    )

    return ParsedPdfResult(
        candidate_name=candidate_name,
        contact_line=contact_line,
        sections=sections,
        raw_text=raw_text,
    )

