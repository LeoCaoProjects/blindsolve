import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { LetteringScheme, PieceType } from "../domain/bld/types";

type Face = "U" | "L" | "F" | "R" | "B" | "D";
type Vec = [number, number, number];

interface Sticker {
  pos: Vec;
  normal: Vec;
  color: Face;
  stickerId: string | null;
}

export interface RailCubeHighlight {
  type: PieceType;
  stickerIds: string[];
  focused?: string | null;
  selected?: string | null;
  onPick?: (stickerId: string) => void;
}

interface Props {
  scramble: string;
  scheme: LetteringScheme;
  size: number;
  highlight?: RailCubeHighlight;
  showLetters?: boolean;
  className?: string;
  label?: string;
}

const FACES: Face[] = ["U", "L", "F", "R", "B", "D"];
const DEFAULT_ROT = { x: -27, y: -37 };
const COLORS: Record<Face, string> = {
  U: "#ECEAE4",
  D: "#E8C443",
  F: "#2F9658",
  B: "#2D69B7",
  R: "#C73C34",
  L: "#E27A2D",
};
const TEXT: Record<Face, string> = {
  U: "#151412",
  D: "#151412",
  L: "#151412",
  F: "#ffffff",
  B: "#ffffff",
  R: "#ffffff",
};
const FACE_STICKERS: Record<Face, Array<string | null>> = {
  U: ["U:UBL", "U:UB", "U:URB", "U:UL", null, "U:UR", "U:ULF", "U:UF", "U:UFR"],
  L: ["L:UBL", "L:UL", "L:ULF", "L:BL", null, "L:FL", "L:DLB", "L:DL", "L:DFL"],
  F: ["F:ULF", "F:UF", "F:UFR", "F:FL", null, "F:FR", "F:DFL", "F:DF", "F:DFR"],
  R: ["R:UFR", "R:UR", "R:URB", "R:FR", null, "R:BR", "R:DFR", "R:DR", "R:DBR"],
  B: ["B:URB", "B:UB", "B:UBL", "B:BR", null, "B:BL", "B:DBR", "B:DB", "B:DLB"],
  D: ["D:DFL", "D:DF", "D:DFR", "D:DL", null, "D:DR", "D:DLB", "D:DB", "D:DBR"],
};
const NORMALS: Record<Face, Vec> = {
  U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0],
};
type MoveDef = { inLayer: (p: Vec, wide: boolean) => boolean; rotate: (v: Vec) => Vec };
const MOVES: Record<string, MoveDef> = {
  R: { inLayer: (p, w) => (w ? p[0] >= 0 : p[0] === 1), rotate: ([x, y, z]) => [x, z, -y] },
  L: { inLayer: (p, w) => (w ? p[0] <= 0 : p[0] === -1), rotate: ([x, y, z]) => [x, -z, y] },
  U: { inLayer: (p, w) => (w ? p[1] >= 0 : p[1] === 1), rotate: ([x, y, z]) => [-z, y, x] },
  D: { inLayer: (p, w) => (w ? p[1] <= 0 : p[1] === -1), rotate: ([x, y, z]) => [z, y, -x] },
  F: { inLayer: (p, w) => (w ? p[2] >= 0 : p[2] === 1), rotate: ([x, y, z]) => [y, -x, z] },
  B: { inLayer: (p, w) => (w ? p[2] <= 0 : p[2] === -1), rotate: ([x, y, z]) => [-y, x, z] },
};

