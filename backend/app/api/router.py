"""Top-level API router.

All versioned sub-routers are mounted here.  ``factory.py`` includes this
single router on the FastAPI application, so adding a new feature only
requires importing its router and calling ``api_router.include_router``.

Convention
----------
- Each feature area gets its own file under ``api/v1/``.
- Routers from those files are included below with an explicit ``prefix``
  and ``tags`` list so the OpenAPI docs are organised by feature.
"""
from fastapi import APIRouter

from app.api.v1 import (
    admin,
    analysis,
    auth,
    comparison,
    documents,
    guest_analysis,
    health,
    history,
    job_descriptions,
    payment,
    resume,
    review,
    structured_resume,
    support,
    tailor,
)

api_router = APIRouter()

# health.py declares the /health path internally so no extra prefix is needed.
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(payment.router)
api_router.include_router(documents.router)
api_router.include_router(job_descriptions.router)
api_router.include_router(analysis.router)
api_router.include_router(comparison.router)
api_router.include_router(review.router)
api_router.include_router(resume.router)
api_router.include_router(guest_analysis.router)
api_router.include_router(history.router)
api_router.include_router(structured_resume.router)
api_router.include_router(tailor.router)
api_router.include_router(support.router)
api_router.include_router(admin.router)



