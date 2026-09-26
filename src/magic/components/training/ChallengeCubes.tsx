import React from 'react';
import { BACK_ROT, Cube3D } from '../cube/Cube3D';
import { CubeState } from '../../utils/cube';

interface ChallengeCubesProps {
  state: CubeState;
  size: number;
  className?: string;
}

/** The challenge state from both sides, so every sticker is traceable without dragging. */
export function ChallengeCubes({ state, size, className = '' }: ChallengeCubesProps) {
  return (
    <div className={`flex items-center justify-center gap-4 md:gap-10 ${className}`}>
      <Cube3D state={state} size={size} label="Challenge cube, front view" />
      <Cube3D state={state} size={size} initialRot={BACK_ROT} label="Challenge cube, back view" />
    </div>);

}