from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class UserSignupRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class UserLoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    linkedin_url: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    provider: str
    credits: int
    plan_type: str
    subscription_status: str
    base_resume_id: Optional[str] = None
    base_resume_filename: Optional[str] = None
    base_cover_letter_id: Optional[str] = None
    base_cover_letter_filename: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    linkedin_url: Optional[str] = None
    missing_skills_tracker: Optional[dict[str, int]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserResponse] = None
    error_message: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class MessageResponse(BaseModel):
    message: str
    success: bool = True

