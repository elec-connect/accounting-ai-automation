from supabase import create_client, Client
from functools import lru_cache
from core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
    )


class Database:
    def __init__(self):
        self.client = get_supabase()

    def insert_document(self, data: dict) -> dict:
        response = self.client.table("documents").insert(data).execute()
        if not response.data:
            raise RuntimeError(f"Failed to insert document: {response}")
        return response.data[0]

    def find_by_hash(self, content_hash: str) -> dict | None:
        response = (
            self.client.table("documents")
            .select("id, status, created_at")
            .eq("content_hash", content_hash)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None


@lru_cache
def get_database() -> Database:
    return Database()
