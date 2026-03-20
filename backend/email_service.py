"""Email service — uses AWS SES (boto3) when configured, falls back to SMTP.

AWS SES env vars (preferred):
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, SES_FROM_EMAIL

SMTP fallback env vars:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
"""
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

APP_NAME  = "Admission Task Management"
APP_COLOR = "#1d4ed8"   # brand blue


# ─── helpers ─────────────────────────────────────────────────────────────────

def _app_url() -> str:
    return os.environ.get("APP_URL", "").rstrip("/")


def _base_template(title: str, preview_text: str, body_html: str) -> str:
    """Wrap body_html in a professional branded shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <!-- preview text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{preview_text}</span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0">

        <!-- ── Header ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a 0%,{APP_COLOR} 100%);
                     border-radius:12px 12px 0 0;padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                    {APP_NAME}
                  </div>
                </td>
                <td align="right">
                  <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);
                              border-radius:10px;display:inline-flex;align-items:center;
                              justify-content:center;font-size:20px;">📋</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td style="background:#ffffff;padding:36px 36px 28px;border-left:1px solid #e2e8f0;
                     border-right:1px solid #e2e8f0;">
            {body_html}
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;
                     border-radius:0 0 12px 12px;padding:20px 36px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              This is an automated message from <strong>{APP_NAME}</strong>.<br />
              If you were not expecting this email, please contact your administrator.<br />
              &copy; 2025 {APP_NAME}. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _info_row(label: str, value: str) -> str:
    return f"""
    <tr>
      <td style="padding:10px 16px;background:#f8fafc;border:1px solid #e2e8f0;
                 font-size:13px;font-weight:600;color:#475569;width:140px;
                 border-bottom:none;">{label}</td>
      <td style="padding:10px 16px;border:1px solid #e2e8f0;border-left:none;
                 font-size:13px;color:#1e293b;border-bottom:none;">{value}</td>
    </tr>"""


def _cta_button(text: str, url: str) -> str:
    return f"""
    <div style="margin:28px 0 8px;">
      <a href="{url}"
         style="display:inline-block;padding:13px 32px;background:{APP_COLOR};color:#ffffff;
                text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;
                letter-spacing:0.2px;">
        {text}
      </a>
    </div>"""


def _badge(text: str, color: str = APP_COLOR) -> str:
    return (f'<span style="display:inline-block;padding:3px 10px;background:{color}18;'
            f'color:{color};border-radius:20px;font-size:12px;font-weight:600;">{text}</span>')


# ─── transport ───────────────────────────────────────────────────────────────

def _ses_client():
    try:
        import boto3
        key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
        secret  = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
        region  = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
        if not key_id or not secret:
            return None
        return boto3.client("ses", region_name=region,
                            aws_access_key_id=key_id, aws_secret_access_key=secret)
    except Exception:
        return None


def _ses_from() -> str:
    return (os.environ.get("SES_FROM_EMAIL")
            or os.environ.get("SMTP_FROM")
            or os.environ.get("SMTP_USER", ""))


def is_email_configured() -> bool:
    if os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"):
        return bool(_ses_from())
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")
    return bool(smtp_host and smtp_user and smtp_pass)


def send_email(to: str, subject: str, html_body: str) -> bool:
    if not is_email_configured():
        logger.warning(f"[email] Not configured – skipping email to {to}: {subject}")
        return False
    ses = _ses_client()
    if ses:
        return _send_via_ses(ses, to, subject, html_body)
    return _send_via_smtp(to, subject, html_body)


def _send_via_ses(ses, to: str, subject: str, html_body: str) -> bool:
    from_addr = _ses_from()
    try:
        ses.send_email(
            Source=f"{APP_NAME} <{from_addr}>",
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body":    {"Html": {"Data": html_body, "Charset": "UTF-8"}},
            },
        )
        logger.info(f"[email/SES] Sent '{subject}' to {to}")
        return True
    except Exception as exc:
        logger.error(f"[email/SES] Failed to send to {to}: {exc}")
        raise


def _send_via_smtp(to: str, subject: str, html_body: str) -> bool:
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{APP_NAME} <{smtp_from}>"
        msg["To"]      = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [to], msg.as_string())
        logger.info(f"[email/SMTP] Sent '{subject}' to {to}")
        return True
    except Exception as exc:
        logger.error(f"[email/SMTP] Failed to send to {to}: {exc}")
        raise


# ─── branded email functions ──────────────────────────────────────────────────

def send_otp_email(to: str, otp: str, full_name: str) -> bool:
    subject = f"{APP_NAME} – Your Login Verification Code"
    body = f"""
    <h2 style="margin:0 0 6px;font-size:22px;color:#1e293b;">Verify your identity</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      Hi <strong>{full_name}</strong>, use the code below to complete your sign-in.
    </p>

    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:#eff6ff;border:2px dashed #93c5fd;
                  border-radius:12px;padding:20px 40px;">
        <div style="font-size:40px;font-weight:700;letter-spacing:12px;color:{APP_COLOR};
                    font-family:'Courier New',monospace;">{otp}</div>
      </div>
    </div>

    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;
                padding:12px 16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#854d0e;">
        ⏱ This code expires in <strong>10 minutes</strong>.
        Never share it with anyone — our team will never ask for it.
      </p>
    </div>

    <p style="font-size:13px;color:#94a3b8;margin-top:24px;">
      Didn't request this? Your account may be at risk — please change your password immediately.
    </p>
    """
    return send_email(to, subject, _base_template(subject, f"Your OTP code: {otp}", body))


def send_welcome_email(to: str, full_name: str, password: str, app_url: str = "") -> bool:
    subject = f"Welcome to {APP_NAME} – Your Account is Ready"
    login_url = app_url or _app_url() or "your portal URL"
    body = f"""
    <h2 style="margin:0 0 6px;font-size:22px;color:#1e293b;">Welcome aboard, {full_name}! 👋</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      Your account on <strong>{APP_NAME}</strong> has been created.
      Here are your login credentials — keep them safe.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">
      {_info_row("Portal", f'<a href="{login_url}" style="color:{APP_COLOR};">{login_url}</a>')}
      {_info_row("Email", to)}
      {_info_row("Temp Password",
        f'<code style="background:#dbeafe;color:#1e40af;padding:3px 10px;border-radius:5px;'
        f'font-size:15px;letter-spacing:1px;">{password}</code>')}
      <tr><td colspan="2" style="border:1px solid #e2e8f0;border-top:1px solid #e2e8f0;"></td></tr>
    </table>

    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;
                padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#854d0e;line-height:1.6;">
        ⚠️ <strong>Action required:</strong> You will be asked to set a new password the first time you sign in.
        Choose a strong password (at least 8 characters, mix of uppercase, lowercase, numbers &amp; symbols).
      </p>
    </div>

    {_cta_button("Sign In Now", login_url)}

    <p style="font-size:13px;color:#94a3b8;margin-top:24px;">
      If you did not expect this email, contact your system administrator immediately.
    </p>
    """
    return send_email(to, subject, _base_template(subject, f"Your account is ready. Temp password: {password}", body))


def send_password_reset_email(to: str, full_name: str, reset_url: str) -> bool:
    subject = f"{APP_NAME} – Password Reset Request"
    body = f"""
    <h2 style="margin:0 0 6px;font-size:22px;color:#1e293b;">Reset your password</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      Hi <strong>{full_name}</strong>, we received a request to reset your password.
      Click the button below to choose a new one.
    </p>

    {_cta_button("Reset My Password", reset_url)}

    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;
                padding:12px 16px;margin:24px 0;">
      <p style="margin:0;font-size:13px;color:#854d0e;">
        ⏱ This link expires in <strong>30 minutes</strong>.
        If you did not request a reset, you can safely ignore this email.
      </p>
    </div>

    <p style="font-size:13px;color:#64748b;margin-top:8px;">
      If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="{reset_url}" style="color:{APP_COLOR};word-break:break-all;">{reset_url}</a>
    </p>
    """
    return send_email(to, subject, _base_template(subject, "Reset your password — link expires in 30 minutes", body))


def send_assignment_email(
    to: str,
    assignee_name: str,
    assigner_name: str,
    student: str,
    university: str,
    course: str,
    status: str,
    department: str,
    app_id: int,
) -> bool:
    dept_label = "GS Application" if department == "gs" else "Offer Request"
    portal_url = _app_url()
    link = f"{portal_url}/{'applications' if department == 'gs' else 'offer-applications'}" if portal_url else ""
    subject = f"📋 New Task Assigned – {student} | {dept_label}"

    rows = _info_row("Student", student)
    if university:
        rows += _info_row("University", university)
    if course:
        rows += _info_row("Course", course)
    rows += _info_row("Department", dept_label)
    rows += _info_row("Status", _badge(status))
    rows += _info_row("Assigned by", assigner_name)

    body = f"""
    <h2 style="margin:0 0 4px;font-size:22px;color:#1e293b;">New Task Assigned</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      Hi <strong>{assignee_name}</strong>,
      a new application has been assigned to you. Please review it and take action.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:8px;">
      {rows}
      <tr><td colspan="2" style="border:1px solid #e2e8f0;border-top:1px solid #e2e8f0;"></td></tr>
    </table>

    {"" if not link else _cta_button("View Application", link)}

    <p style="font-size:13px;color:#64748b;margin-top:20px;">
      Log in to the portal to see full details, update the status, and add notes.
    </p>
    """
    return send_email(to, subject, _base_template(subject, f"New task assigned: {student} – {dept_label}", body))


def send_follower_email(
    to: str,
    follower_name: str,
    adder_name: str,
    student: str,
    university: str,
    course: str,
    status: str,
    department: str,
    app_id: int,
) -> bool:
    dept_label = "GS Application" if department == "gs" else "Offer Request"
    portal_url = _app_url()
    link = f"{portal_url}/{'applications' if department == 'gs' else 'offer-applications'}" if portal_url else ""
    subject = f"👁 You are now following – {student} | {dept_label}"

    rows = _info_row("Student", student)
    if university:
        rows += _info_row("University", university)
    if course:
        rows += _info_row("Course", course)
    rows += _info_row("Department", dept_label)
    rows += _info_row("Current Status", _badge(status))
    rows += _info_row("Added by", adder_name)

    body = f"""
    <h2 style="margin:0 0 4px;font-size:22px;color:#1e293b;">You're now following an application</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      Hi <strong>{follower_name}</strong>,
      <strong>{adder_name}</strong> has added you as a follower on this application.
      You will receive notifications when the status changes.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:8px;">
      {rows}
      <tr><td colspan="2" style="border:1px solid #e2e8f0;border-top:1px solid #e2e8f0;"></td></tr>
    </table>

    {"" if not link else _cta_button("View Application", link)}
    """
    return send_email(to, subject, _base_template(subject, f"You are now following: {student}", body))


def send_status_change_email(
    to: str,
    recipient_name: str,
    changed_by: str,
    student: str,
    university: str,
    course: str,
    old_status: str,
    new_status: str,
    department: str,
    app_id: int,
) -> bool:
    dept_label = "GS Application" if department == "gs" else "Offer Request"
    portal_url = _app_url()
    link = f"{portal_url}/{'applications' if department == 'gs' else 'offer-applications'}" if portal_url else ""
    subject = f"🔄 Status Updated – {student} | {dept_label}"

    rows = _info_row("Student", student)
    if university:
        rows += _info_row("University", university)
    if course:
        rows += _info_row("Course", course)
    rows += _info_row("Department", dept_label)
    rows += _info_row("Previous Status",
        f'<span style="color:#64748b;text-decoration:line-through;">{old_status}</span>')
    rows += _info_row("New Status", _badge(new_status, "#16a34a"))
    rows += _info_row("Changed by", changed_by)

    body = f"""
    <h2 style="margin:0 0 4px;font-size:22px;color:#1e293b;">Application status updated</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      Hi <strong>{recipient_name}</strong>,
      the status of an application you are following has been updated by <strong>{changed_by}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:8px;">
      {rows}
      <tr><td colspan="2" style="border:1px solid #e2e8f0;border-top:1px solid #e2e8f0;"></td></tr>
    </table>

    {"" if not link else _cta_button("View Application", link)}
    """
    return send_email(to, subject, _base_template(subject, f"Status changed to {new_status}: {student}", body))
