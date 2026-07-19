"""Jobs router – search for jobs and score them against a user's resume."""

import concurrent.futures
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.schemas.job_search import JobSearchRequest, JobSearchResponse, ScoredJob
from app.services.job_search_service import JobSearchService
from app.services.ats_scoring_service import ATSScoringService
from app.services.parser_service import ParserService
from app.dependencies.jobs import get_job_search_service, get_ats_scoring_service
from app.dependencies.parser import get_parser_service

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("/search-and-score", response_model=JobSearchResponse)
def search_and_score_jobs(
    request: JobSearchRequest,
    job_search_service: Annotated[JobSearchService, Depends(get_job_search_service)],
    ats_scoring_service: Annotated[ATSScoringService, Depends(get_ats_scoring_service)],
    parser_service: Annotated[ParserService, Depends(get_parser_service)],
) -> JobSearchResponse:
    """Search for jobs and score each result against the user's uploaded resume."""

    # 1. Parse the resume — ParserService resolves the file path from document_id internally
    try:
        parsed_doc = parser_service.parse_document(request.document_id)
        resume_text = "\n".join(p.text for p in parsed_doc.paragraphs if p.text.strip())
    except Exception as e:
        raise HTTPException(
            status_code=404, detail=f"Failed to load or parse resume: {str(e)}"
        )

    # 2. Scrape / search for jobs
    scraped_jobs = job_search_service.search_jobs(
        query=request.query,
        location=request.location,
        limit=request.limit,
    )

    if not scraped_jobs:
        return JobSearchResponse(jobs=[])

    # 3. Score each job against the resume in parallel LLM calls
    def score_single_job(job):
        try:
            job_text = (
                f"Title: {job.title}\n"
                f"Company: {job.company}\n"
                f"Description snippet: {job.snippet}"
            )
            score_result = ats_scoring_service.score_job(
                resume_text=resume_text,
                job_description=job_text,
            )
            return ScoredJob(
                title=job.title,
                company=job.company,
                url=job.url,
                snippet=job.snippet,
                location=job.location,
                score=score_result.score,
                rationale=score_result.rationale,
            )
        except Exception as exc:
            return ScoredJob(
                title=job.title,
                company=job.company,
                url=job.url,
                snippet=job.snippet,
                location=job.location,
                score=0,
                rationale=f"Failed to score: {str(exc)}",
            )

    with concurrent.futures.ThreadPoolExecutor(max_workers=request.limit) as executor:
        scored_jobs = list(executor.map(score_single_job, scraped_jobs))

    scored_jobs.sort(key=lambda x: x.score, reverse=True)

    return JobSearchResponse(jobs=scored_jobs)
