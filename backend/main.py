"""Uvicorn entry point.

This module is intentionally minimal.  All application wiring happens
inside ``app.factory.create_app`` so that tests can call it in isolation
without importing this file.

Run locally
-----------
    uvicorn main:app --reload

Or via the convenience helper below:
    python main.py
"""

import uvicorn

from app.factory import create_app

app = create_app()

if __name__ == "__main__":
    from app.core.config import get_settings

    settings = get_settings()

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
