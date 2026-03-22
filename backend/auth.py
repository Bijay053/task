import os
import re
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.database import get_db
import backend.models as models

SECRET_KEY = os.environ.get("SESSION_SECRET", "change-this-secret-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

COMMON_PASSWORDS = {
    "password", "password1", "password123", "123456", "12345678", "qwerty",
    "abc123", "letmein", "admin", "admin123", "welcome", "welcome1",
    "monkey", "dragon", "master", "1234567890", "passw0rd", "iloveyou",
    "sunshine", "princess", "football", "shadow", "superman", "michael",
    "login", "access", "trustno1", "hello", "charlie", "donald",
}

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def validate_password_strength(password: str, full_name: str = "") -> None:
    """Raise HTTPException if password does not meet strength requirements."""
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("at least one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("at least one number")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", password):
        errors.append("at least one special character (!@#$%^&*…)")
    if password.lower() in COMMON_PASSWORDS:
        errors.append("must not be a commonly used password")
    if full_name:
        name_parts = [p.lower() for p in full_name.split() if len(p) >= 3]
        for part in name_parts:
            if part in password.lower():
                errors.append("must not contain your name")
                break
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain: " + ", ".join(errors),
        )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id: int = int(sub)
        token_ver: int = int(payload.get("ver", 0))
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Reject tokens issued before a password change (token invalidation)
    current_ver = getattr(user, "token_version", 0) or 0
    if token_ver < current_ver:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired — please log in again")

    return user


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return current_user
