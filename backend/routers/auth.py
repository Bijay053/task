import random
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import (
    verify_password, create_access_token,
    get_current_user, get_password_hash,
)
from backend.email_service import (
    is_email_configured, send_otp_email, send_password_reset_email,
)
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_EXPIRE_MINUTES    = 10
RESET_EXPIRE_MINUTES  = 30


# ─── helpers ────────────────────────────────────────────────────────────────

def _log(db: Session, user: Optional[models.User], action: str,
         detail: str = "", request: Optional[Request] = None):
    ip = None
    if request:
        forwarded = request.headers.get("x-forwarded-for")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
    db.add(models.SystemAuditLog(
        user_id    = user.id    if user else None,
        user_email = user.email if user else None,
        action     = action,
        detail     = detail or None,
        ip_address = ip,
    ))
    db.commit()


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


# ─── request / response schemas ─────────────────────────────────────────────

class OtpRequest(BaseModel):
    email: str
    password: str


class OtpVerify(BaseModel):
    email: str
    code: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class OtpRequired(BaseModel):
    otp_required: bool = True
    email_sent: bool
    message: str


# ─── login (step 1 when OTP enabled, direct token when OTP disabled) ────────

@router.post("/login")
def login(data: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is inactive")

    if is_email_configured():
        # Invalidate previous OTPs for this user
        db.query(models.OtpCode).filter(
            models.OtpCode.user_id == user.id,
            models.OtpCode.used == False,
        ).update({"used": True})
        db.flush()

        code = _generate_otp()
        db.add(models.OtpCode(
            user_id    = user.id,
            code       = code,
            expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
        ))
        db.commit()

        sent = send_otp_email(user.email, code, user.full_name)
        _log(db, user, "otp_sent", f"OTP sent via email (delivered={sent})", request)
        return OtpRequired(otp_required=True, email_sent=sent,
                           message=f"Verification code sent to {user.email}")

    # No SMTP — issue token directly
    token = create_access_token({"sub": str(user.id)})
    _log(db, user, "login", "Direct login (no OTP)", request)
    return {"access_token": token, "token_type": "bearer", "user": user}


# ─── OTP verify (step 2) ─────────────────────────────────────────────────────

@router.post("/verify-otp", response_model=schemas.Token)
def verify_otp(data: OtpVerify, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid code")

    otp = (
        db.query(models.OtpCode)
        .filter(
            models.OtpCode.user_id == user.id,
            models.OtpCode.code    == data.code.strip(),
            models.OtpCode.used    == False,
            models.OtpCode.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not otp:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")

    otp.used = True
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    _log(db, user, "login", "Login via OTP", request)
    return {"access_token": token, "token_type": "bearer", "user": user}


# ─── logout ──────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _log(db, current_user, "logout", "", request)
    return {"message": "Logged out successfully"}


# ─── me ──────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ─── change password ─────────────────────────────────────────────────────────

@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 6 characters")

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    _log(db, current_user, "change_password", "User changed their own password", request)
    return {"message": "Password changed successfully"}


# ─── forgot password ─────────────────────────────────────────────────────────

@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    # Always return success to prevent email enumeration
    if not user or not user.is_active:
        return {"message": "If that email is registered, a reset link has been sent."}

    # Invalidate old tokens
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used    == False,
    ).update({"used": True})
    db.flush()

    token = secrets.token_urlsafe(32)
    db.add(models.PasswordResetToken(
        user_id    = user.id,
        token      = token,
        expires_at = datetime.utcnow() + timedelta(minutes=RESET_EXPIRE_MINUTES),
    ))
    db.commit()

    if is_email_configured():
        from backend.email_service import SMTP_FROM
        import os
        app_url = os.environ.get("APP_URL", "")
        reset_url = f"{app_url}/reset-password?token={token}"
        sent = send_password_reset_email(user.email, user.full_name, reset_url)
        _log(db, user, "forgot_password", f"Reset email sent (delivered={sent})", request)
    else:
        # Log the token so an admin can share it manually if needed
        _log(db, user, "forgot_password", f"SMTP not configured. Reset token: {token}", request)

    return {"message": "If that email is registered, a reset link has been sent."}


# ─── reset password ──────────────────────────────────────────────────────────

@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    rec = (
        db.query(models.PasswordResetToken)
        .filter(
            models.PasswordResetToken.token      == data.token,
            models.PasswordResetToken.used       == False,
            models.PasswordResetToken.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not rec:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")

    user = rec.user
    user.hashed_password = get_password_hash(data.new_password)
    rec.used = True
    db.commit()
    _log(db, user, "reset_password", "Password reset via email token", request)
    return {"message": "Password has been reset. You may now sign in."}
