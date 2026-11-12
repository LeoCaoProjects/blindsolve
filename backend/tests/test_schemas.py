import pytest
from app.schemas import EvidenceKind, TimelineEventCreate
from pydantic import ValidationError


def test_unresolved_gap_keeps_interval_without_notation():
    event = TimelineEventCreate(
        sequence_no=4,
        event_type="gap",
        time_start_ms=1200,
        time_end_ms=1680,
        evidence=EvidenceKind.UNRESOLVED,
    )
    assert event.time_end_ms - event.time_start_ms == 480


def test_gap_cannot_claim_a_move():
    with pytest.raises(ValidationError):
        TimelineEventCreate(
            sequence_no=4,
            event_type="gap",
            notation="R",
            time_start_ms=1200,
            time_end_ms=1680,
            evidence=EvidenceKind.UNRESOLVED,
        )
