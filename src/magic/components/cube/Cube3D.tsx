import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CubeState,
  FACES,
  Face,
  HiddenPartner,
  STICKER_COLORS,
  STICKER_TEXT,
  piecePartners,
  slotType } from
'../../utils/cube';
import { useDefaultView, useLetterScheme } from '../../contexts/AppDataContext';
import { CubeViewPref } from '../../types/app';
import { homeSticker } from '../../utils/bld';
import { FRONT_ROT, Rot, faceDepth } from '../../utils/camera';
import { glyphRotation, viewTransform } from '../../utils/view';
import { cubeGeometry } from '../../utils/cubeGeometry';
import { useViewportSizingActive } from '../../utils/viewportSizing';

export interface CubeHighlight {
  /** Resolved sticker targets (see utils/reconstruction breakTargets). Drives BOTH highlight and click. */
  targets: {id: string;value: string;}[];
  focused?: string | null;
  selected?: string | null;
  onPick?: (letter: string) => void;
}

interface Cube3DProps {
  state: CubeState;
  size: number;
  highlight?: CubeHighlight;
  showLetters?: boolean;
  className?: string;
  label?: string;
  /** Camera only — defaults to the saved Default Cube View */
  view?: CubeViewPref;
  /** Starting angle when uncontrolled */
  initialRot?: Rot;
  /** Controlled angle (e.g. two linked views of one cube) */
  rotation?: Rot;
  onRotationChange?: (r: Rot) => void;
  /** @deprecated Orientation updates are always instant; retained for callers. */
  instant?: boolean;
  onDragChange?: (dragging: boolean) => void;
  /**
   * Floating ticks beyond a visible sticker's edge in the colours of that piece's hidden stickers.
   * They live in the face's plane, off the cube body, and fade in as the partner face turns away.
   */
  hiddenCues?: boolean;
}

export const BACK_ROT: Rot = { x: 27, y: 143 };

/**
 * Geometry never depends on highlight state: every face is a fixed 3×3 grid of equal cells,
 * and highlights are drawn as inset overlays on top of the sticker.
 */
