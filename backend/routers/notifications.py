import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx

from backend.database import get_db
from backend.auth import get_current_user, require_admin
from backend.email_service import (
    is_email_configured,
    send_email,
    send_assignment_email,
    send_follower_email,
    send_status_change_email,
)
import backend.models as models
import backend.schemas as schemas

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── webhook helpers ──────────────────────────────────────────────────────────

def get_webhook_for_dept(db: Session, department: str) -> str:
    setting = db.query(models.DeptSetting).filter_by(
        department=department, key="google_chat_webhook"
    ).first()
    if setting and setting.value:
        return setting.value
    return os.environ.get("GOOGLE_CHAT_WEBHOOK", "")


def _app_link(department: str) -> str:
    base = os.environ.get("APP_URL", "").rstrip("/")
    if not base:
        return ""
    path = "applications" if department == "gs" else "offer-applications"
    return f"{base}/{path}"


def send_chat_notification(db: Session, department: str, text: str) -> bool:
    webhook_url = get_webhook_for_dept(db, department)
    if not webhook_url:
        return False
    try:
        httpx.post(webhook_url, json={"text": text}, timeout=5)
        return True
    except Exception as exc:
        logger.warning(f"[chat] Failed to send webhook: {exc}")
        return False


def _app_info(app: models.Application):
    """Extract common display fields from an application."""
    student    = app.student_name or (app.student.full_name if app.student else "Unknown Student")
    university = app.university_name or (app.university.name if app.university else "")
    course     = app.course or ""
    return student, university, course


# ─── assignment notification ──────────────────────────────────────────────────

def send_assignment_notification(
    db: Session,
    app: models.Application,
    assignee: models.User,
    assigner_name: str,
):
    """Send email + Google Chat when an application is assigned."""
    if not assignee:
        return

    student, university, course = _app_info(app)
    dept  = app.department
    link  = _app_link(dept)

    # ── Email ─────────────────────────────────────────────────────────────────
    try:
        send_assignment_email(
            to=assignee.email,
            assignee_name=assignee.full_name,
            assigner_name=assigner_name,
            student=student,
            university=university,
            course=course,
            status=app.application_status,
            department=dept,
            app_id=app.id,
        )
    except Exception as exc:
        logger.error(f"[notify] Assignment email failed: {exc}")

    # ── Google Chat ────────────────────────────────────────────────────────────
    if dept == "gs":
        chat_text = (
            f"🔔 *New Task Assigned | Application review*\n\n"
            f"*Assignee:* {assignee.full_name}\n"
            f"*Student:* {student}\n"
        )
        if university:
            chat_text += f"*University:* {university}\n"
        if link:
            chat_text += f"\n🔗 {link}"
    else:
        chat_text = (
            f"🔔 *New Task Assigned | Offer request*\n\n"
            f"*Student name:* {student}\n"
        )
        if university:
            chat_text += f"*University:* {university}\n"
        if course:
            chat_text += f"*Course:* {course}\n"
        chat_text += f"*Assign person name:* {assignee.full_name}\n"
        if link:
            chat_text += f"\n🔗 {link}"

    send_chat_notification(db, dept, chat_text)


# ─── follower-added notification ──────────────────────────────────────────────

def send_follower_notification(
    db: Session,
    app: models.Application,
    follower: models.User,
    adder_name: str,
):
    """Notify a user when they are added as a follower on an application."""
    if not follower:
        return
    student, university, course = _app_info(app)
    try:
        send_follower_email(
            to=follower.email,
            follower_name=follower.full_name,
            adder_name=adder_name,
            student=student,
            university=university,
            course=course,
            status=app.application_status,
            department=app.department,
            app_id=app.id,
        )
    except Exception as exc:
        logger.error(f"[notify] Follower email failed: {exc}")


# ─── status-change notification ───────────────────────────────────────────────

