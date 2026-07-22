"""
Service for fetching and extracting job posting title, company, and description text from web URLs.
Bypasses anti-bot mechanisms (Cloudflare, Akamai, Indeed, LinkedIn) using Chrome 120 TLS Impersonation.
Supports Greenhouse, Lever, Ashby, Workday, Indeed (India/Global), LinkedIn, Glassdoor, and generic company career portals.
"""

import re
import urllib.parse
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
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
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Ch-Ua": '"Not-A.Brand";v="99", "Chromium";v="124", "Google Chrome";v="124"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"macOS"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

    async def fetch_and_parse_job_url(self, url: str) -> dict:
        """
        Fetch HTML from URL using Chrome 120 TLS Impersonation and parse Job Title, Company, and Description.
        """
        clean_url = url.strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        try:
            parsed_uri = urllib.parse.urlparse(clean_url)
            domain = parsed_uri.netloc.lower()
        except Exception:
            raise BadRequestError("Invalid URL format. Please check the web address.")

        # Extract LinkedIn Job ID if present in URL (e.g. currentJobId=4440780790 or /jobs/view/4440780790)
        linkedin_job_id = None
        if "linkedin.com" in domain:
            match = re.search(r"(?:currentJobId=|/jobs/view/|/jobs/view/\d+/|jobId=)(\d{8,12})", clean_url)
            if match:
                linkedin_job_id = match.group(1)
                logger.info(f"[JobUrlService] Extracted LinkedIn Job ID: {linkedin_job_id}")

        html_content = ""
        status_code = 0

        try:
            async with AsyncSession(impersonate="chrome120", timeout=15) as session:
                if linkedin_job_id:
                    # Fetch direct public guest job posting HTML from LinkedIn Public Guest API
                    guest_api_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{linkedin_job_id}"
                    logger.info(f"[JobUrlService] Fetching LinkedIn Guest API: {guest_api_url}")
                    response = await session.get(guest_api_url, headers=self.headers, allow_redirects=True)
                else:
                    response = await session.get(clean_url, headers=self.headers, allow_redirects=True)
                status_code = response.status_code
                html_content = response.text
        except Exception as e:
            logger.error(f"[JobUrlService] Error fetching URL {clean_url}: {str(e)}")
            # Fallback to standard httpx if curl_cffi hits an edge case
            try:
                import httpx
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    resp = await client.get(clean_url, headers=self.headers)
                    status_code = resp.status_code
                    html_content = resp.text
            except Exception as ex:
                raise BadRequestError(
                    f"Unable to connect to ({domain}). Please verify the link or paste the text directly."
                )

        soup = BeautifulSoup(html_content, "html.parser")

        # Strip noisy elements
        for elem in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "button", "iframe", "form"]):
            elem.decompose()

        job_title = self._extract_job_title(soup, domain)
        company_name = self._extract_company_name(soup, domain)

        if (
            status_code in [401, 403]
            or "security check" in job_title.lower()
            or "just a moment" in job_title.lower()
            or "captcha" in html_content.lower()
        ):
            logger.warning(f"[JobUrlService] Security check or CAPTCHA detected for domain {domain}")
            return {
                "success": False,
                "url": clean_url,
                "domain": domain,
                "job_title": job_title,
                "company_name": company_name,
                "error_message": (
                    f"Access to {domain} is protected by Cloudflare/CAPTCHA verification. "
                    "Please copy and paste the job description text directly below!"
                ),
            }

        raw_description = self._extract_job_description(soup, domain)

        header_lines = []
        if job_title and job_title != "Target Role":
            header_lines.append(f"Job Designation: {job_title}")
        if company_name and company_name != "Target Company":
            header_lines.append(f"Company: {company_name}")

        if header_lines:
            header_prefix = "\n".join(header_lines) + "\n\n"
            description_text = header_prefix + raw_description
        else:
            description_text = raw_description

        if not raw_description or len(raw_description.strip()) < 80:
            return {
                "success": False,
                "url": clean_url,
                "domain": domain,
                "job_title": job_title,
                "company_name": company_name,
                "error_message": (
                    "Could not extract sufficient job text from this page. "
                    "The job post might be inside a closed frame. Please paste the job description text directly."
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
        """Extract job title using domain-specific containers, og:title, and headings."""
        # Indeed Specific Title
        if "indeed" in domain:
            indeed_title = (
                soup.find("h1", class_=re.compile(r"jobsearch-JobInfoHeader-title|jobTitle", re.I))
                or soup.find("h2", class_=re.compile(r"jobsearch-JobInfoHeader-title|jobTitle", re.I))
            )
            if indeed_title:
                return self._clean_title_string(indeed_title.get_text())

        # LinkedIn Title
        if "linkedin" in domain:
            li_title = (
                soup.find("h1", class_=re.compile(r"top-card-layout__title|topcard__title", re.I))
                or soup.find("h2", class_=re.compile(r"top-card-layout__title|topcard__title", re.I))
                or soup.find("a", class_=re.compile(r"topcard__link", re.I))
            )
            if li_title:
                return self._clean_title_string(li_title.get_text())

        # Check OpenGraph title
        og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "og:title"})
        if og_title and og_title.get("content"):
            return self._clean_title_string(og_title["content"])

        # Check document title
        if soup.title and soup.title.string:
            return self._clean_title_string(soup.title.string)

        # Check H1 tags
        h1 = soup.find("h1")
        if h1:
            return self._clean_title_string(h1.get_text())

        return ""

    def _clean_title_string(self, raw_title: str) -> str:
        """Clean titles like 'Senior Developer - Indeed.com' -> 'Senior Developer'."""
        clean = raw_title.strip()
        parts = re.split(r"\s+[\|\-\–\—\:]\s+", clean)
        if parts:
            clean = parts[0].strip()
            clean = re.sub(r"^Job Application for\s+", "", clean, flags=re.I)
            clean = re.sub(r"\s+at\s+.*$", "", clean, flags=re.I)
            clean = re.sub(r"\s+-\s+Indeed.*$", "", clean, flags=re.I)
            clean = re.sub(r"\s+-\s+LinkedIn.*$", "", clean, flags=re.I)
            if len(clean) > 3 and len(clean) < 100:
                return clean
        return raw_title.strip()[:100]

    def _extract_company_name(self, soup: BeautifulSoup, domain: str) -> str:
        """Extract company name across Indeed, LinkedIn, Greenhouse, Lever, Ashby, Workday, and generic meta tags."""
        # 1. Indeed Company Selectors
        if "indeed" in domain:
            indeed_comp = (
                soup.find("div", attrs={"data-company-name": "true"})
                or soup.find("a", class_=re.compile(r"companyName|jobsearch-CompanyReview", re.I))
                or soup.find("div", class_=re.compile(r"companyName|jobsearch-InlineCompanyRating", re.I))
                or soup.find("span", class_=re.compile(r"companyName", re.I))
            )
            if indeed_comp:
                clean_comp = indeed_comp.get_text().strip()
                if clean_comp:
                    return clean_comp

        # 2. LinkedIn Company Selectors
        if "linkedin" in domain:
            li_comp = (
                soup.find("a", class_=re.compile(r"topcard__org-name-link|topcard__flavor--black-link", re.I))
                or soup.find("a", class_=re.compile(r"topcard__flavor", re.I))
                or soup.find("span", class_=re.compile(r"topcard__flavor", re.I))
            )
            if li_comp:
                clean_comp = li_comp.get_text().strip()
                if clean_comp:
                    return clean_comp

        # 3. Meta tag fallbacks (og:site_name, og:title, twitter:creator, author)
        og_site = soup.find("meta", property="og:site_name") or soup.find("meta", attrs={"name": "og:site_name"})
        if og_site and og_site.get("content"):
            return og_site["content"].strip()

        meta_author = soup.find("meta", attrs={"name": "author"}) or soup.find("meta", property="article:author")
        if meta_author and meta_author.get("content"):
            return meta_author["content"].strip()

        # 4. Text regex fallback (e.g. "DataAnnotation is committed to creating quality AI...")
        body_text = soup.get_text("\n", strip=True)
        match = re.search(r"(?:^|[.\n]\s*)([A-Z][a-zA-Z0-9\s]{1,30})\s+(?:is|are)\s+(?:committed|looking|hiring|seeking|building|a global|an enterprise|providing)", body_text)
        if match:
            possible_comp = match.group(1).strip()
            if possible_comp.lower() not in ["we", "this", "our", "the", "your", "indeed", "linkedin"]:
                return possible_comp

        # 5. Domain parsing fallback
        parts = domain.replace("www.", "").split(".")
        if len(parts) >= 2:
            base = parts[0]
            if base not in ["boards", "jobs", "workday", "greenhouse", "lever", "ashbyhq", "linkedin", "indeed", "in"]:
                return base.capitalize()
        return ""

    def _extract_job_description(self, soup: BeautifulSoup, domain: str) -> str:
        """Extract job description text using domain selectors or paragraph density."""
        container = None

        # Indeed Specific Selectors
        if "indeed" in domain:
            container = (
                soup.find("div", id="jobDescriptionText")
                or soup.find("div", class_=re.compile(r"jobsearch-jobDescriptionText|jobsearch-JobComponent-description", re.I))
            )

        # LinkedIn Selectors
        if not container and "linkedin" in domain:
            container = soup.find("div", class_=re.compile(r"description__text|show-more-less-html__markup", re.I))

        # Greenhouse
        if not container and "greenhouse" in domain:
            container = soup.find("id", "main") or soup.find("div", id="content") or soup.find("div", class_=re.compile(r"job|post", re.I))

        # Lever
        if not container and "lever" in domain:
            container = soup.find("div", class_=re.compile(r"content|posting", re.I))

        # Ashby
        if not container and "ashby" in domain:
            container = soup.find("div", class_=re.compile(r"job|posting", re.I))

        # Workday
        if not container and "workday" in domain:
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

        raw_text = container.get_text(separator="\n", strip=True)
        junk_patterns = [
            "skip to main content", "cookie policy", "terms of service", "all rights reserved",
            "privacy policy", "copyright ©", "sign in to save", "report job", "create alert",
            "employers / post job", "help center", "security check"
        ]

        clean_lines = []
        for line in raw_text.split("\n"):
            line_str = line.strip()
            if len(line_str) > 15 and not any(junk in line_str.lower() for junk in junk_patterns):
                clean_lines.append(line_str)

        unique_lines = []
        for line in clean_lines:
            if not unique_lines or unique_lines[-1] != line:
                unique_lines.append(line)

        return "\n\n".join(unique_lines)

job_url_service = JobUrlService()
