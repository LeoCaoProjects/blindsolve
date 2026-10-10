import React, { useEffect, useRef, useState } from 'react';
import { useDefaultView } from '../../contexts/AppDataContext';
import { CubeMode, CubeViewPref, FaceColor, LetterScheme } from '../../types/app';
import { FACES, Face, slotType } from '../../utils/cube';
import { COLOR_HEX, COLOR_TEXT, REFERENCE_COLORS, siblingsOf } from '../../utils/scheme';
import { applyView, glyphRotation, viewTransform } from '../../utils/view';

export interface CubeView {
  up: Face;
  front: Face;
}

interface SchemeCubeProps {
  scheme: LetterScheme;
  /** Sticker colours; always the fixed scramble reference unless a caller needs otherwise */
  colors?: Record<Face, FaceColor>;
  size: number;
  /** Camera only — defaults to the saved Default Cube View */
  view?: CubeViewPref;
  mode?: CubeMode | 'static';
  selected?: string | null;
  edgeBuffer?: string;
  cornerBuffer?: string;
  showBuffers?: boolean;
  /** Emphasise stickers carrying these tokens: [first, second] */
  highlightTokens?: string[];
  highlightType?: 'corner' | 'edge' | null;
  /** Exact sticker ids to emphasise, in pair order. Takes precedence over highlightTokens. */
  highlightIds?: string[];
  /** How many leading highlightIds belong to the pair's first token (accent ring); the rest get the ink ring */
  highlightPrimaryCount?: number;
  onPick?: (id: string) => void;
  onViewChange?: (view: CubeView) => void;
  resetSignal?: number;
  /** Camera angle to animate to (e.g. to show the stickers of a flashcard) */
  rotation?: {x: number;y: number;};
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
  L: [-1, 0, 0]
};

/**
 * The lettered cube used across Settings, Setup and practice pages.
 * Same construction as the Timer's cube, with tokens printed on stickers.
 */
