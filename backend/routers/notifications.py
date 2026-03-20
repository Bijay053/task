import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx

from backend.database import get_db
from backend.auth import get_current_user, require_admin
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/notifications", tags=["notifications"])


def get_webhook_for_dept(db: Session, department: str) -> str:
    """Look up department-specific webhook from DB, fall back to env var."""
    setting = db.query(models.DeptSetting).filter_by(
        department=department, key="google_chat_webhook"
    ).first()
    if setting and setting.value:
        return setting.value
    return os.environ.get("GOOGLE_CHAT_WEBHOOK", "")


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via SMTP. Returns True if sent, False if not configured or failed."""
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")

    if not smtp_host or not smtp_user or not to_email:
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        return True
    except Exception:
        return False


def send_chat_notification(db: Session, department: str, text: str) -> bool:
    """Send a Google Chat notification to the correct department webhook."""
    webhook_url = get_webhook_for_dept(db, department)
    if not webhook_url:
        return False
    try:
        httpx.post(webhook_url, json={"text": text}, timeout=5)
        return True
    except Exception:
        return False


def send_assignment_notification(
    db: Session,
    app: models.Application,
    assignee: models.User,
    assigner_name: str,
):
    """Send email + Google Chat notification when an application is assigned to a staff member."""
    if not assignee:
        return

    dept = app.department
    student = app.student_name or (app.student.full_name if app.student else "Unknown Student")
    university = app.university_name or (app.university.name if app.university else "")
    dept_label = dept.upper()

    # ── Email ─────────────────────────────────────────────────────────────────
    subject = f"[Task Portal] Application Assigned – {student}"
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e293b;margin-top:0;">New Application Assigned</h2>
      <p style="color:#475569;">Hi <strong>{assignee.full_name}</strong>,</p>
      <p style="color:#475569;">A new application has been assigned to you in the Task Management Portal.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:140px;">Student</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">University</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{university or 'N/A'}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Department</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{dept_label}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Status</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{app.application_status}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Assigned by</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{assigner_name}</td></tr>
      </table>
      <p style="color:#64748b;font-size:13px;">Please log in to the Task Management Portal to view full details and take action.</p>
    </div>
    """
    send_email(assignee.email, subject, html_body)

    # ── Google Chat ────────────────────────────────────────────────────────────
    chat_text = (
        f"*📋 Application Assigned — {dept_label} Department*\n"
        f"*Assigned to:* {assignee.full_name}\n"
        f"*Student:* {student}\n"
        f"*University:* {university or 'N/A'}\n"
        f"*Status:* {app.application_status}\n"
        f"*Assigned by:* {assigner_name}"
    )
    send_chat_notification(db, dept, chat_text)


@router.post("/test-email")
def test_email(
    data: schemas.NotificationTest,
    current_user: models.User = Depends(require_admin),
):
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")

    if not smtp_host or not smtp_user:
        raise HTTPException(
            status_code=400,
            detail="SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.",
        )

    try:
        msg = MIMEText("This is a test email from the Task Management Portal.")
        msg["Subject"] = "Test Email - Task Portal"
        msg["From"] = smtp_user
        msg["To"] = data.target

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [data.target], msg.as_string())

        return {"success": True, "message": f"Email sent to {data.target}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/test-chat")
def test_chat(
    data: schemas.NotificationTest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    """
    Send a test Google Chat message.
    If data.type is a department ('gs' or 'offer'), uses that department's
    stored webhook URL. Otherwise uses data.target directly (or falls back to env var).
    """
    webhook_url = ""
    if data.type in ("gs", "offer"):
        webhook_url = get_webhook_for_dept(db, data.type)
    if not webhook_url:
        webhook_url = data.target
    if not webhook_url:
        webhook_url = os.environ.get("GOOGLE_CHAT_WEBHOOK", "")

    if not webhook_url:
        raise HTTPException(
            status_code=400,
            detail="No Google Chat webhook configured. Add one via Settings → Dept Webhooks or set GOOGLE_CHAT_WEBHOOK env var.",
        )

    try:
        payload = {"text": "Test message from Task Management Portal"}
        resp = httpx.post(webhook_url, json=payload, timeout=10)
        resp.raise_for_status()
        return {"success": True, "message": "Google Chat notification sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send chat notification: {str(e)}")
