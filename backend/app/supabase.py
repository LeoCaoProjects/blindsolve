from typing import Any

import httpx
from fastapi import HTTPException, status

from .config import Settings
from .schemas import User


class SupabaseGateway:
    def __init__(self, settings: Settings, access_token: str):
        if not settings.configured:
            raise HTTPException(status_code=503, detail="New CubeIQ Supabase project is not configured")
        self.base_url = settings.supabase_url.rstrip("/")
        self.headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {access_token}",
        }

    async def user(self) -> User:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{self.base_url}/auth/v1/user", headers=self.headers)
        if response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")
        return User.model_validate(response.json())

    async def request(
        self, method: str, table: str, *, params: dict[str, str] | None = None, json: Any = None
    ) -> Any:
        headers = {**self.headers, "Content-Type": "application/json", "Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(
                method, f"{self.base_url}/rest/v1/{table}", headers=headers, params=params, json=json
            )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json() if response.content else None

