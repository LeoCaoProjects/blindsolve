import React, { useEffect, useState } from 'react';
import { useDefaultView } from '../../contexts/AppDataContext';
import { FRONT_ROT, Rot, oppositeRot, visibleFaces } from '../../utils/camera';
import { CubeState, FACES, STICKER_COLORS } from '../../utils/cube';
import { Cube3D } from '../cube/Cube3D';

interface ChallengeCubesProps {
  state: CubeState;
  size: number;
  className?: string;
}

/**
 * One cube, seen from both sides. The second view is always the first one walked around to the
 * other side (pitch mirrored, yaw + 180°). Whichever cube is dragged, both follow the same angle
 * with no easing, so neither lags behind the other.
 * Floating ticks beside visible edge and corner stickers show the colours hidden on the far side.
 */
export function ChallengeCubes({ state, size, className = '' }: ChallengeCubesProps) {
  const camera = useDefaultView();
  const [rot, setRot] = useState<Rot>(FRONT_ROT);
  const [dragging, setDragging] = useState(false);
  const signature = FACES.map((f) => state[f].join('')).join('');
  useEffect(() => setRot(FRONT_ROT), [signature, camera.top, camera.front]);
  const back = oppositeRot(rot);

  return (
    <div className={`flex items-start justify-center gap-[clamp(12px,3vw,40px)] ${className}`}>
      <figure className="flex flex-col items-center">
        <Cube3D
          state={state}
          size={size}
          rotation={rot}
          onRotationChange={setRot}
          instant={dragging}
          onDragChange={setDragging}
          hiddenCues
          label="Challenge cube, front" />
        
        <FaceKey state={state} rot={rot} />
      </figure>
      <figure className="flex flex-col items-center">
        <Cube3D
          state={state}
          size={size}
          rotation={back}
          onRotationChange={(r) => setRot(oppositeRot(r))}
          instant={dragging}
          onDragChange={setDragging}
          hiddenCues
          label="Challenge cube, back" />
        
        <FaceKey state={state} rot={back} />
      </figure>
    </div>);

}

/** Which faces this view shows: centre colour + face letter, e.g. U F R / D B L. */
function FaceKey({ state, rot }: {state: CubeState;rot: Rot;}) {
  const camera = useDefaultView();
  const faces = visibleFaces(rot, camera, 0.2, state).slice(0, 3);
  return (
    <figcaption className="mt-1 flex h-5 items-center gap-3 font-mono text-[10.5px] text-ink-3" aria-label={`Showing ${faces.join(', ')}`}>
      {faces.map((f) =>
      <span key={f} className="flex items-center gap-1.5">
          <span aria-hidden className="h-[7px] w-[7px] rounded-[1.5px]" style={{ background: STICKER_COLORS[state[f][4]] }} />
          {f}
        </span>
      )}
    </figcaption>);

}