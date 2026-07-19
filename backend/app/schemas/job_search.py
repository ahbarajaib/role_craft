from typing import List, Optional
from pydantic import BaseModel, Field

class JobSearchRequest(BaseModel):
    document_id: Optional[str] = Field(None, description="The ID of the uploaded resume document to score against. Optional — if omitted, jobs are returned without personalised ATS scoring.")
    query: str = Field(..., description="The job search query (e.g., 'Software Engineer').")
    location: str = Field(..., description="The location to search for jobs (e.g., 'New York, NY' or 'Remote').")
    limit: int = Field(5, description="Maximum number of jobs to return.")

class ScrapedJob(BaseModel):
    title: str = Field(..., description="The title of the job.")
    company: str = Field(..., description="The company offering the job.")
    url: str = Field(..., description="URL to the job application.")
    snippet: str = Field(..., description="A short snippet or description of the job.")
    location: Optional[str] = Field(None, description="Location of the job.")

class JobScoreResult(BaseModel):
    score: int = Field(..., description="ATS Match score (0-100).")
    rationale: str = Field(..., description="Brief rationale explaining the score.")

class ScoredJob(ScrapedJob):
    score: int = Field(..., description="ATS Match score (0-100).")
    rationale: str = Field(..., description="Brief rationale explaining the score.")

class JobSearchResponse(BaseModel):
    jobs: List[ScoredJob] = Field(..., description="List of jobs found and scored against the resume.")

class ScoreJobRequest(BaseModel):
    job_description: str
    resume_text: str
