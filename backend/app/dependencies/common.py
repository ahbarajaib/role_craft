"""Shared FastAPI dependency factories.

These functions are injected into route handlers via ``Depends``.  Keeping
them here rather than inline in route files means they can be overridden in
tests via ``app.dependency_overrides`` and reused across multiple routers
without duplication.
"""

from fastapi import Request

from app.core.config import Settings
from app.core.config import get_settings as _get_settings


def get_settings() -> Settings:
    """Return the application settings singleton.

    Re-exported here so that route handlers import from ``dependencies``
    rather than from ``core``, which keeps the HTTP layer decoupled from
    the infrastructure layer.

    Example usage in a route::

        @router.get("/example")
        async def example(settings: Annotated[Settings, Depends(get_settings)]):
            return {"app": settings.APP_NAME}
    """
    return _get_settings()


def get_request_id(request: Request) -> str:
    """Return the request ID attached by ``RequestIDMiddleware``.

    Raises ``AttributeError`` if called on a request that did not pass
    through the middleware, which should never happen in production.
    """
    return request.state.request_id  # type: ignore[no-any-return]