export function Cube3D({
  state,
  size,
  highlight,
  showLetters = false,
  className = '',
  label = 'Scrambled cube',
  view,
  initialRot = FRONT_ROT,
  rotation,
  onRotationChange,
  onDragChange,
  hiddenCues = false
}: Cube3DProps) {
  const rootUnits=useViewportSizingActive();
  const savedView = useDefaultView();
  const camera = view ?? savedView;
  const scheme = useLetterScheme();
  const [inner, setInner] = useState<Rot>(initialRot);
  const rot = rotation ?? inner;
  const rotRef = useRef(rot);
  rotRef.current = rot;
  const setRot = (r: Rot) => rotation ? onRotationChange?.(r) : setInner(r);
  const setRotRef = useRef(setRot);
  setRotRef.current = setRot;
  const dragCbRef = useRef(onDragChange);
  dragCbRef.current = onDragChange;

  const signature = FACES.map((f) => state[f].join('')).join('');

  // A new state or view returns to the saved default angle; manual rotation is temporary.
  useLayoutEffect(() => {
    if (!rotation) setInner(initialRot);
  }, [signature, camera.top, camera.front]);

  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{x: number;y: number;rx: number;ry: number;moved: boolean;} | null>(null);
  const movedRef = useRef(false);

  const S = Math.round(size * 0.56);
  const half = S / 2;
  const gap = Math.max(2, Math.round(S * 0.032));
  const radius = Math.max(1.5, S * 0.022);
  const tokenSize = (t: string) => Math.max(8, S * (t.length > 2 ? 0.075 : t.length === 2 ? 0.095 : 0.11));

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      if (!d.moved) {
        d.moved = true;
        setDragging(true);
        dragCbRef.current?.(true);
      }
      movedRef.current = true;
      setRotRef.current({ x: Math.max(-85, Math.min(85, d.rx - dy * 0.45)), y: d.ry + dx * 0.45 });
    };
    const up = () => {
      if (dragRef.current?.moved) dragCbRef.current?.(false);
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    movedRef.current = false;
    dragRef.current = { x: e.clientX, y: e.clientY, rx: rotRef.current.x, ry: rotRef.current.y, moved: false };
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const r = rotRef.current;
    const step = 15;
    if (e.key === 'ArrowLeft') setRot({ ...r, y: r.y - step });else
    if (e.key === 'ArrowRight') setRot({ ...r, y: r.y + step });else
    if (e.key === 'ArrowUp') setRot({ ...r, x: Math.min(85, r.x + step) });else
    if (e.key === 'ArrowDown') setRot({ ...r, x: Math.max(-85, r.x - step) });else
    return;
    e.preventDefault();
  };

  // How far each face has turned away: drives the hidden-colour cues.
  const hiddenness = {} as Record<Face, number>;
  if (hiddenCues) FACES.forEach((f) => hiddenness[f] = Math.max(0, Math.min(1, (0.32 - faceDepth(f, rot, camera, state)) / 0.32)));

  const cell = (S - gap * 4) / 3;
  const cueT = Math.max(2, S * 0.022);
  const cueOff = Math.max(4, S * 0.05);

  return (
    <div
      role="group"
      aria-label={label}
      data-cube-view={`${camera.top}/${camera.front}`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => setRot(initialRot)}
      onKeyDown={onKeyDown}
      className={`relative shrink-0 touch-none select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
      style={cubeGeometry({ width: size, height: size, perspective: size * 3.4 },rootUnits)}>
      
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg) ${viewTransform(camera, state)}`,
          transition: 'none'
        }}>
        
        {FACES.map((face) => {
          const turn = glyphRotation(face, camera, state);
          const glyph = (text: string | null) =>
          text ?
          <span className="inline-block" style={{ transform: turn ? `rotate(${turn}deg)` : undefined }}>
                {text}
              </span> :
          null;
          return (
            <div
              key={face}
              className="absolute grid"
              style={cubeGeometry({
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
              },rootUnits)}>
              
            {state[face].map((color, i) => {
                const type = slotType(i);
                const id = `${face}${i}`;
                // Cycle-break option: looked up from the resolved target list, never recomputed here.
                const target = highlight?.targets.find((t) => t.id === id);
                const letter = target?.value ?? null;
                const isOption = !!target;
                // Sticker token: the user's token for the physical sticker sitting here.
                const home = type && showLetters && !highlight ? homeSticker(state, id) : null;
                const token = isOption ? letter : home ? scheme[home] ?? '' : null;
                const base: React.CSSProperties = cubeGeometry({
                  background: STICKER_COLORS[color],
                  borderRadius: radius,
                  color: STICKER_TEXT[color],
                  fontSize: tokenSize(token ?? '')
                },rootUnits);
                if (isOption && letter) {
                  const selected = highlight?.selected === letter;
                  const focused = highlight?.focused === letter;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Sticker ${letter}`}
                      aria-pressed={selected}
                      onClick={() => {
                        if (!movedRef.current) highlight?.onPick?.(letter);
                      }}
                      className="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-0 font-mono font-medium leading-none outline-none"
                      style={base}>
                      
                    {glyph(token)}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={cubeGeometry({
                          borderRadius: radius,
                          boxShadow: selected ?
                          `inset 0 0 0 ${Math.max(2, S * 0.022)}px var(--accent)` :
                          focused ?
                          `inset 0 0 0 2px var(--cube-body), inset 0 0 0 3.5px var(--ink)` :
                          undefined,
                          transition: 'box-shadow 150ms ease-out'
                        },rootUnits)} />
                      
                  </button>);

                }
                return (
                  <div
                    key={i}
                    className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden font-mono leading-none"
                    style={{ ...base, opacity: highlight ? 0.14 : 1, transition: 'opacity 200ms ease-out' }}>
                    
                  {showLetters && !highlight && glyph(token)}
                </div>);

              })}
            {hiddenCues &&
              state[face].flatMap((_, i) =>
              slotType(i) ?
              piecePartners(state, face, i).map((p) =>
              <Cue key={`${i}-${p.dir}`} p={p} i={i} amount={hiddenness[p.face]} cell={cell} gap={gap} S={S} t={cueT} off={cueOff} rootUnits={rootUnits} />
              ) :
              []
              )}
          </div>);

        })}
      </div>
    </div>);

}

/** A short tick floating just outside the face edge, aligned with its sticker. Purely visual. */
function Cue({ p, i, amount, cell, gap, S, t, off, rootUnits }: {p: HiddenPartner;i: number;amount: number;cell: number;gap: number;S: number;t: number;off: number;rootUnits:boolean;}) {
  const r = Math.floor(i / 3);
  const c = i % 3;
  const len = cell * 0.62;
  const along = (k: number) => gap + k * (cell + gap) + (cell - len) / 2;
  const pos: React.CSSProperties =
  p.dir === 'top' ?
  { left: along(c), top: -off - t, width: len, height: t } :
  p.dir === 'bottom' ?
  { left: along(c), top: S + off, width: len, height: t } :
  p.dir === 'left' ?
  { top: along(r), left: -off - t, width: t, height: len } :
  { top: along(r), left: S + off, width: t, height: len };
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={cubeGeometry({
        ...pos,
        borderRadius: t,
        background: STICKER_COLORS[p.color],
        opacity: amount * 0.85,
        transition: 'opacity 160ms ease-out'
      },rootUnits)} />);


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
