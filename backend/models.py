from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from backend.database import Base

# ─── GS Department ────────────────────────────────────────────────────────────
GS_STATUS_CHOICES = [
    "GS Rejected", "GS approved", "GS document pending", "GS onhold",
    "GS submitted", "GS additional document request", "In Review",
    "Refund Requested", "Visa Refused", "Visa Granted", "Visa Lodged",
    "CoE Requested", "CoE Approved"
]

GS_STATUS_COLORS = {
    "GS Rejected":                    "#F8D7DA",
    "GS approved":                    "#D1E7DD",
    "GS document pending":            "#FFF3CD",
    "GS onhold":                      "#E2E3E5",
    "GS submitted":                   "#CFE2FF",
    "GS additional document request": "#FAD7F0",
    "In Review":                      "#E7D9FF",
    "Refund Requested":               "#FCE5CD",
    "Visa Refused":                   "#F4CCCC",
    "Visa Granted":                   "#D9EAD3",
    "Visa Lodged":                    "#D0E0E3",
    "CoE Requested":                  "#FFF2CC",
    "CoE Approved":                   "#D9D2E9",
}

# ─── Offer Department ──────────────────────────────────────────────────────────
OFFER_STATUS_CHOICES = [
    "On Hold", "Not Eligible", "Offer Request",
    "Offer Received", "Offer Rejected", "Document Requested"
]

OFFER_STATUS_COLORS = {
    "On Hold":           "#E2E3E5",
    "Not Eligible":      "#F8D7DA",
    "Offer Request":     "#FFF3CD",
    "Offer Received":    "#D1E7DD",
    "Offer Rejected":    "#F5C2C7",
    "Document Requested": "#CFE2FF",
}

OFFER_CHANNEL_CHOICES = ["Direct", "Expert", "KC overseas", "SIUK"]

# Keep legacy alias for existing code
STATUS_CHOICES = GS_STATUS_CHOICES
STATUS_COLORS = GS_STATUS_COLORS

ROLE_CHOICES = ["admin", "manager", "agent"]
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

    student_id = Column(Integer, ForeignKey("task_students.id"), nullable=False)
    university_id = Column(Integer, ForeignKey("task_universities.id"), nullable=True)
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
    channel = Column(String(100), nullable=True)       # Direct / Expert / KC overseas / SIUK
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
