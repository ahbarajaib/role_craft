"""Job search service.

Uses the JSearch API (via RapidAPI) as the primary job-search engine.
If JSEARCH_API_KEY is not configured, falls back to a Google-scraping
approach, which is less reliable from VPS IPs but still attempted.
"""

import logging
import urllib.parse
from typing import List

import requests

from app.schemas.job_search import ScrapedJob

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JSearch API (primary — fast, reliable, free tier 500 req/month)
# ---------------------------------------------------------------------------

JSEARCH_ENDPOINT = "https://jsearch.p.rapidapi.com/search"


def _search_via_jsearch(query: str, location: str, limit: int, api_key: str) -> List[ScrapedJob]:
    """Fetch jobs from the JSearch RapidAPI endpoint."""
    combined_query = f"{query} in {location}" if location and location.lower() not in ("remote", "") else query
    params = {
        "query": combined_query,
        "page": "1",
        "num_pages": "1",
        "date_posted": "all",
    }
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }
    resp = requests.get(JSEARCH_ENDPOINT, headers=headers, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    jobs: List[ScrapedJob] = []
    for item in data.get("data", [])[:limit]:
        # Build a clean location string from JSearch fields
        city = item.get("job_city") or ""
        state = item.get("job_state") or ""
        country = item.get("job_country") or ""
        is_remote = item.get("job_is_remote", False)

        if is_remote:
            display_location = "Remote"
        elif city:
            display_location = f"{city}, {state}".strip(", ") if state else city
        elif state:
            display_location = state
        elif country:
            display_location = country
        else:
            display_location = location  # fall back to user's input

        jobs.append(
            ScrapedJob(
                title=item.get("job_title", "Unknown Role"),
                company=item.get("employer_name", "Unknown Company"),
                url=item.get("job_apply_link") or item.get("job_google_link") or "https://jsearch.p.rapidapi.com",
                snippet=(item.get("job_description") or "")[:400],
                location=display_location,
            )
        )
    return jobs


# ---------------------------------------------------------------------------
# Google-scrape fallback (unreliable from VPS IPs but tried when no API key)
# ---------------------------------------------------------------------------

def _search_via_google_scrape(query: str, location: str, limit: int) -> List[ScrapedJob]:
    """Scrape Google for job results. Brittle — Google blocks VPS IPs."""
    try:
        from bs4 import BeautifulSoup
        from fake_useragent import UserAgent
        ua = UserAgent()
    except ImportError:
        return []

    headers = {
        "User-Agent": ua.random,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    search_q = urllib.parse.quote_plus(
        f"{query} {location} site:indeed.com OR site:linkedin.com/jobs/view"
    )
    url = f"https://www.google.com/search?q={search_q}"

    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(resp.text, "html.parser")
    results = soup.find_all("div", class_="g")

    jobs: List[ScrapedJob] = []
    for result in results[:limit]:
        title_elem = result.find("h3")
        link_elem = result.find("a")
        snippet_elem = result.find("div", style="-webkit-line-clamp:2") or result.find(
            "div", class_="VwiC3b"
        )
        if not (title_elem and link_elem):
            continue
        title = title_elem.text
        link = link_elem.get("href", "")
        if link.startswith("/url?q="):
            link = urllib.parse.unquote(link.split("/url?q=")[1].split("&")[0])
        snippet = snippet_elem.text if snippet_elem else ""
        company = "Unknown"
        if " - " in title:
            parts = title.split(" - ")
            if len(parts) > 1:
                company = parts[1]
        jobs.append(
            ScrapedJob(
                title=title,
                company=company,
                url=link,
                snippet=snippet,
                location=location,
            )
        )
    return jobs


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class JobSearchService:
    """Searches for jobs using JSearch API (primary) or Google scraping (fallback)."""

    def __init__(self, api_key: str = "") -> None:
        self._api_key = api_key

    def search_jobs(self, query: str, location: str, limit: int = 5) -> List[ScrapedJob]:
        """Return a list of job postings matching *query* near *location*."""

        # ── 1. JSearch API (preferred) ────────────────────────────────────────
        if self._api_key:
            try:
                jobs = _search_via_jsearch(query, location, limit, self._api_key)
                if jobs:
                    logger.info(
                        "JSearch returned %d jobs for query=%r location=%r",
                        len(jobs), query, location,
                    )
                    return jobs
                logger.warning("JSearch returned 0 results — trying Google scrape fallback")
            except Exception as exc:
                logger.warning("JSearch API failed (%s) — trying Google scrape fallback", exc)

        # ── 2. Google scrape fallback ─────────────────────────────────────────
        try:
            jobs = _search_via_google_scrape(query, location, limit)
            if jobs:
                logger.info("Google scrape returned %d jobs", len(jobs))
                return jobs
            logger.warning("Google scrape returned 0 results")
        except Exception as exc:
            logger.warning("Google scrape failed: %s", exc)

        # ── 3. Nothing found ─────────────────────────────────────────────────
        return []
