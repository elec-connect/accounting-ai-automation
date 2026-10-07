from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_STORAGE_BUCKET: str = "documents"

    REDIS_URL: str = "redis://localhost:6379/0"

    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "eu-west-2"

    POSTMARK_WEBHOOK_SECRET: str = "test-secret"

    XERO_CLIENT_ID: str = ""
    XERO_CLIENT_SECRET: str = ""
    XERO_TENANT_ID: str = ""

    MAX_ATTACHMENT_SIZE_MB: int = 50
    ALLOWED_MIME_TYPES: list[str] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/tiff",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
