from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .dependencies import Gateway
from .schemas import AnalysisRunCreate, SolveCreate, SolvePatch, TimelineEventCreate


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {"status": "ok", "supabase_configured": settings.configured}


@app.get("/v1/solves")
async def list_solves(
    db: Gateway, limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0)
):
    return await db.request(
        "GET", "solves", params={"select": "*", "order": "created_at.desc", "limit": str(limit), "offset": str(offset)}
    )


@app.post("/v1/solves", status_code=201)
async def create_solve(payload: SolveCreate, db: Gateway):
    user = await db.user()
    body = payload.model_dump(mode="json", exclude_none=True) | {"user_id": str(user.id)}
    rows = await db.request("POST", "solves", json=body)
    return rows[0]


@app.get("/v1/solves/{solve_id}")
async def get_solve(solve_id: UUID, db: Gateway):
    rows = await db.request("GET", "solve_details", params={"id": f"eq.{solve_id}", "select": "*"})
    if not rows:
        raise HTTPException(status_code=404, detail="Solve not found")
    return rows[0]


@app.patch("/v1/solves/{solve_id}")
async def update_solve(solve_id: UUID, payload: SolvePatch, db: Gateway):
    rows = await db.request(
        "PATCH", "solves", params={"id": f"eq.{solve_id}"}, json=payload.model_dump(mode="json", exclude_none=True)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Solve not found")
    return rows[0]


@app.delete("/v1/solves/{solve_id}", status_code=204)
async def delete_solve(solve_id: UUID, db: Gateway):
    await db.request("DELETE", "solves", params={"id": f"eq.{solve_id}"})


@app.post("/v1/solves/{solve_id}/analysis-runs", status_code=201)
async def create_analysis_run(solve_id: UUID, payload: AnalysisRunCreate, db: Gateway):
    rows = await db.request("POST", "analysis_runs", json=payload.model_dump(mode="json") | {"solve_id": str(solve_id)})
    return rows[0]


@app.put("/v1/analysis-runs/{run_id}/timeline")
async def replace_timeline(run_id: UUID, payload: list[TimelineEventCreate], db: Gateway):
    await db.request("DELETE", "timeline_events", params={"analysis_run_id": f"eq.{run_id}"})
    if not payload:
        return []
    body = [event.model_dump(mode="json") | {"analysis_run_id": str(run_id)} for event in payload]
    return await db.request("POST", "timeline_events", json=body)

