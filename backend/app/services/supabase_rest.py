from typing import Any, Optional

import httpx
from fastapi import HTTPException

from ..config import get_settings


settings = get_settings()


class SupabaseRest:
    def __init__(self) -> None:
        self.base_url = settings.supabase_url.rstrip("/")
        self.schema = settings.database_schema or "public"
        self.key = settings.supabase_service_role_key or settings.supabase_anon_key

    def _headers(self) -> dict[str, str]:
        if not self.base_url or not self.key:
            raise HTTPException(
                status_code=500,
                detail="SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase mode.",
            )

        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Accept-Profile": self.schema,
            "Content-Profile": self.schema,
        }

    def _url(self, table: str) -> str:
        return f"{self.base_url}/rest/v1/{table}"

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: Optional[dict[str, Any]] = None,
        json: Any = None,
        prefer: Optional[str] = None,
    ) -> Any:
        headers = self._headers()
        if prefer:
            headers["Prefer"] = prefer

        with httpx.Client(timeout=30.0) as client:
            response = client.request(
                method,
                self._url(table),
                params=params,
                json=json,
                headers=headers,
            )

        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        if not response.content:
            return None
        return response.json()

    def insert(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        rows = self._request("POST", table, json=payload, prefer="return=representation")
        return rows[0] if rows else payload

    def select(self, table: str, params: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
        return self._request("GET", table, params=params) or []

    def get_by_id(self, table: str, row_id: int) -> Optional[dict[str, Any]]:
        rows = self.select(table, {"id": f"eq.{row_id}", "limit": "1"})
        return rows[0] if rows else None


supabase = SupabaseRest()