export const RailCube3D = memo(function RailCube3D({
  scramble,
  scheme,
  size,
  highlight,
  showLetters = false,
  className = "",
  label = "Scrambled cube",
}: Props) {
  const state = useMemo(() => stateFromScramble(scramble), [scramble]);
  const [rot, setRot] = useState(DEFAULT_ROT);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; rx: number; ry: number; moved: boolean } | null>(null);
  const movedRef = useRef(false);
  const side = Math.round(size * 0.56);
  const half = side / 2;
  const gap = Math.max(2, Math.round(side * 0.032));
  const radius = Math.max(1.5, side * 0.022);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      movedRef.current = true;
      setDragging(true);
      setRot({ x: Math.max(-85, Math.min(85, drag.rx - dy * 0.45)), y: drag.ry + dx * 0.45 });
    };
    const up = () => { dragRef.current = null; setDragging(false); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      className={`rail-cube-3d ${dragging ? "is-dragging" : ""} ${className}`}
      style={{ width: size, height: size, perspective: size * 3.4 }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        movedRef.current = false;
        dragRef.current = { x: event.clientX, y: event.clientY, rx: rot.x, ry: rot.y, moved: false };
      }}
      onDoubleClick={() => setRot(DEFAULT_ROT)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const step = 15;
        if (event.key === "ArrowLeft") setRot((value) => ({ ...value, y: value.y - step }));
        else if (event.key === "ArrowRight") setRot((value) => ({ ...value, y: value.y + step }));
        else if (event.key === "ArrowUp") setRot((value) => ({ ...value, x: Math.min(85, value.x + step) }));
        else if (event.key === "ArrowDown") setRot((value) => ({ ...value, x: Math.max(-85, value.x - step) }));
        else return;
        event.preventDefault();
      }}
    >
      <div
        className="rail-cube-3d-inner"
        style={{
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          transition: dragging ? "none" : "transform 260ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        {FACES.map((face) => (
          <div
            className="rail-cube-face"
            key={face}
            style={{
              left: (size - side) / 2,
              top: (size - side) / 2,
              width: side,
              height: side,
              transform: faceTransform(face, half),
              gridTemplateColumns: "repeat(3, 1fr)",
              gap,
              padding: gap,
              borderRadius: side * 0.045,
            }}
          >
            {state[face].map((sticker, index) => {
              const definition = sticker.stickerId ? scheme.stickers[sticker.stickerId] : undefined;
              const candidate = !!highlight && !!definition && highlight.type === definition.pieceType && highlight.stickerIds.includes(definition.id);
              const content = definition?.label ?? "";
              const style = {
                // Keep selectable highlight cells geometrically identical to ordinary divs.
                // Native button dimensions otherwise make a highlighted face reflow.
                boxSizing: "border-box" as const,
                width: "100%",
                height: "100%",
                minWidth: 0,
                minHeight: 0,
                padding: 0,
                border: 0,
                appearance: "none" as const,
                background: COLORS[sticker.color],
                borderRadius: radius,
                color: TEXT[sticker.color],
                fontSize: Math.max(8, side * (content.length > 1 ? 0.075 : candidate ? 0.13 : 0.1)),
              };
              if (candidate && definition) {
                const selected = highlight.selected === definition.id;
                const focused = highlight.focused === definition.id;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Sticker ${content}`}
                    aria-pressed={selected}
                    className="rail-cube-sticker is-option"
                    style={{ ...style, boxShadow: selected ? "0 0 0 2px var(--rail-accent)" : focused ? "0 0 0 2px var(--rail-ink)" : "0 0 0 1px rgba(255,255,255,0.35)" }}
                    onClick={() => { if (!movedRef.current) highlight.onPick?.(definition.id); }}
                  >
                    {content}
                  </button>
                );
              }
              return (
                <div key={index} className="rail-cube-sticker" style={{ ...style, opacity: highlight ? 0.14 : 1 }}>
                  {showLetters && !highlight ? content : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

function stateFromScramble(scramble: string): Record<Face, Sticker[]> {
  const stickers: Sticker[] = [];
  FACES.forEach((face) => {
    for (let index = 0; index < 9; index++) {
      stickers.push({ pos: slotPosition(face, Math.floor(index / 3), index % 3), normal: NORMALS[face], color: face, stickerId: FACE_STICKERS[face][index] });
    }
  });
  scramble.trim().split(/\s+/).filter(Boolean).forEach((token) => {
    const match = token.match(/^([URFDLB])(w?)(2'|2|')?$/);
    if (!match) return;
    const definition = MOVES[match[1]];
    const wide = match[2] === "w";
    const turns = match[3] === "'" ? 3 : match[3]?.startsWith("2") ? 2 : 1;
    for (let turn = 0; turn < turns; turn++) {
      stickers.forEach((sticker) => {
        if (definition.inLayer(sticker.pos, wide)) {
          sticker.pos = definition.rotate(sticker.pos);
          sticker.normal = definition.rotate(sticker.normal);
        }
      });
    }
  });
  const state = {} as Record<Face, Sticker[]>;
  FACES.forEach((face) => {
    state[face] = Array.from({ length: 9 }, (_, index) => ({ pos: slotPosition(face, Math.floor(index / 3), index % 3), normal: NORMALS[face], color: face, stickerId: null }));
  });
  stickers.forEach((sticker) => {
    const face = faceFromNormal(sticker.normal);
    state[face][slotIndex(face, sticker.pos)] = sticker;
  });
  return state;
}

function faceTransform(face: Face, half: number) {
  if (face === "F") return `translateZ(${half}px)`;
  if (face === "B") return `rotateY(180deg) translateZ(${half}px)`;
  if (face === "R") return `rotateY(90deg) translateZ(${half}px)`;
  if (face === "L") return `rotateY(-90deg) translateZ(${half}px)`;
  if (face === "U") return `rotateX(90deg) translateZ(${half}px)`;
  return `rotateX(-90deg) translateZ(${half}px)`;
}
function slotPosition(face: Face, row: number, column: number): Vec {
  if (face === "U") return [column - 1, 1, row - 1];
  if (face === "D") return [column - 1, -1, 1 - row];
  if (face === "F") return [column - 1, 1 - row, 1];
  if (face === "B") return [1 - column, 1 - row, -1];
  if (face === "R") return [1, 1 - row, 1 - column];
  return [-1, 1 - row, column - 1];
}
function faceFromNormal([x, y, z]: Vec): Face {
  if (y === 1) return "U";
  if (y === -1) return "D";
  if (z === 1) return "F";
  if (z === -1) return "B";
  return x === 1 ? "R" : "L";
}
function slotIndex(face: Face, [x, y, z]: Vec) {
  let row = 0, column = 0;
  if (face === "U") { column = x + 1; row = z + 1; }
  else if (face === "D") { column = x + 1; row = 1 - z; }
  else if (face === "F") { column = x + 1; row = 1 - y; }
  else if (face === "B") { column = 1 - x; row = 1 - y; }
  else if (face === "R") { column = 1 - z; row = 1 - y; }
  else { column = z + 1; row = 1 - y; }
  return row * 3 + column;
}
