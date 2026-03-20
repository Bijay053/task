from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "agent"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StudentCreate(BaseModel):
    full_name: str
    passport_no: Optional[str] = None
    dob: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    passport_no: Optional[str] = None
    dob: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class StudentOut(BaseModel):
    id: int
    full_name: str
    passport_no: Optional[str]
    dob: Optional[date]
    phone: Optional[str]
    email: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class UniversityCreate(BaseModel):
    name: str
    country: Optional[str] = None


class UniversityUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None


class UniversityOut(BaseModel):
    id: int
    name: str
    country: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationCreate(BaseModel):
    department: Optional[str] = "gs"           # 'gs' or 'offer'
    student_id: int
    university_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    application_status: Optional[str] = None   # defaults set per-department in router
    intake: Optional[str] = None
    course: Optional[str] = None
    country: Optional[str] = None
    remarks: Optional[str] = None

    # GS-specific
    priority: Optional[str] = "normal"
    source: Optional[str] = None
    submitted_date: Optional[date] = None
    verification: Optional[str] = None

    # Offer-specific
    channel: Optional[str] = None
    offer_applied_date: Optional[date] = None
    offer_received_date: Optional[date] = None


class ApplicationUpdate(BaseModel):
    university_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    application_status: Optional[str] = None
    intake: Optional[str] = None
    course: Optional[str] = None
    country: Optional[str] = None
    remarks: Optional[str] = None

    # GS-specific
    priority: Optional[str] = None
    source: Optional[str] = None
    submitted_date: Optional[date] = None
    verification: Optional[str] = None

    # Offer-specific
    channel: Optional[str] = None
    offer_applied_date: Optional[date] = None
    offer_received_date: Optional[date] = None


class StatusUpdate(BaseModel):
    application_status: str


class AssignUpdate(BaseModel):
    assigned_to_id: Optional[int] = None


class ApplicationOut(BaseModel):
    id: int
    department: str
    student_id: int
    university_id: Optional[int]
    assigned_to_id: Optional[int]
    created_by_id: Optional[int]
    application_status: str
    assigned_date: Optional[date]
    intake: Optional[str]
    course: Optional[str]
    country: Optional[str]
    remarks: Optional[str]

    # GS-specific
    priority: Optional[str]
    source: Optional[str]
    submitted_date: Optional[date]
    verification: Optional[str]

    # Offer-specific
    channel: Optional[str]
    offer_applied_date: Optional[date]
    offer_received_date: Optional[date]

    created_at: datetime
    updated_at: datetime
    student: Optional[StudentOut]
    university: Optional[UniversityOut]
    assigned_to: Optional[UserOut]
    created_by: Optional[UserOut]

    class Config:
        from_attributes = True


class ActivityLogOut(BaseModel):
    id: int
    application_id: int
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_at: datetime
    changed_by_user: Optional[UserOut]

    class Config:
        from_attributes = True


class DashboardSummary(BaseModel):
    total: int
    pending: int
    approved: int
    refused: int


class StatusCount(BaseModel):
    status: str
    count: int
    color: str


class AssigneeCount(BaseModel):
    assignee_name: str
    count: int


class UniversityCount(BaseModel):
    university_name: str
    count: int


class NotificationTest(BaseModel):
    type: str
    target: str


Token.model_rebuild()
