import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDefaultView } from "../../contexts/AppDataContext";
import {
  CubeMode,
  CubeViewPref,
  FaceColor,
  LetterScheme,
} from "../../types/app";
import { CubeState, FACES, Face, slotType } from "../../utils/cube";
import {
  COLOR_HEX,
  COLOR_TEXT,
  REFERENCE_COLORS,
  siblingsOf,
} from "../../utils/scheme";
import { applyView, glyphRotation, viewTransform } from "../../utils/view";
import { cubeGeometry } from "../../utils/cubeGeometry";
import { useViewportSizingActive } from "../../utils/viewportSizing";
import { bestRotation } from "../../utils/camera";
import { useReducedMotion } from "framer-motion";

export interface CubeView {
  up: Face;
  front: Face;
}

interface SchemeCubeProps {
  scheme: LetterScheme;
  /** Optional scrambled facelets, sharing the Settings selection presentation. */
  state?: CubeState;
  hideLetters?: boolean;
  /** Recognition uses one neutral focus marker; partner colours stay unmarked. */
  recognitionSource?: string;
  /** Sticker colours; always the fixed scramble reference unless a caller needs otherwise */
  colors?: Record<Face, FaceColor>;
  size: number;
  /** Camera only — defaults to the saved Default Cube View */
  view?: CubeViewPref;
  mode?: CubeMode | "static";
  selected?: string | null;
  edgeBuffer?: string;
  cornerBuffer?: string;
  showBuffers?: boolean;
  /** Emphasise stickers carrying these tokens: [first, second] */
  highlightTokens?: string[];
  highlightType?: "corner" | "edge" | null;
  /** Exact sticker ids to emphasise, in pair order. Takes precedence over highlightTokens. */
  highlightIds?: string[];
  /** How many leading highlightIds belong to the pair's first token (accent ring); the rest get the ink ring */
  highlightPrimaryCount?: number;
  onPick?: (id: string) => void;
  /** Allow Settings Overview stickers to open their lettering editor. */
  pickInOverview?: boolean;
  onViewChange?: (view: CubeView) => void;
  resetSignal?: number;
  /** Camera angle to animate to (e.g. to show the stickers of a flashcard) */
  rotation?: { x: number; y: number };
  /** Opt-in for in-place target/view changes; route entry remains unchanged. */
  animateOrientation?: boolean;
  allowRotation?: boolean;
  freeRotation?: boolean;
  /** Reveal a physical selection using the shared target camera. */
  revealSelected?: boolean;
  label?: string;
  className?: string;
}

const DEFAULT_ROT = { x: -27, y: -37 };
const NORMALS: Record<Face, [number, number, number]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0],
};

/**
 * The lettered cube used across Settings, Setup and practice pages.
 * Same construction as the Timer's cube, with tokens printed on stickers.
 */
