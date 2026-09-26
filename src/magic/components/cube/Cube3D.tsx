import React, { useEffect, useRef, useState } from 'react';
import {
  CubeState,
  FACES,
  Face,
  PieceType,
  STICKER_COLORS,
  STICKER_TEXT,
  letterFor,
  physicalStickerAt,
  slotType } from
'../../utils/cube';
import { useAppData, useDefaultView } from '../../contexts/AppDataContext';
import { CubeViewPref } from '../../types/app';
import { viewForScrambledCenters, viewTransform } from '../../utils/view';

export interface CubeHighlight {
  type: PieceType;
  letters: string[];
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
  /** Starting angle; the back view uses { x: 27, y: 143 } */
  initialRot?: {x: number;y: number;};
}

const FRONT_ROT = { x: -27, y: -37 };
export const BACK_ROT = { x: 27, y: 143 };

export function Cube3D({
  state,
  size,
  highlight,
  showLetters = false,
  className = '',
  label = 'Scrambled cube',
  view,
  initialRot = FRONT_ROT
}: Cube3DProps) {
  const savedView = useDefaultView();
  const { setup } = useAppData();
  const camera = view ?? savedView;
  const stateCamera = viewForScrambledCenters(state, camera);
  const DEFAULT_ROT = initialRot;
  const [rot, setRot] = useState(DEFAULT_ROT);
  const signature = FACES.map((f) => state[f].join('')).join('');

  // A new state or view returns to the saved default angle; manual rotation is temporary.
  useEffect(() => {
    setRot(DEFAULT_ROT);
  }, [signature, camera.top, camera.front]);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{x: number;y: number;rx: number;ry: number;moved: boolean;} | null>(null);
  const movedRef = useRef(false);

  const S = Math.round(size * 0.56);
  const half = S / 2;
  const gap = Math.max(2, Math.round(S * 0.032));
  const radius = Math.max(1.5, S * 0.022);

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
      setRot({ x: Math.max(-85, Math.min(85, d.rx - dy * 0.45)), y: d.ry + dx * 0.45 });
    };
    const up = () => {
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
    dragRef.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y, moved: false };
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = 15;
    if (e.key === 'ArrowLeft') setRot((r) => ({ ...r, y: r.y - step }));else
    if (e.key === 'ArrowRight') setRot((r) => ({ ...r, y: r.y + step }));else
    if (e.key === 'ArrowUp') setRot((r) => ({ ...r, x: Math.min(85, r.x + step) }));else
    if (e.key === 'ArrowDown') setRot((r) => ({ ...r, x: Math.max(-85, r.x - step) }));else
    return;
    e.preventDefault();
  };

  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => setRot(DEFAULT_ROT)}
      onKeyDown={onKeyDown}
      className={`relative touch-none select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
      data-cube-view={`${camera.top}/${camera.front}`}
      style={{ width: size, height: size, perspective: size * 3.4 }}>
      
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg) ${viewTransform(stateCamera)}`,
          transition: dragging ? 'none' : 'transform 260ms cubic-bezier(0.23, 1, 0.32, 1)'
        }}>
        
        {FACES.map((face) =>
        <div
          key={face}
          data-face={face}
          className="absolute grid"
          style={{
            left: (size - S) / 2,
            top: (size - S) / 2,
            width: S,
            height: S,
            transform: faceTransform(face, half),
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap,
            padding: gap,
            background: 'var(--cube-body)',
            borderRadius: S * 0.045,
            backfaceVisibility: 'hidden'
          }}>
          
            {state[face].map((color, i) => {
            const type = slotType(i);
            const stickerId = type ? physicalStickerAt(state, face, i) : null;
            const letter = type && stickerId ? setup.scheme[stickerId] ?? letterFor(stickerId[0] as Face, Number(stickerId.slice(1)), type) : null;
            const isOption = !!highlight && !!letter && highlight.type === type && highlight.letters.includes(letter);
            const bg = STICKER_COLORS[color];
            if (isOption && letter) {
              const selected = highlight?.selected === letter;
              const focused = highlight?.focused === letter;
              return (
                <button
                  key={i}
                  data-sticker-id={stickerId ?? undefined}
                  type="button"
                  aria-label={`Sticker ${letter}`}
                  aria-pressed={selected}
                  onClick={() => {
                    if (!movedRef.current) highlight?.onPick?.(letter);
                  }}
                  className="flex items-center justify-center font-mono font-medium outline-none"
                  style={{
                    background: bg,
                    borderRadius: radius,
                    boxShadow: selected ?
                    '0 0 0 2px var(--accent)' :
                    focused ?
                    '0 0 0 2px var(--ink)' :
                    '0 0 0 1px rgba(255,255,255,0.35)',
                    color: STICKER_TEXT[color],
                    fontSize: Math.max(10, S * 0.13)
                  }}>
                  
                    {letter}
                  </button>);

            }
            return (
              <div
                key={i}
                data-sticker-id={stickerId ?? undefined}
                className="flex items-center justify-center font-mono"
                style={{
                  background: bg,
                  borderRadius: radius,
                  opacity: highlight ? 0.14 : 1,
                  transition: 'opacity 200ms ease-out',
                  color: STICKER_TEXT[color],
                  fontSize: Math.max(8, S * 0.1)
                }}>
                
                  {showLetters && !highlight && letter}
                </div>);

          })}
          </div>
        )}
      </div>
    </div>);

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
