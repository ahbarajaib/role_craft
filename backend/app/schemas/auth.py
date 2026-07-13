from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class UserSignupRequest(BaseModel):
    email: str
    password: str

class UserLoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

class UserResponse(BaseModel):
    id: int
    email: str
    provider: str
    credits: int
    created_at: datetime

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
