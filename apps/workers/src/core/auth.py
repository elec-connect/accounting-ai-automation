from fastapi import HTTPException, Header, Depends
from jose import jwt, JWTError
import httpx
from functools import lru_cache
from .config import get_settings
from .logging import get_logger


logger = get_logger(__name__)


class AuthContext:
    def __init__(self, user_id: str, email: str, role: str):
        self.user_id = user_id
        self.email = email
        self.role = role

    def has_role(self, *roles: str) -> bool:
        return self.role in roles


@lru_cache
def get_jwks() -> dict:
    settings = get_settings()
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    response = httpx.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def verify_jwt(token: str) -> dict:
    try:
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
        if not key:
            raise JWTError("No matching key")
        return jwt.decode(token, key, algorithms=["ES256"], audience="authenticated")
    except JWTError as e:
        logger.warning("JWT verification failed", extra={"extra_error": str(e)})
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(authorization: str = Header(None)) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.replace("Bearer ", "")
    payload = verify_jwt(token)
    return AuthContext(
        user_id=payload.get("sub"),
        email=payload.get("email"),
        role=payload.get("user_metadata", {}).get("role", "viewer"),
    )


def require_roles(*roles: str):
    async def checker(user: AuthContext = Depends(get_current_user)):
        if not user.has_role(*roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker
