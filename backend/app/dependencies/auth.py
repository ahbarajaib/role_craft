from fastapi import Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedError
from app.models import User

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    token: str | None = Query(None),
    db: Session = Depends(get_db)
) -> User:
    """Authenticate the access token (from Header or ?token query param) and return User."""
    raw_token = credentials.credentials if credentials else token
    if not raw_token:
        raise UnauthorizedError("Authorization header is missing or invalid.")
    
    payload = decode_access_token(raw_token)
    if not payload or "sub" not in payload:
        raise UnauthorizedError("Session has expired or token is invalid.")
    
    email = payload["sub"]
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise UnauthorizedError("User profile not found.")
    
    return user

def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    token: str | None = Query(None),
    db: Session = Depends(get_db)
) -> User | None:
    """Retrieve the user context optionally if Bearer token or ?token param is provided."""
    raw_token = credentials.credentials if credentials else token
    if not raw_token:
        return None
    
    payload = decode_access_token(raw_token)
    if not payload or "sub" not in payload:
        return None
    
    email = payload["sub"]
    return db.query(User).filter(User.email == email).first()
