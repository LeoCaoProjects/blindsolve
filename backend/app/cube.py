from __future__ import annotations

from dataclasses import dataclass


class InvalidCubeState(ValueError):
    pass


# Cubie ordering follows Kociemba: URF UFL ULB UBR DFR DLF DBL DRB;
# UR UF UL UB DR DF DL DB FR FL BL BR.
_MOVE_CUBES = {
    "U": ((3, 0, 1, 2, 4, 5, 6, 7), (0,) * 8,
          (3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11), (0,) * 12),
    "R": ((4, 1, 2, 0, 7, 5, 6, 3), (2, 0, 0, 1, 1, 0, 0, 2),
          (8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0), (0,) * 12),
    "F": ((1, 5, 2, 3, 0, 4, 6, 7), (1, 2, 0, 0, 2, 1, 0, 0),
          (0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11),
          (0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0)),
    "D": ((0, 1, 2, 3, 5, 6, 7, 4), (0,) * 8,
          (0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11), (0,) * 12),
    "L": ((0, 2, 6, 3, 4, 1, 5, 7), (0, 1, 2, 0, 0, 2, 1, 0),
          (0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11), (0,) * 12),
    "B": ((0, 1, 3, 7, 4, 5, 2, 6), (0, 0, 1, 2, 0, 0, 2, 1),
          (0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7),
          (0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1)),
}


def _parity(values: tuple[int, ...]) -> int:
    return sum(values[i] > values[j] for i in range(len(values)) for j in range(i + 1, len(values))) % 2


@dataclass(frozen=True, slots=True)
class CubeState:
    cp: tuple[int, ...] = tuple(range(8))
    co: tuple[int, ...] = (0,) * 8
    ep: tuple[int, ...] = tuple(range(12))
    eo: tuple[int, ...] = (0,) * 12

    def validate(self) -> None:
        if len(self.cp) != 8 or sorted(self.cp) != list(range(8)):
            raise InvalidCubeState("corner permutation must contain 0..7 exactly once")
        if len(self.ep) != 12 or sorted(self.ep) != list(range(12)):
            raise InvalidCubeState("edge permutation must contain 0..11 exactly once")
        if len(self.co) != 8 or any(value not in range(3) for value in self.co):
            raise InvalidCubeState("corner orientations must be eight values in 0..2")
        if len(self.eo) != 12 or any(value not in range(2) for value in self.eo):
            raise InvalidCubeState("edge orientations must be twelve values in 0..1")
        if sum(self.co) % 3:
            raise InvalidCubeState("corner twist sum must be divisible by 3")
        if sum(self.eo) % 2:
            raise InvalidCubeState("edge flip sum must be even")
        if _parity(self.cp) != _parity(self.ep):
            raise InvalidCubeState("corner and edge permutation parity must match")

    @property
    def solved(self) -> bool:
        return self == CubeState()

    def compose(self, move: CubeState) -> CubeState:
        return CubeState(
            cp=tuple(self.cp[move.cp[i]] for i in range(8)),
            co=tuple((self.co[move.cp[i]] + move.co[i]) % 3 for i in range(8)),
            ep=tuple(self.ep[move.ep[i]] for i in range(12)),
            eo=tuple((self.eo[move.ep[i]] + move.eo[i]) % 2 for i in range(12)),
        )

    def apply(self, algorithm: str) -> CubeState:
        state = self
        for token in parse_algorithm(algorithm):
            turns = 2 if token.endswith("2") else 3 if token.endswith("'") else 1
            base = token[0]
            move = CubeState(*_MOVE_CUBES[base])
            for _ in range(turns):
                state = state.compose(move)
        return state

    def as_dict(self) -> dict[str, list[int]]:
        return {"cp": list(self.cp), "co": list(self.co), "ep": list(self.ep), "eo": list(self.eo)}


def parse_algorithm(algorithm: str) -> tuple[str, ...]:
    tokens = tuple(filter(None, algorithm.split()))
    invalid = [token for token in tokens if token not in {f + suffix for f in "URFDLB" for suffix in ("", "'", "2")}]
    if invalid:
        raise ValueError(f"unsupported move token(s): {', '.join(invalid)}")
    return tokens

