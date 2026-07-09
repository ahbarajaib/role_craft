"""Request ID middleware.

Attaches a unique identifier to every incoming request so that all log
lines produced during request processing can be correlated.

Behaviour
---------
- If the client sends an ``X-Request-ID`` header, that value is reused
  (useful when a gateway or upstream service already assigned an ID).
- Otherwise, a new UUID4 is generated.
- The ID is stored on ``request.state.request_id`` so that route handlers
  and dependencies can read it without importing this module.
- The same ID is echoed in the ``X-Request-ID`` response header so the
  client can include it in bug reports or correlate it with its own logs.

Future work
-----------
Wire the request ID into Loguru's contextvars (``logger.contextualize``)
so that every log line emitted during the request automatically carries the
``request_id`` field.  That step is deferred until structured JSON logging
is configured.
"""

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

REQUEST_ID_HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    """ASGI middleware that assigns a unique ID to each HTTP request."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
