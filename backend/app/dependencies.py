from typing import Annotated

from fastapi import Depends, Header, HTTPException

from .config import Settings, get_settings
from .supabase import SupabaseGateway


async def gateway(
    authorization: Annotated[str | None, Header()] = None,
    settings: Annotated[Settings, Depends(get_settings)] = None,
) -> SupabaseGateway:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    client = SupabaseGateway(settings, authorization.removeprefix("Bearer ").strip())
    await client.user()
    return client


Gateway = Annotated[SupabaseGateway, Depends(gateway)]
