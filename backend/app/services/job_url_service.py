"""
Service for fetching and extracting job posting title, company, and description text from web URLs.
Supports Greenhouse, Lever, Ashby, Workday, Indeed (including in.indeed.com), LinkedIn, and generic company career portals.
Uses Chrome TLS Fingerprint impersonation (curl_cffi) to bypass Cloudflare and anti-bot protection.
"""

import re
import urllib.parse
import httpx
from bs4 import BeautifulSoup
from app.core.logging import logger
from app.core.exceptions import BadRequestError

class JobUrlService:
    def __init__(self):
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    async def fetch_and_parse_job_url(self, url: str) -> dict:
        """
        Fetch HTML from URL and parse out Job Title, Company Name, and Job Description text.
        Bypasses Cloudflare / Anti-Bot checks using Chrome TLS fingerprint impersonation.
        """
        clean_url = url.strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        try:
            parsed_uri = urllib.parse.urlparse(clean_url)
            domain = parsed_uri.netloc.lower()
        except Exception:
            raise BadRequestError("Invalid URL format. Please check the web address.")

        logger.info(f"[JobUrlService] Fetching job posting from URL: {clean_url} (Domain: {domain})")

        html_content = ""
        status_code = 200

        # Primary fetch method: Chrome TLS Fingerprint impersonation (bypasses Cloudflare, Indeed, LinkedIn bot checks)
        try:
            from curl_cffi import requests as curl_requests
            res = curl_requests.get(
                clean_url,
                headers=self.headers,
                impersonate="chrome",
                allow_redirects=True,
                timeout=15
            )
            status_code = res.status_code
            html_content = res.text
            logger.info(f"[JobUrlService] curl_cffi fetched {len(html_content)} bytes with status {status_code}")
        except Exception as curl_err:
            logger.warning(f"[JobUrlService] curl_cffi fetch failed ({str(curl_err)}). Falling back to httpx...")
            try:
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    response = await client.get(clean_url, headers=self.headers)
                status_code = response.status_code
                html_content = response.text
            except Exception as e:
                logger.error(f"[JobUrlService] Network error fetching URL {clean_url}: {str(e)}")
                raise BadRequestError(
                    f"Unable to connect to web address ({domain}). Please verify the link or paste the text directly."
                )

        if status_code in [401, 403]:
            logger.warning(f"[JobUrlService] Access blocked ({status_code}) for domain {domain}")
            return {
                "success": False,
                "url": clean_url,
                "domain": domain,
                "error_message": (
                    f"{domain} requires user login or blocks automated fetching. "
                    "Please copy and paste the job description text directly!"
                ),
            }

        if status_code != 200:
            raise BadRequestError(
                f"Server returned HTTP {status_code} status for {domain}. "
                "Please check the URL or paste the job text manually."
            )

        soup = BeautifulSoup(html_content, "html.parser")

        # Strip scripts, styles, header, footer, nav
        for elem in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "button", "iframe"]):
            elem.decompose()

        job_title = self._extract_job_title(soup, domain)
        company_name = self._extract_company_name(soup, domain)
        description_text = self._extract_job_description(soup, domain)

        if not description_text or len(description_text.strip()) < 80:
            return {
                "success": False,
                "url": clean_url,
                "domain": domain,
                "job_title": job_title,
                "company_name": company_name,
                "error_message": (
                    "Could not extract sufficient text from this page (less than 80 chars). "
                    "The job post might be protected or inside an iframe. Please paste the job description text directly."
                ),
            }

        return {
            "success": True,
            "url": clean_url,
            "domain": domain,
            "job_title": job_title or "Target Role",
            "company_name": company_name or "Target Company",
            "job_description": description_text,
            "char_count": len(description_text),
        }

    def _extract_job_title(self, soup: BeautifulSoup, domain: str) -> str:
        """Extract job title using og:title, meta tags, and h1 headers."""
        # Check OpenGraph title
        og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "og:title"})
        if og_title and og_title.get("content"):
            title = og_title["content"].strip()
            return self._clean_title_string(title)

        # Check Indeed specific title
        if "indeed" in domain:
            job_h1 = soup.find("h1", class_=re.compile(r"jobsearch-JobInfoHeader-title|title", re.I))
            if job_h1:
                return self._clean_title_string(job_h1.get_text())

        # Check document title
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
            return self._clean_title_string(title)

        # Check H1 tags
        h1 = soup.find("h1")
        if h1:
            return self._clean_title_string(h1.get_text())

        return ""

    def _clean_title_string(self, raw_title: str) -> str:
        """Clean titles like 'Senior Software Engineer - Indeed' -> 'Senior Software Engineer'."""
        parts = re.split(r"\s+[\|\-\–\—\:]\s+", raw_title)
        if parts:
            clean = parts[0].strip()
            clean = re.sub(r"^Job Application for\s+", "", clean, flags=re.I)
            clean = re.sub(r"\s+at\s+.*$", "", clean, flags=re.I)
            if len(clean) > 3 and len(clean) < 100:
                return clean
        return raw_title.strip()[:100]

    def _extract_company_name(self, soup: BeautifulSoup, domain: str) -> str:
        """Extract company name from metadata."""
        og_site = soup.find("meta", property="og:site_name")
        if og_site and og_site.get("content"):
            return og_site["content"].strip()

        parts = domain.replace("www.", "").split(".")
        if len(parts) >= 2:
            base = parts[0]
            if base not in ["boards", "jobs", "workday", "greenhouse", "lever", "ashbyhq", "linkedin", "indeed"]:
                return base.capitalize()
        return ""

    def _extract_job_description(self, soup: BeautifulSoup, domain: str) -> str:
        """Extract job description text using domain containers or text density heuristics."""
        container = None

        # Domain specific selectors
        if "indeed" in domain:
            container = (
                soup.find("div", id="jobDescriptionText")
                or soup.find("div", class_=re.compile(r"jobsearch-JobComponent-description|jobDescriptionText", re.I))
                or soup.find("div", id=re.compile(r"jobDescription", re.I))
            )
        elif "greenhouse.io" in domain:
            container = soup.find("id", "main") or soup.find("div", id="content") or soup.find("div", class_=re.compile(r"job|post", re.I))
        elif "lever.co" in domain:
            container = soup.find("div", class_=re.compile(r"content|posting", re.I))
        elif "ashbyhq.com" in domain:
            container = soup.find("div", class_=re.compile(r"job|posting", re.I))
        elif "workday" in domain:
            container = soup.find("div", attrs={"data-automation-id": re.compile(r"jobPostingDescription", re.I)})

        if not container:
            container = (
                soup.find("main")
                or soup.find("article")
                or soup.find("div", id=re.compile(r"job|description|details", re.I))
                or soup.find("div", class_=re.compile(r"job-description|description|posting-content", re.I))
                or soup.body
            )

        if not container:
            container = soup

        # Extract text paragraphs and bullet points cleanly
        lines = []
        for element in container.find_all(["p", "li", "h1", "h2", "h3", "h4", "div"]):
            if element.name == "div" and element.find_all(["p", "li"]):
                continue
            text = element.get_text().strip()
            if text and len(text) > 15:
                if element.name == "li" and not text.startswith(("•", "-", "*")):
                    text = f"• {text}"
                lines.append(text)

        # Deduplicate consecutive lines
        unique_lines = []
        for line in lines:
            if not unique_lines or unique_lines[-1] != line:
                unique_lines.append(line)

        return "\n\n".join(unique_lines)

job_url_service = JobUrlService()
