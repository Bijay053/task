from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from backend.database import Base

# ─── GS Department (default seed) ─────────────────────────────────────────────
GS_STATUS_DEFAULTS = [
    ("GS Rejected",                    "#842029", "#F8D7DA", 1),
    ("GS approved",                    "#0F5132", "#D1E7DD", 2),
    ("GS document pending",            "#664D03", "#FFF3CD", 3),
    ("GS onhold",                      "#41464B", "#E2E3E5", 4),
    ("GS submitted",                   "#084298", "#CFE2FF", 5),
    ("GS additional document request", "#7B1A5F", "#FAD7F0", 6),
    ("In Review",                      "#410B98", "#E7D9FF", 7),
    ("Refund Requested",               "#7D4005", "#FCE5CD", 8),
    ("Visa Refused",                   "#7A1414", "#F4CCCC", 9),
    ("Visa Granted",                   "#194D0C", "#D9EAD3", 10),
    ("Visa Lodged",                    "#0C434A", "#D0E0E3", 11),
    ("CoE Requested",                  "#665100", "#FFF2CC", 12),
    ("CoE Approved",                   "#2A185C", "#D9D2E9", 13),
]

# ─── Offer Department (default seed) ──────────────────────────────────────────
OFFER_STATUS_DEFAULTS = [
    ("On Hold",            "#41464B", "#E2E3E5", 1),
    ("Not Eligible",       "#842029", "#F8D7DA", 2),
    ("Offer Request",      "#664D03", "#FFF3CD", 3),
    ("Offer Received",     "#0F5132", "#D1E7DD", 4),
    ("Offer Rejected",     "#7A1414", "#F5C2C7", 5),
    ("Document Requested", "#084298", "#CFE2FF", 6),
]

# Legacy aliases for backward compatibility
GS_STATUS_CHOICES = [s[0] for s in GS_STATUS_DEFAULTS]
OFFER_STATUS_CHOICES = [s[0] for s in OFFER_STATUS_DEFAULTS]
GS_STATUS_COLORS = {s[0]: s[2] for s in GS_STATUS_DEFAULTS}
OFFER_STATUS_COLORS = {s[0]: s[2] for s in OFFER_STATUS_DEFAULTS}
STATUS_CHOICES = GS_STATUS_CHOICES
STATUS_COLORS = GS_STATUS_COLORS

OFFER_CHANNEL_CHOICES = ["Direct", "Expert", "KC overseas", "SIUK"]
ROLE_CHOICES = ["admin", "manager", "team_leader", "agent"]
DEPARTMENT_CHOICES = ["gs", "offer"]
AVAILABILITY_CHOICES = ["available", "on_leave", "off_duty"]


class User(Base):
    __tablename__ = "task_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="agent", nullable=False)
    is_active = Column(Boolean, default=True)
    availability_status = Column(String(50), default="available", nullable=False)
    work_days = Column(String(100), nullable=True)
    work_start_time = Column(String(10), nullable=True)
    work_end_time = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    password_changed_at = Column(DateTime, default=datetime.utcnow)
    token_version = Column(Integer, default=0, nullable=False, server_default="0")
    failed_login_attempts = Column(Integer, default=0, nullable=False, server_default="0")
    locked_until = Column(DateTime, nullable=True)

    manager_id = Column(Integer, ForeignKey("task_users.id", ondelete="SET NULL"), nullable=True)

    assigned_applications = relationship(
        "Application", foreign_keys="Application.assigned_to_id", back_populates="assigned_to"
    )
    created_applications = relationship(
        "Application", foreign_keys="Application.created_by_id", back_populates="created_by"
    )
    activity_logs = relationship("ActivityLog", back_populates="changed_by_user")
    dept_permissions = relationship("UserDeptPermission", back_populates="user")
    managed_agents = relationship("ManagerAgentMapping", foreign_keys="ManagerAgentMapping.manager_id", back_populates="manager")


class Agent(Base):
    """External agents / sub-agents / agencies (not internal staff)."""
    __tablename__ = "task_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    applications = relationship("Application", back_populates="agent")
    manager_mappings = relationship("ManagerAgentMapping", back_populates="agent")


class ManagerAgentMapping(Base):
    """Maps managers to the external agents they are responsible for."""
    __tablename__ = "task_manager_agent_mappings"

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("task_users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("task_agents.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    manager = relationship("User", foreign_keys=[manager_id], back_populates="managed_agents")
    agent = relationship("Agent", back_populates="manager_mappings")

    __table_args__ = (UniqueConstraint("manager_id", "agent_id", name="uq_manager_agent"),)


class DeptSetting(Base):
    """Per-department key-value settings (e.g., Google Chat webhook URL)."""
    __tablename__ = "task_dept_settings"

    id = Column(Integer, primary_key=True, index=True)
    department = Column(String(20), nullable=False)   # 'gs' or 'offer'
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("department", "key", name="uq_dept_setting"),)