def send_status_change_notification(
    db: Session,
    app: models.Application,
    old_status: str,
    new_status: str,
    changed_by_name: str,
):
    """Email all followers (and the assignee) when status changes."""
    from sqlalchemy.orm import joinedload

    # Re-query with full eager loading so followers + their users are always available
    app_full = (
        db.query(models.Application)
        .options(
            joinedload(models.Application.student),
            joinedload(models.Application.university),
            joinedload(models.Application.assigned_to),
            joinedload(models.Application.followers).joinedload(models.ApplicationFollower.user),
        )
        .filter(models.Application.id == app.id)
        .first()
    )
    if not app_full:
        logger.warning(f"[notify] Application {app.id} not found for status-change notification")
        return

    logger.info(f"[notify] Status change {old_status} → {new_status} for app {app.id}, "
                f"followers: {[f.user_id for f in app_full.followers]}")

    if not app_full.followers and not app_full.assigned_to:
        logger.info(f"[notify] App {app.id} has no followers and no assignee — skipping notification")
        return

    student, university, course = _app_info(app_full)
    recipients: list[models.User] = []
    seen_ids: set[int] = set()

    for f in app_full.followers:
        if f.user and f.user.id not in seen_ids:
            recipients.append(f.user)
            seen_ids.add(f.user.id)

    # Also notify the assignee if they're not already a follower
    if app_full.assigned_to and app_full.assigned_to.id not in seen_ids:
        recipients.append(app_full.assigned_to)
        seen_ids.add(app_full.assigned_to.id)

    logger.info(f"[notify] Sending status-change emails to: {[u.email for u in recipients]}")

    for user in recipients:
        try:
            send_status_change_email(
                to=user.email,
                recipient_name=user.full_name,
                changed_by=changed_by_name,
                student=student,
                university=university,
                course=course,
                old_status=old_status,
                new_status=new_status,
                department=app_full.department,
                app_id=app_full.id,
            )
            logger.info(f"[notify] Status-change email sent to {user.email}")
        except Exception as exc:
            logger.error(f"[notify] Status-change email FAILED for {user.email}: {exc}", exc_info=True)


# ─── API endpoints ────────────────────────────────────────────────────────────

@router.get("/email-status")
def email_status(current_user: models.User = Depends(require_admin)):
    """Return whether email is configured and which transport is active."""
    import os
    has_ses = bool(
        os.environ.get("AWS_ACCESS_KEY_ID")
        and os.environ.get("AWS_SECRET_ACCESS_KEY")
        and os.environ.get("SES_FROM_EMAIL")
    )
    has_smtp = bool(
        os.environ.get("SMTP_HOST")
        and os.environ.get("SMTP_USER")
        and os.environ.get("SMTP_PASS")
    )
    configured = has_ses or has_smtp
    transport = "ses" if has_ses else ("smtp" if has_smtp else "none")
    return {"configured": configured, "transport": transport}


@router.post("/test-email")
def test_email(
    data: schemas.NotificationTest,
    current_user: models.User = Depends(require_admin),
):
    if not is_email_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "Email not configured. Set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + SES_FROM_EMAIL "
                "for AWS SES, or SMTP_HOST + SMTP_USER + SMTP_PASS for SMTP."
            ),
        )
    try:
        from backend.email_service import _base_template
        html = _base_template(
            "Test Email",
            "Your email integration is working correctly.",
            """
            <h2 style="margin:0 0 8px;font-size:22px;color:#1e293b;">Test Email ✅</h2>
            <p style="color:#64748b;font-size:14px;margin:0 0 20px;">
              Your email integration is working correctly.
              Emails will be delivered to your team from <strong>Admission Task Management</strong>.
            </p>
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 18px;">
              <p style="margin:0;color:#166534;font-size:13px;">
                ✅ Connection successful — your mail server is configured and sending.
              </p>
            </div>
            """,
        )
        send_email(to=data.target, subject="Test Email – Admission Task Management", html_body=html)
        return {"success": True, "message": f"Email sent to {data.target}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/test-chat")
def test_chat(
    data: schemas.NotificationTest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
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
        payload = {"text": "✅ Test message from *Admission Task Management* — webhook is working!"}
        resp = httpx.post(webhook_url, json=payload, timeout=10)
        resp.raise_for_status()
        return {"success": True, "message": "Google Chat notification sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send chat notification: {str(e)}")
