"""Simple SMTP email service. Configure via environment variables:
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
"""
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)
APP_NAME  = "Admission Task Management"


def is_email_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def send_email(to: str, subject: str, html_body: str) -> bool:
    if not is_email_configured():
        logger.warning(f"[email] SMTP not configured – skipping email to {to}: {subject}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{APP_NAME} <{SMTP_FROM}>"
        msg["To"]      = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to], msg.as_string())
        logger.info(f"[email] Sent '{subject}' to {to}")
        return True
    except Exception as exc:
        logger.error(f"[email] Failed to send to {to}: {exc}")
        return False


def send_otp_email(to: str, otp: str, full_name: str) -> bool:
    subject = f"{APP_NAME} – Your Login Code"
    body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#1d4ed8">{APP_NAME}</h2>
      <p>Hi <strong>{full_name}</strong>,</p>
      <p>Your one-time login verification code is:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;
                  background:#eff6ff;padding:16px 24px;border-radius:8px;display:inline-block;margin:16px 0">
        {otp}
      </div>
      <p style="color:#64748b;font-size:14px">This code expires in <strong>10 minutes</strong>. 
         Do not share it with anyone.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#94a3b8;font-size:12px">If you did not attempt to sign in, 
         please change your password immediately.</p>
    </div>
    """
    return send_email(to, subject, body)


def send_welcome_email(to: str, full_name: str, password: str, app_url: str = "") -> bool:
    subject = f"Welcome to {APP_NAME} – Your Account Details"
    login_url = app_url or "your portal URL"
    body = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px">
      <div style="background:#fff;padding:32px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <h2 style="color:#1d4ed8;margin-top:0">{APP_NAME}</h2>
        <p>Hi <strong>{full_name}</strong>,</p>
        <p>Your account has been created. Here are your login credentials:</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:20px 0">
          <p style="margin:4px 0"><strong>Portal:</strong> <a href="{login_url}" style="color:#1d4ed8">{login_url}</a></p>
          <p style="margin:4px 0"><strong>Email:</strong> {to}</p>
          <p style="margin:4px 0"><strong>Temporary Password:</strong> <code style="background:#dbeafe;padding:2px 8px;border-radius:4px;font-size:15px;letter-spacing:1px">{password}</code></p>
        </div>
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:20px">
          <p style="margin:0;color:#92400e;font-size:14px">
            ⚠️ <strong>Action required:</strong> You must change your password the first time you log in.
            Please choose a strong password (at least 8 characters, mix of uppercase, lowercase, numbers and symbols).
          </p>
        </div>
        <a href="{login_url}" style="display:inline-block;padding:12px 28px;background:#1d4ed8;color:#fff;
           text-decoration:none;border-radius:8px;font-weight:bold">Sign In Now</a>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0"/>
        <p style="color:#94a3b8;font-size:12px;margin:0">
          If you did not expect this email, please contact your system administrator immediately.
          Do not share your credentials with anyone.
        </p>
      </div>
    </div>
    """
    return send_email(to, subject, body)


def send_password_reset_email(to: str, full_name: str, reset_url: str) -> bool:
    subject = f"{APP_NAME} – Password Reset Request"
    body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#1d4ed8">{APP_NAME}</h2>
      <p>Hi <strong>{full_name}</strong>,</p>
      <p>We received a request to reset your password. Click the button below:</p>
      <a href="{reset_url}" style="display:inline-block;margin:16px 0;padding:12px 28px;
         background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
        Reset My Password
      </a>
      <p style="color:#64748b;font-size:14px">This link expires in <strong>30 minutes</strong>. 
         If you did not request a reset, you can safely ignore this email.</p>
    </div>
    """
    return send_email(to, subject, body)
