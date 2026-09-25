from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class EvidenceKind(StrEnum):
    OBSERVED = "observed"
    DEVICE = "device"
    INFERRED = "inferred"
    AMBIGUOUS = "ambiguous"
    UNRESOLVED = "unresolved"


class SolveCreate(BaseModel):
    scramble: str = Field(min_length=1, max_length=500)
    intended_state: dict[str, Any]
    cross_color: str | None = Field(default=None, max_length=20)
    initial_orientation: dict[str, Any] | None = None
    timer_source: str = Field(default="keyboard", max_length=40)
    started_at: datetime | None = None
    duration_ms: int | None = Field(default=None, ge=0)


class SolvePatch(BaseModel):
    status: str | None = Field(default=None, pattern="^(recording|uploaded|processing|complete|failed)$")
    verified_start_state: dict[str, Any] | None = None
    verified_end_state: dict[str, Any] | None = None
    endpoint_verified: bool | None = None
    duration_ms: int | None = Field(default=None, ge=0)
    timing_uncertainty_ms: int | None = Field(default=None, ge=0)


class TimelineEventCreate(BaseModel):
    sequence_no: int = Field(ge=0)
    event_type: str = Field(pattern="^(move|rotation|gap)$")
    notation: str | None = Field(default=None, max_length=20)
    time_start_ms: int = Field(ge=0)
    time_end_ms: int = Field(ge=0)
    evidence: EvidenceKind
    state_confidence: float | None = Field(default=None, ge=0, le=1)
    identity_confidence: float | None = Field(default=None, ge=0, le=1)
    timing_confidence: float | None = Field(default=None, ge=0, le=1)
    candidates: list[dict[str, Any]] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_interval(self):
        if self.time_end_ms < self.time_start_ms:
            raise ValueError("time_end_ms must be at or after time_start_ms")
        if self.event_type == "gap" and self.notation is not None:
            raise ValueError("unresolved gaps cannot have definitive notation")
        return self


class AnalysisRunCreate(BaseModel):
    pipeline_version: str = Field(min_length=1, max_length=100)
    input_kind: str = Field(pattern="^(camera|smart_cube|manual|hybrid)$")
    parameters: dict[str, Any] = Field(default_factory=dict)


class User(BaseModel):
    id: UUID
    email: str | None = None

