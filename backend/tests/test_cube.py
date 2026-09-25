import pytest
from app.cube import CubeState, InvalidCubeState, parse_algorithm


@pytest.mark.parametrize("face", list("URFDLB"))
def test_four_quarter_turns_are_identity(face: str):
    assert CubeState().apply(" ".join([face] * 4)).solved


@pytest.mark.parametrize("face", list("URFDLB"))
def test_move_and_inverse_are_identity(face: str):
    assert CubeState().apply(f"{face} {face}'").solved


def test_scramble_is_legal_and_round_trips():
    state = CubeState().apply("R U R' U' F2 D L2 B'")
    state.validate()
    assert state.apply("B L2 D' F2 U R U' R'").solved


def test_rejects_impossible_single_flipped_edge():
    with pytest.raises(InvalidCubeState, match="flip sum"):
        CubeState(eo=(1,) + (0,) * 11).validate()


def test_rejects_unknown_notation():
    with pytest.raises(ValueError):
        parse_algorithm("R M U")
