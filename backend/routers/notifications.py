import os
import smtplib
from email.mime.text import MIMEText
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
        raise HTTPException(status_code=400, detail="SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.")

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
            detail="No Google Chat webhook configured. Add one via Settings → Dept Webhooks or set GOOGLE_CHAT_WEBHOOK env var."
        )

    try:
        payload = {"text": "Test message from Task Management Portal"}
        resp = httpx.post(webhook_url, json=payload, timeout=10)
        resp.raise_for_status()
        return {"success": True, "message": "Google Chat notification sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send chat notification: {str(e)}")


def send_chat_notification(db: Session, department: str, text: str):
    """Helper to send a notification to the correct department webhook."""
    webhook_url = get_webhook_for_dept(db, department)
    if not webhook_url:
        return False
    try:
        httpx.post(webhook_url, json={"text": text}, timeout=5)
        return True
    except Exception:
        return False
