"""In-memory analysis cache service.

Caches ResumeAnalysisResult by md5 hash of (resume_text + "|" + job_description_text)
to deliver instant (~5ms) re-analysis results.
"""

import hashlib
import time

from loguru import logger

from app.schemas.resume_analysis import ResumeAnalysisResult


class AnalysisCache:
    """Thread-safe in-memory cache with TTL for resume analysis results."""

    def __init__(self, ttl_seconds: int = 3600, max_entries: int = 200) -> None:
        self._cache: dict[str, tuple[float, ResumeAnalysisResult]] = {}
        self._ttl = ttl_seconds
        self._max_entries = max_entries

    def compute_key(self, resume_text: str, job_description_text: str) -> str:
        """Generate deterministic MD5 hash key from resume content and target JD."""
        raw = f"{resume_text.strip()}|{job_description_text.strip()}".encode()
        return hashlib.md5(raw).hexdigest()

    def get(self, cache_key: str) -> ResumeAnalysisResult | None:
        """Retrieve cached analysis result if valid and not expired."""
        if cache_key not in self._cache:
            return None

        timestamp, result = self._cache[cache_key]
        if time.time() - timestamp > self._ttl:
            del self._cache[cache_key]
            return None

        logger.info("Analysis cache hit", cache_key=cache_key[:8])
        return result

    def set(self, cache_key: str, result: ResumeAnalysisResult) -> None:
        """Store analysis result in cache."""
        if len(self._cache) >= self._max_entries:
            # Evict oldest entry
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][0])
            del self._cache[oldest_key]

        self._cache[cache_key] = (time.time(), result)
        logger.debug("Analysis cache stored", cache_key=cache_key[:8])


# Singleton instance
global_analysis_cache = AnalysisCache()
