import logging
import urllib.parse
from typing import List

import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

from app.schemas.job_search import ScrapedJob

logger = logging.getLogger(__name__)

class JobSearchService:
    def __init__(self):
        try:
            self.ua = UserAgent()
        except Exception:
            self.ua = None

    def search_jobs(self, query: str, location: str, limit: int = 5) -> List[ScrapedJob]:
        """
        Attempts to scrape job results using Google search (as it often aggregates jobs better
        and is slightly less restrictive than direct Indeed/LinkedIn scraping, though still brittle).
        """
        try:
            headers = {
                "User-Agent": self.ua.random if self.ua else "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
            }
            jobs = []

            # For a more robust backend without an API key, we will scrape regular google search results
            # for Indeed and LinkedIn pages.
            search_query_direct = f"{query} {location} site:indeed.com OR site:linkedin.com/jobs/view"
            encoded_query_direct = urllib.parse.quote_plus(search_query_direct)
            url_direct = f"https://www.google.com/search?q={encoded_query_direct}"

            response = requests.get(url_direct, headers=headers, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')

            search_results = soup.find_all('div', class_='g')

            for result in search_results:
                if len(jobs) >= limit:
                    break

                title_elem = result.find('h3')
                link_elem = result.find('a')
                snippet_elem = result.find('div', style='-webkit-line-clamp:2') or result.find('div', class_='VwiC3b')

                if title_elem and link_elem:
                    title = title_elem.text
                    link = link_elem.get('href')
                    snippet = snippet_elem.text if snippet_elem else ""

                    # Try to extract company from title (e.g. "Software Engineer - Google - LinkedIn")
                    company = "Unknown"
                    if " - " in title:
                        parts = title.split(" - ")
                        if len(parts) > 1:
                            company = parts[1]

                    # Clean up link if needed
                    if link.startswith('/url?q='):
                        link = link.split('/url?q=')[1].split('&')[0]
                        link = urllib.parse.unquote(link)

                    jobs.append(ScrapedJob(
                        title=title,
                        company=company,
                        url=link,
                        snippet=snippet,
                        location=location
                    ))

            return jobs

        except Exception as e:
            logger.error(f"Error scraping jobs: {str(e)}")
            # Fallback to mock data if scraper fails/is blocked so the UI still works
            logger.info("Returning fallback mock jobs due to scraper error.")
            return [
                ScrapedJob(
                    title=f"{query} (Fallback Mock)",
                    company="Tech Corp",
                    url="https://www.indeed.com",
                    snippet=f"This is a fallback job description for {query} in {location} because the scraper was blocked.",
                    location=location
                ),
                ScrapedJob(
                    title=f"Senior {query} (Fallback Mock)",
                    company="Startup Inc",
                    url="https://www.linkedin.com",
                    snippet=f"Senior position requiring extensive experience as a {query}.",
                    location=location
                )
            ]