export function SchemeCube({
  scheme,
  state,
  hideLetters = false,
  recognitionSource,
  colors = REFERENCE_COLORS,
  size,
  view,
  mode = "view",
  selected = null,
  edgeBuffer,
  cornerBuffer,
  showBuffers = false,
  highlightTokens,
  highlightType = null,
  highlightIds,
  highlightPrimaryCount = 1,
  onPick,
  pickInOverview = false,
  onViewChange,
  resetSignal = 0,
  rotation,
  animateOrientation = false,
  allowRotation = true,
  freeRotation = false,
  revealSelected = false,
  label = "Cube",
  className = "",
}: SchemeCubeProps) {
  const rootUnits = useViewportSizingActive();
  const savedView = useDefaultView();
  const camera = view ?? savedView;
  const [rot, setRot] = useState(rotation ?? DEFAULT_ROT);
  const reduced = useReducedMotion();
  const currentRot = useRef(rot);
  currentRot.current = rot;
  const lastSelectionView = useRef<string | null>(null);
  const pickedSelection = useRef<string | null>(null);
  const lastBufferMode = useRef<typeof mode | null>(null);
  const [selectionMotion, setSelectionMotion] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    x: number;
    y: number;
    rx: number;
    ry: number;
    moved: boolean;
  } | null>(null);
  const movedRef = useRef(false);

  const S = Math.round(size * 0.56);
  const half = S / 2;
  const gap = Math.max(2, Math.round(S * 0.032));
  const radius = Math.max(1.5, S * 0.022);

  const orientationFor = (faces: Face[]) => {
    const target = bestRotation(faces, camera, currentRot.current).rot;
    // Free Settings rotation can accumulate full vertical turns as well as yaw.
    // Keep automatic orientation changes on the nearest equivalent turn.
    return freeRotation
      ? {
          ...target,
          x:
            target.x +
            360 * Math.round((currentRot.current.x - target.x) / 360),
        }
      : target;
  };
  useLayoutEffect(
    () => setRot(rotation ?? orientationFor([])),
    [resetSignal, camera.top, camera.front],
  );
  useLayoutEffect(() => {
    if (rotation) setRot(rotation);
  }, [rotation?.x, rotation?.y]);

  useLayoutEffect(() => {
    // The view-only settings tab previews the configured camera, even after a
    // manual rotation elsewhere. Other tabs keep their manual preview angle.
    if (mode === "cube-view" && !allowRotation)
      setRot(rotation ?? orientationFor([]));
  }, [mode, allowRotation]);

  useLayoutEffect(() => {
    if (!revealSelected || !selected) {
      pickedSelection.current = null;
      if (lastSelectionView.current) setRot(rotation ?? orientationFor([]));
      lastSelectionView.current = null;
      setSelectionMotion(false);
      return;
    }
    const key = `${camera.top}/${camera.front}`;
    // A directly picked sticker is already visible. Keep the user's angle;
    // only programmatic selection and view changes need camera alignment.
    const directlyPicked = pickedSelection.current === selected;
    pickedSelection.current = null;
    setSelectionMotion(lastSelectionView.current === key);
    if (!directlyPicked) setRot(orientationFor([selected[0] as Face]));
    lastSelectionView.current = key;
  }, [revealSelected, selected, camera.top, camera.front]);

  useLayoutEffect(() => {
    const entered = lastBufferMode.current !== mode;
    lastBufferMode.current = mode;
    if (!entered) return;
    const buffer =
      mode === "edge-buffer"
        ? edgeBuffer
        : mode === "corner-buffer"
          ? cornerBuffer
          : null;
    // Reveal the current buffer piece on tab entry only. Changing a buffer or
    // manually rotating within the tab must not move the camera again.
    if (buffer)
      setRot(
        orientationFor(
          [buffer, ...siblingsOf(buffer)].map((id) => id[0] as Face),
        ),
      );
  }, [mode, edgeBuffer, cornerBuffer]);

  useEffect(() => {
    onViewChange?.(computeView(rot.x, rot.y, camera));
  }, [rot.x, rot.y, camera.top, camera.front]);

  useEffect(() => {
    if (!allowRotation) {
      dragRef.current = null;
      setDragging(false);
      return;
    }
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      movedRef.current = true;
      setDragging(true);
      const x = freeRotation
        ? d.rx - dy * 0.45
        : Math.max(-88, Math.min(88, d.rx - dy * 0.45));
      const direction =
        freeRotation && Math.cos((((d.rx + x) / 2) * Math.PI) / 180) < 0
          ? -1
          : 1;
      const y = d.ry + dx * 0.45 * direction;
      setRot({ x, y });
      // Integrate from the last pointer position. Crossing a pole must not
      // reverse the entire drag accumulated since pointerdown.
      if (freeRotation)
        Object.assign(d, { x: e.clientX, y: e.clientY, rx: x, ry: y });
    };
    const up = () => {
      if (dragRef.current?.moved && mode === "cube-view") {
        // Snap to the nearest quarter turn so "Use this view" is unambiguous.
        setRot((r) => ({ x: snap(r.x, true), y: snap(r.y, false) }));
      }
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [mode, allowRotation, freeRotation]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!allowRotation || e.button !== 0) return;
    e.stopPropagation();
    movedRef.current = false;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      rx: rot.x,
      ry: rot.y,
      moved: false,
    };
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!allowRotation || e.target !== e.currentTarget) return;
    const snapping = mode === "cube-view";
    const step = snapping ? 90 : 15;
    const horizontalStep = (r: { x: number }) =>
      step * (freeRotation && Math.cos((r.x * Math.PI) / 180) < 0 ? -1 : 1);
    if (e.key === "ArrowLeft")
      setRot((r) => ({ ...r, y: r.y - horizontalStep(r) }));
    else if (e.key === "ArrowRight")
      setRot((r) => ({ ...r, y: r.y + horizontalStep(r) }));
    else if (e.key === "ArrowUp")
      setRot((r) => ({
        ...r,
        x: freeRotation
          ? r.x + step
          : snapping
            ? r.x < -30
              ? -27
              : 88
            : Math.min(88, r.x + step),
      }));
    else if (e.key === "ArrowDown")
      setRot((r) => ({
        ...r,
        x: freeRotation
          ? r.x - step
          : snapping
            ? r.x > 30
              ? -27
              : -88
            : Math.max(-88, r.x - step),
      }));
    else return;
    e.preventDefault();
  };

  const hasHighlight = !!(highlightIds?.length || highlightTokens?.length);
  const edgeSiblings = showBuffers && edgeBuffer ? siblingsOf(edgeBuffer) : [];
  const cornerSiblings =
    showBuffers && cornerBuffer ? siblingsOf(cornerBuffer) : [];

  return (
    <div
      role="group"
      aria-label={label}
      data-cube-view={`${camera.top}/${camera.front}`}
      tabIndex={allowRotation ? 0 : undefined}
      onPointerDown={onPointerDown}
      onDoubleClick={allowRotation ? () => setRot(DEFAULT_ROT) : undefined}
      onKeyDown={onKeyDown}
      className={`relative shrink-0 select-none ${allowRotation ? (dragging ? "touch-none cursor-grabbing" : "touch-none cursor-grab") : "touch-pan-y cursor-default"} ${className}`}
      style={cubeGeometry(
        { width: size, height: size, perspective: size * 3.4 },
        rootUnits,
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          // This transparent plane can otherwise intercept stickers behind its
          // centre plane at some viewing angles. Only the actual faces take hits.
          pointerEvents: "none",
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg) ${viewTransform(camera, state)}`,
          transition:
            !dragging && !reduced && (animateOrientation || selectionMotion)
              ? "transform 260ms cubic-bezier(0.23, 1, 0.32, 1)"
              : "none",
        }}
      >
        {FACES.map((face) => (
          <div
            key={face}
            className="absolute grid"
            style={cubeGeometry(
              {
                left: (size - S) / 2,
                top: (size - S) / 2,
                width: S,
                height: S,
                transform: faceTransform(face, half),
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gridTemplateRows: "repeat(3, minmax(0, 1fr))",
                gap,
                padding: gap,
                background: "var(--cube-body)",
                borderRadius: S * 0.045,
                backfaceVisibility: "hidden",
                pointerEvents: "auto",
              },
              rootUnits,
            )}
          >
            {Array.from({ length: 9 }).map((_, i) => {
              const color = colors[state?.[face][i] ?? face];
              const bg = COLOR_HEX[color];
              const type = slotType(i);
              if (!type) {
                // Centres are never targets: when a pair is highlighted they dim with everything else.
                return (
                  <div
                    key={i}
                    style={cubeGeometry(
                      {
                        background: bg,
                        borderRadius: radius,
                        opacity: hasHighlight
                          ? 0.2
                          : selected || (showBuffers && mode !== "cube-view")
                            ? 0.45
                            : 1,
                        transition: "opacity 180ms ease-out",
                      },
                      rootUnits,
                    )}
                  />
                );
              }
              const id = `${face}${i}`;
              const token = scheme[id] ?? "";
              const pickable =
                (mode === "view" && pickInOverview) ||
                mode === "lettering" ||
                (mode === "edge-buffer" && type === "edge") ||
                (mode === "corner-buffer" && type === "corner");
              const typeDim =
                (mode === "edge-buffer" && type !== "edge") ||
                (mode === "corner-buffer" && type !== "corner");
              // Targets resolve by exact sticker id when given, so an edge "X" and a corner "CH" never mix.
              const tokenIndex = highlightIds
                ? highlightIds.indexOf(id)
                : highlightTokens
                  ? highlightTokens.indexOf(token)
                  : -1;
              const tokenMatch =
                tokenIndex !== -1 &&
                (!!highlightIds || !highlightType || highlightType === type);
              // With a highlight, everything except the tested stickers is dimmed (centres too, above).
              const isBuffer =
                showBuffers && (id === edgeBuffer || id === cornerBuffer);
              const isBufferPiece =
                !isBuffer &&
                (edgeSiblings.includes(id) || cornerSiblings.includes(id));
              const isSelected = selected === id;
              const emphasizeBuffers = showBuffers && mode !== "cube-view";
              const dim = typeDim || (hasHighlight && !tokenMatch);
              const quiet =
                (selected && !isSelected && !tokenMatch) ||
                (emphasizeBuffers && !isBuffer && !isBufferPiece);

              const shadows: string[] = [];
              if (isBuffer)
                shadows.push(
                  `inset 0 0 0 ${Math.max(3, S * 0.028)}px var(--ink)`,
                  `inset 0 0 0 ${Math.max(5, S * 0.05)}px var(--cube-body)`,
                );
              else if (isBufferPiece)
                shadows.push(
                  "inset 0 0 0 2px var(--cube-body)",
                  "inset 0 0 0 3.5px var(--ink)",
                );
              if (tokenMatch && !isSelected && !recognitionSource)
                shadows.push(
                  tokenIndex < (highlightIds ? highlightPrimaryCount : 1)
                    ? `inset 0 0 0 ${Math.max(2, S * 0.024)}px var(--accent)`
                    : `inset 0 0 0 ${Math.max(1.5, S * 0.014)}px var(--cube-body), inset 0 0 0 ${Math.max(3, S * 0.03)}px var(--ink)`,
                );
              if (isSelected)
                shadows.push(
                  `inset 0 0 0 ${Math.max(3, S * 0.035)}px var(--accent)`,
                  `inset 0 0 0 ${Math.max(5, S * 0.06)}px var(--cube-body)`,
                );

              if (recognitionSource === id)
                shadows.push(
                  "inset 0 0 0 2px #fff",
                  "inset 0 0 0 4px var(--cube-body)",
                );

              const fontSize = Math.max(
                8,
                S *
                  (token.length > 2 ? 0.075 : token.length === 2 ? 0.1 : 0.13),
              );
              const style: React.CSSProperties = cubeGeometry(
                {
                  background: bg,
                  borderRadius: radius,
                  opacity: dim ? 0.2 : quiet ? 0.45 : 1,
                  boxShadow: shadows.join(", ") || undefined,
                  color: COLOR_TEXT[color],
                  fontSize,
                  transition:
                    "opacity 180ms ease-out, box-shadow 150ms ease-out",
                },
                rootUnits,
              );
              const turn = glyphRotation(face, camera);
              const content = (
                <>
                  {recognitionSource === id && (
                    <span
                      data-recognition-anchor
                      aria-hidden
                      className="absolute left-1/2 top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--cube-body)] bg-white"
                    />
                  )}
                  <span
                    className="inline-block"
                    style={{
                      transform: turn ? `rotate(${turn}deg)` : undefined,
                    }}
                  >
                    {hideLetters ? null : token}
                  </span>
                  {isBuffer && <span className="sr-only"> (buffer)</span>}
                </>
              );

              if (pickable && onPick) {
                return (
                  <button
                    key={i}
                    type="button"
                    data-sticker-id={id}
                    data-selected={isSelected || undefined}
                    data-buffer={
                      isBuffer
                        ? id === edgeBuffer
                          ? "edge"
                          : "corner"
                        : undefined
                    }
                    aria-label={`Sticker ${token || "unlabelled"}${isBuffer ? ", buffer" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (!movedRef.current) {
                        if (
                          (revealSelected ||
                            (mode === "view" && pickInOverview)) &&
                          selected !== id
                        )
                          pickedSelection.current = id;
                        onPick(id);
                      }
                    }}
                    className="flex items-center justify-center font-mono font-medium leading-none outline-none"
                    style={style}
                  >
                    {content}
                  </button>
                );
              }
              return (
                <div
                  key={i}
                  data-sticker-id={id}
                  data-recognition-sticker={
                    state && tokenMatch
                      ? recognitionSource === id || isSelected
                        ? "source"
                        : "partner"
                      : undefined
                  }
                  data-buffer={
                    isBuffer
                      ? id === edgeBuffer
                        ? "edge"
                        : "corner"
                      : undefined
                  }
                  className="relative flex items-center justify-center font-mono font-medium leading-none"
                  style={style}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function snap(v: number, clamp: boolean): number {
  if (clamp) {
    // Pitch: either a normal three-quarter view, or looking straight down/up at a face.
    if (v > 55) return 88;
    if (v < -55) return -88;
    return v > 0 ? 27 : -27;
  }
  return Math.round((v + 37) / 90) * 90 - 37;
}

function faceTransform(face: Face, half: number): string {
  switch (face) {
    case "F":
      return `translateZ(${half}px)`;
    case "B":
      return `rotateY(180deg) translateZ(${half}px)`;
    case "R":
      return `rotateY(90deg) translateZ(${half}px)`;
    case "L":
      return `rotateY(-90deg) translateZ(${half}px)`;
    case "U":
      return `rotateX(90deg) translateZ(${half}px)`;
    case "D":
      return `rotateX(-90deg) translateZ(${half}px)`;
  }
}

/** Which face points up, and which faces the viewer, for the saved view plus a manual rotation. */
function computeView(
  rxDeg: number,
  ryDeg: number,
  camera: CubeViewPref,
): CubeView {
  const rx = (rxDeg * Math.PI) / 180;
  const ry = (ryDeg * Math.PI) / 180;
  let up: Face = "U";
  let front: Face = "F";
  let minY = Infinity;
  let maxZ = -Infinity;
  FACES.forEach((face) => {
    const [nx, ny, nz] = applyView(camera, NORMALS[face]);
    const x = nx;
    const y = -ny;
    const z = nz;
    const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
    const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
    const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
    if (y2 < minY) {
      minY = y2;
      up = face;
    }
    // Front = the side face most facing the viewer (exclude the chosen up face later)
    if (z2 > maxZ) {
      maxZ = z2;
      front = face;
    }
  });
  if (
    (front as Face) === up ||
    NORMALS[front].every((v, i) => v === -NORMALS[up][i])
  ) {
    // Looking straight down: the face nearest the bottom of the screen is the front.
    let best = -Infinity;
    FACES.forEach((face) => {
      if (face === up || NORMALS[face].every((v, i) => v === -NORMALS[up][i]))
        return;
      const [nx, ny, nz] = applyView(camera, NORMALS[face]);
      const z1 = -nx * Math.sin(ry) + nz * Math.cos(ry);
      const y2 = -ny * Math.cos(rx) - z1 * Math.sin(rx);
      if (y2 > best) {
        best = y2;
        front = face;
      }
    });
  }
  return { up, front };
}