export function SchemeCube({
  scheme,
  colors = REFERENCE_COLORS,
  size,
  view,
  mode = 'view',
  selected = null,
  edgeBuffer,
  cornerBuffer,
  showBuffers = false,
  highlightTokens,
  highlightType = null,
  highlightIds,
  highlightPrimaryCount = 1,
  onPick,
  onViewChange,
  resetSignal = 0,
  rotation,
  label = 'Cube',
  className = ''
}: SchemeCubeProps) {
  const savedView = useDefaultView();
  const camera = view ?? savedView;
  const [rot, setRot] = useState(DEFAULT_ROT);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{x: number;y: number;rx: number;ry: number;moved: boolean;} | null>(null);
  const movedRef = useRef(false);

  const S = Math.round(size * 0.56);
  const half = S / 2;
  const gap = Math.max(2, Math.round(S * 0.032));
  const radius = Math.max(1.5, S * 0.022);

  useEffect(() => setRot(rotation ?? DEFAULT_ROT), [resetSignal, camera.top, camera.front]);
  useEffect(() => {
    if (rotation) setRot(rotation);
  }, [rotation?.x, rotation?.y]);

  useEffect(() => {
    onViewChange?.(computeView(rot.x, rot.y, camera));
  }, [rot.x, rot.y, camera.top, camera.front]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      movedRef.current = true;
      setDragging(true);
      setRot({ x: Math.max(-88, Math.min(88, d.rx - dy * 0.45)), y: d.ry + dx * 0.45 });
    };
    const up = () => {
      if (dragRef.current?.moved && mode === 'cube-view') {
        // Snap to the nearest quarter turn so "Use this view" is unambiguous.
        setRot((r) => ({ x: snap(r.x, true), y: snap(r.y, false) }));
      }
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [mode]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    movedRef.current = false;
    dragRef.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y, moved: false };
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const snapping = mode === 'cube-view';
    const step = snapping ? 90 : 15;
    if (e.key === 'ArrowLeft') setRot((r) => ({ ...r, y: r.y - step }));else
    if (e.key === 'ArrowRight') setRot((r) => ({ ...r, y: r.y + step }));else
    if (e.key === 'ArrowUp') setRot((r) => ({ ...r, x: snapping ? r.x < -30 ? -27 : 88 : Math.min(88, r.x + step) }));else
    if (e.key === 'ArrowDown') setRot((r) => ({ ...r, x: snapping ? r.x > 30 ? -27 : -88 : Math.max(-88, r.x - step) }));else
    return;
    e.preventDefault();
  };

  const hasHighlight = !!(highlightIds?.length || highlightTokens?.length);
  const edgeSiblings = showBuffers && edgeBuffer ? siblingsOf(edgeBuffer) : [];
  const cornerSiblings = showBuffers && cornerBuffer ? siblingsOf(cornerBuffer) : [];

  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => setRot(DEFAULT_ROT)}
      onKeyDown={onKeyDown}
      className={`relative shrink-0 touch-none select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
      style={{ width: size, height: size, perspective: size * 3.4 }}>
      
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg) ${viewTransform(camera)}`,
          transition: dragging ? 'none' : 'transform 260ms cubic-bezier(0.23, 1, 0.32, 1)'
        }}>
        
        {FACES.map((face) =>
        <div
          key={face}
          className="absolute grid"
          style={{
            left: (size - S) / 2,
            top: (size - S) / 2,
            width: S,
            height: S,
            transform: faceTransform(face, half),
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
            gap,
            padding: gap,
            background: 'var(--cube-body)',
            borderRadius: S * 0.045,
            backfaceVisibility: 'hidden'
          }}>
          
            {Array.from({ length: 9 }).map((_, i) => {
            const color = colors[face];
            const bg = COLOR_HEX[color];
            const type = slotType(i);
            if (!type) {
              // Centres are never targets: when a pair is highlighted they dim with everything else.
              return (
                <div
                  key={i}
                  style={{ background: bg, borderRadius: radius, opacity: hasHighlight ? 0.2 : 1, transition: 'opacity 180ms ease-out' }} />);


            }
            const id = `${face}${i}`;
            const token = scheme[id] ?? '';
            const pickable =
            mode === 'lettering' || mode === 'edge-buffer' && type === 'edge' || mode === 'corner-buffer' && type === 'corner';
            const typeDim = mode === 'edge-buffer' && type !== 'edge' || mode === 'corner-buffer' && type !== 'corner';
            // Targets resolve by exact sticker id when given, so an edge "X" and a corner "CH" never mix.
            const tokenIndex = highlightIds ?
            highlightIds.indexOf(id) :
            highlightTokens ?
            highlightTokens.indexOf(token) :
            -1;
            const tokenMatch = tokenIndex !== -1 && (!!highlightIds || !highlightType || highlightType === type);
            // With a highlight, everything except the tested stickers is dimmed (centres too, above).
            const dim = typeDim || hasHighlight && !tokenMatch;
            const isBuffer = showBuffers && (id === edgeBuffer || id === cornerBuffer);
            const isBufferPiece = !isBuffer && (edgeSiblings.includes(id) || cornerSiblings.includes(id));
            const isSelected = selected === id;

            const shadows: string[] = [];
            if (isBuffer) shadows.push('inset 0 0 0 2px rgba(0,0,0,0.72)', '0 0 0 1.5px var(--ink)');else
            if (isBufferPiece) shadows.push('inset 0 0 0 2px rgba(0,0,0,0.38)');
            if (tokenMatch)
            shadows.push(
              tokenIndex < (highlightIds ? highlightPrimaryCount : 1) ?
              `inset 0 0 0 ${Math.max(2, S * 0.024)}px var(--accent)` :
              `inset 0 0 0 ${Math.max(1.5, S * 0.014)}px var(--cube-body), inset 0 0 0 ${Math.max(3, S * 0.03)}px var(--ink)`
            );
            if (isSelected) shadows.push('0 0 0 2px var(--accent)');

            const fontSize = Math.max(8, S * (token.length > 2 ? 0.075 : token.length === 2 ? 0.1 : 0.13));
            const style: React.CSSProperties = {
              background: bg,
              borderRadius: radius,
              opacity: dim ? 0.2 : 1,
              boxShadow: shadows.join(', ') || undefined,
              color: COLOR_TEXT[color],
              fontSize,
              transition: 'opacity 180ms ease-out, box-shadow 150ms ease-out'
            };
            const turn = glyphRotation(face, camera);
            const content =
            <>
                  <span className="inline-block" style={{ transform: turn ? `rotate(${turn}deg)` : undefined }}>
                    {token}
                  </span>
                  {isBuffer && <span className="sr-only"> (buffer)</span>}
                </>;

            if (pickable && onPick) {
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Sticker ${token || 'unlabelled'}${isBuffer ? ', buffer' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (!movedRef.current) onPick(id);
                  }}
                  className="flex items-center justify-center font-mono font-medium leading-none outline-none"
                  style={style}>
                  
                    {content}
                  </button>);

            }
            return (
              <div key={i} className="flex items-center justify-center font-mono font-medium leading-none" style={style}>
                  {content}
                </div>);

          })}
          </div>
        )}
      </div>
    </div>);

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
    case 'F':
      return `translateZ(${half}px)`;
    case 'B':
      return `rotateY(180deg) translateZ(${half}px)`;
    case 'R':
      return `rotateY(90deg) translateZ(${half}px)`;
    case 'L':
      return `rotateY(-90deg) translateZ(${half}px)`;
    case 'U':
      return `rotateX(90deg) translateZ(${half}px)`;
    case 'D':
      return `rotateX(-90deg) translateZ(${half}px)`;
  }
}

/** Which face points up, and which faces the viewer, for the saved view plus a manual rotation. */
function computeView(rxDeg: number, ryDeg: number, camera: CubeViewPref): CubeView {
  const rx = rxDeg * Math.PI / 180;
  const ry = ryDeg * Math.PI / 180;
  let up: Face = 'U';
  let front: Face = 'F';
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
  if ((front as Face) === up || NORMALS[front].every((v, i) => v === -NORMALS[up][i])) {
    // Looking straight down: the face nearest the bottom of the screen is the front.
    let best = -Infinity;
    FACES.forEach((face) => {
      if (face === up || NORMALS[face].every((v, i) => v === -NORMALS[up][i])) return;
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