class Student(Base):
    __tablename__ = "task_students"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    passport_no = Column(String(100), nullable=True)
    dob = Column(Date, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    applications = relationship("Application", back_populates="student")


class University(Base):
    __tablename__ = "task_universities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    country = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    applications = relationship("Application", back_populates="university")


class Application(Base):
    __tablename__ = "task_applications"

    id = Column(Integer, primary_key=True, index=True)

    # User-assigned application reference code (e.g. "GS-001", "REF-2024-001")
    app_id = Column(String(100), nullable=True)

    # Department: 'gs' or 'offer'
    department = Column(String(20), default="gs", nullable=False)

    # Linked to directory (optional — raw name used when not in directory)
    student_id = Column(Integer, ForeignKey("task_students.id"), nullable=True)
    university_id = Column(Integer, ForeignKey("task_universities.id"), nullable=True)

    # Free-text fallback when not linked to directory
    student_name = Column(String(255), nullable=True)
    university_name = Column(String(255), nullable=True)

    # External agent (sub-agent / agency) who referred the student
    agent_id = Column(Integer, ForeignKey("task_agents.id"), nullable=True)

    # Internal staff member responsible for handling the application
    assigned_to_id = Column(Integer, ForeignKey("task_users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("task_users.id"), nullable=True)

    application_status = Column(String(100), default="In Review")
    assigned_date = Column(Date, nullable=True)

    # Shared fields
    intake = Column(String(100), nullable=True)
    course = Column(String(255), nullable=True)
    country = Column(String(100), nullable=True)
    remarks = Column(Text, nullable=True)

    # GS-specific fields
    priority = Column(String(50), default="normal")
    source = Column(String(100), nullable=True)
    submitted_date = Column(Date, nullable=True)
    verification = Column(String(255), nullable=True)

    # Offer-specific fields
    channel = Column(String(100), nullable=True)
    offer_applied_date = Column(Date, nullable=True)
    offer_received_date = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="applications")
    university = relationship("University", back_populates="applications")
    agent = relationship("Agent", back_populates="applications")
    assigned_to = relationship(
        "User", foreign_keys=[assigned_to_id], back_populates="assigned_applications"
    )
    created_by = relationship(
        "User", foreign_keys=[created_by_id], back_populates="created_applications"
    )
    activity_logs = relationship("ActivityLog", back_populates="application", cascade="all, delete-orphan")
    followers = relationship("ApplicationFollower", back_populates="application", cascade="all, delete-orphan")

    @property
    def follower_ids(self) -> list:
        return [f.user_id for f in self.followers]

    @property
    def follower_users(self) -> list:
        return [f.user for f in self.followers if f.user]


class ActivityLog(Base):
    __tablename__ = "task_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("task_applications.id", ondelete="CASCADE"), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("task_users.id"), nullable=True)
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", back_populates="activity_logs")
    changed_by_user = relationship("User", back_populates="activity_logs")


class AppStatus(Base):
    """Dynamic status definitions per department (admin-managed)."""
    __tablename__ = "task_app_statuses"

    id = Column(Integer, primary_key=True, index=True)
    department = Column(String(20), nullable=False)      # 'gs' or 'offer'
    name = Column(String(100), nullable=False)
    text_color = Column(String(20), default="#000000")   # hex
    bg_color = Column(String(20), default="#f1f5f9")     # hex
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("department", "name", name="uq_dept_status_name"),)


class UserDeptPermission(Base):
    """Per-user, per-department access permissions."""
    __tablename__ = "task_user_dept_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("task_users.id"), nullable=False)
    department = Column(String(20), nullable=False)   # 'gs' or 'offer'
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_upload = Column(Boolean, default=False)

    user = relationship("User", back_populates="dept_permissions")

    __table_args__ = (UniqueConstraint("user_id", "department", name="uq_user_dept_perm"),)


class Role(Base):
    """Admin-managed custom roles (fully manual, no defaults)."""
    __tablename__ = "task_roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class RolePermission(Base):
    """Permissions per role per department — the ONLY source of truth for access."""
    __tablename__ = "task_role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(100), nullable=False)
    department = Column(String(20), nullable=False)
    can_view = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_upload = Column(Boolean, default=False)
    can_view_all_users = Column(Boolean, default=False)
    can_view_mapped_users = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("role", "department", name="uq_role_dept_perm"),)


class SystemAuditLog(Base):
    """Tracks system-level user events (logins, password changes, etc.)."""
    __tablename__ = "task_system_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("task_users.id", ondelete="SET NULL"), nullable=True)
    user_email = Column(String(255), nullable=True)   # kept even if user deleted
    action = Column(String(100), nullable=False)      # e.g. "login", "logout", "change_password"
    detail = Column(Text, nullable=True)
    ip_address = Column(String(60), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], passive_deletes=True)


class OtpCode(Base):
    """One-time password codes for 2-step login verification."""
    __tablename__ = "task_otp_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("task_users.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class PasswordResetToken(Base):
    """Tokens for password reset via email link."""
    __tablename__ = "task_password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("task_users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class ApplicationFollower(Base):
    """Staff members who follow (watch) an application — they can view it in My Tasks."""
    __tablename__ = "task_application_followers"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("task_applications.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("task_users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("application_id", "user_id", name="uq_app_follower"),)

    application = relationship("Application", back_populates="followers")
    user = relationship("User")
