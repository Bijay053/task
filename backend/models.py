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


class User(Base):
    __tablename__ = "task_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="agent", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assigned_applications = relationship(
        "Application", foreign_keys="Application.assigned_to_id", back_populates="assigned_to"
    )
    created_applications = relationship(
        "Application", foreign_keys="Application.created_by_id", back_populates="created_by"
    )
    activity_logs = relationship("ActivityLog", back_populates="changed_by_user")
    dept_permissions = relationship("UserDeptPermission", back_populates="user")


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

    # Department: 'gs' or 'offer'
    department = Column(String(20), default="gs", nullable=False)

    # Linked to directory (optional — raw name used when not in directory)
    student_id = Column(Integer, ForeignKey("task_students.id"), nullable=True)
    university_id = Column(Integer, ForeignKey("task_universities.id"), nullable=True)

    # Free-text fallback when not linked to directory
    student_name = Column(String(255), nullable=True)
    university_name = Column(String(255), nullable=True)

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
    assigned_to = relationship(
        "User", foreign_keys=[assigned_to_id], back_populates="assigned_applications"
    )
    created_by = relationship(
        "User", foreign_keys=[created_by_id], back_populates="created_applications"
    )
    activity_logs = relationship("ActivityLog", back_populates="application")


class ActivityLog(Base):
    __tablename__ = "task_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("task_applications.id"), nullable=False)
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

    user = relationship("User", back_populates="dept_permissions")

    __table_args__ = (UniqueConstraint("user_id", "department", name="uq_user_dept_perm"),)
