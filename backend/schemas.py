from datetime import datetime, date
from typing import Optional, List, Dict
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
    availability_status: Optional[str] = None
    manager_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    availability_status: str = "available"
    created_at: datetime
    manager_id: Optional[int] = None

    class Config:
        from_attributes = True


class UserAvailabilityUpdate(BaseModel):
    availability_status: str  # "available", "on_leave", "off_duty"


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


# ─── Agent (external partner / sub-agent) ──────────────────────────────────────

class AgentCreate(BaseModel):
    name: str
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class AgentOut(BaseModel):
    id: int
    name: str
    company_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    country: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    manager_id: Optional[int] = None

    class Config:
        from_attributes = True


# ─── Department Settings ────────────────────────────────────────────────────────

class DeptSettingUpdate(BaseModel):
    value: Optional[str] = None


class DeptSettingOut(BaseModel):
    id: int
    department: str
    key: str
    value: Optional[str]

    class Config:
        from_attributes = True


# ─── Application ───────────────────────────────────────────────────────────────

class ApplicationCreate(BaseModel):
    department: Optional[str] = "gs"
    app_id: Optional[str] = None
    # Directory links (optional — use raw name if not in directory)
    student_id: Optional[int] = None
    university_id: Optional[int] = None
    # Free-text fallback
    student_name: Optional[str] = None
    university_name: Optional[str] = None

    # External agent (sub-agent/partner)
    agent_id: Optional[int] = None

    # Internal staff assignee
    assigned_to_id: Optional[int] = None
    application_status: Optional[str] = None
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

    # Followers (staff who can view this task in their My Tasks)
    follower_ids: Optional[List[int]] = []


class ApplicationUpdate(BaseModel):
    app_id: Optional[str] = None
    university_id: Optional[int] = None
    university_name: Optional[str] = None
    agent_id: Optional[int] = None
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

    # Followers (None = don't change, [] = clear all, [...] = set to list)
    follower_ids: Optional[List[int]] = None


class FollowerUpdate(BaseModel):
    follower_ids: List[int] = []


class StatusUpdate(BaseModel):
    application_status: str


class AssignUpdate(BaseModel):
    assigned_to_id: Optional[int] = None


class ApplicationOut(BaseModel):
    id: int
    app_id: Optional[str]
    department: str
    student_id: Optional[int]
    university_id: Optional[int]
    agent_id: Optional[int]
    assigned_to_id: Optional[int]
    created_by_id: Optional[int]
    application_status: str
    assigned_date: Optional[date]
    intake: Optional[str]
    course: Optional[str]
    country: Optional[str]
    remarks: Optional[str]

    # Raw fallback names
    student_name: Optional[str]
    university_name: Optional[str]

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
    agent: Optional[AgentOut]
    assigned_to: Optional[UserOut]
    created_by: Optional[UserOut]

    # Followers: IDs for quick lookup, full user objects for display
    follower_ids: List[int] = []
    follower_users: List[UserOut] = []

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


# ─── Dashboard ─────────────────────────────────────────────────────────────────

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


# ─── App Statuses (dynamic) ────────────────────────────────────────────────────

class AppStatusCreate(BaseModel):
    department: str
    name: str
    text_color: Optional[str] = "#000000"
    bg_color: Optional[str] = "#f1f5f9"


class AppStatusUpdate(BaseModel):
    name: Optional[str] = None
    text_color: Optional[str] = None
    bg_color: Optional[str] = None
    is_active: Optional[bool] = None


class AppStatusReorder(BaseModel):
    ordered_ids: List[int]   # status IDs in desired order


class AppStatusOut(BaseModel):
    id: int
    department: str
    name: str
    text_color: str
    bg_color: str
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


# ─── Permissions ───────────────────────────────────────────────────────────────

class UserDeptPermOut(BaseModel):
    id: int
    user_id: int
    department: str
    can_view: bool
    can_edit: bool
    can_delete: bool
    can_upload: bool

    class Config:
        from_attributes = True


class UserDeptPermUpdate(BaseModel):
    can_view: bool = True
    can_edit: bool = False
    can_delete: bool = False
    can_upload: bool = False


# ─── Roles (dynamic, admin-managed) ────────────────────────────────────────────

class RoleOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str


class RoleUpdate(BaseModel):
    name: str


class RolePermOut(BaseModel):
    id: int
    role: str
    department: str
    can_view: bool
    can_edit: bool
    can_delete: bool
    can_upload: bool
    can_view_all_users: bool = False
    can_view_mapped_users: bool = False

    class Config:
        from_attributes = True


class RolePermUpdate(BaseModel):
    can_view: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_upload: bool = False
    can_view_all_users: bool = False
    can_view_mapped_users: bool = False


# ─── Reports ───────────────────────────────────────────────────────────────────

class StaffPerformance(BaseModel):
    user_id: int
    full_name: str
    role: str
    total_assigned: int
    gs_count: int
    offer_count: int
    status_breakdown: dict


class StaffTimingReport(BaseModel):
    user_id: int
    full_name: str
    role: str
    total_gs: int
    pending_gs: int
    completed_gs: int
    avg_handling_days: Optional[float]       # avg days from assigned_date to last action
    avg_completion_days: Optional[float]     # avg days from creation to last status change for completed
    avg_first_action_days: Optional[float]   # avg days before first update (status change)
    avg_stage_days: Optional[Dict[str, float]]  # avg days per stage for this user's GS apps


class StageReport(BaseModel):
    status: str
    department: str
    total_transitions: int
    avg_days: Optional[float]
    min_days: Optional[float]
    max_days: Optional[float]
    currently_in_stage: int


class AppTimeline(BaseModel):
    application_id: int
    student_name: str
    current_status: str
    created_at: datetime
    total_days: float
    assigned_to: Optional[str]
    stages: List[Dict]  # [{status, entered_at, exited_at, duration_days, changed_by}]


# ─── Notifications ─────────────────────────────────────────────────────────────

class NotificationTest(BaseModel):
    type: str
    target: str


class MessageResponse(BaseModel):
    message: str


class HealthStatus(BaseModel):
    status: str


# ─── Bulk Upload ───────────────────────────────────────────────────────────────

class BulkUploadResult(BaseModel):
    created: int
    skipped: int
    errors: List[str]


class ListApplicationsParams(BaseModel):
    department: Optional[str] = None
    assigned_to_id: Optional[int] = None
    status: Optional[str] = None
    search: Optional[str] = None


class MyApplicationsParams(BaseModel):
    department: Optional[str] = None


class ListStudentsParams(BaseModel):
    search: Optional[str] = None


class ListUniversitiesParams(BaseModel):
    search: Optional[str] = None


Token.model_rebuild()
