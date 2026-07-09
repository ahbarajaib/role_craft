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

from app.api.v1 import health

api_router = APIRouter()

# health.py declares the /health path internally so no extra prefix is needed.
api_router.include_router(health.router)

# Future routers follow this pattern:
# from app.api.v1 import resumes, auth
# api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
# api_router.include_router(auth.router,    prefix="/auth",    tags=["auth"])

