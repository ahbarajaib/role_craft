from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserSignupRequest(BaseModel):
    email: str
    password: str
    name: str | None = None

class UserLoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    phone_number: str | None = None
    address: str | None = None
    linkedin_url: str | None = None

class UserResponse(BaseModel):
    id: int
    email: str
    name: str | None = None
    provider: str
    credits: int
    plan_type: str
    subscription_status: str
    base_resume_id: str | None = None
    base_resume_filename: str | None = None
    base_cover_letter_id: str | None = None
    base_cover_letter_filename: str | None = None
    phone_number: str | None = None
    address: str | None = None
    linkedin_url: str | None = None
    missing_skills_tracker: dict[str, int] | None = None
    is_admin: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AuthResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    user: UserResponse | None = None
    error_message: str | None = None

class ForgotPasswordRequest(BaseModel):
    email: str

class MessageResponse(BaseModel):
    message: str
    success: bool = True

