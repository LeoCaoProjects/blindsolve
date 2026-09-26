import React from 'react';
import { clamp } from '../../hooks/useElementSize';
import { CubeState } from '../../utils/cube';
import { ChallengeCubes } from './ChallengeCubes';

interface SplitStageProps {
  state: CubeState;
  stage: {width: number;height: number;};
  children: React.ReactNode;
}

const INPUT_MIN = 360;

/**
 * Cube on one side, answer on the other when there is room; cube above a compact two-column
 * answer area when there isn't. Either way the answer never pushes the dock off-screen.
 */
export function SplitStage({ state, stage, children }: SplitStageProps) {
  const wide = stage.width >= 900 && stage.height >= 320;
  const size = wide ?
  clamp(Math.min((stage.width - INPUT_MIN - 64) / 2 - 20, stage.height - 40), 140, 290) :
  clamp(Math.min((stage.width - 32) / 2, stage.height * 0.46), 104, 240);

  if (wide) {
    return (
      <div className="grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-[clamp(24px,3.5vw,56px)]">
        <ChallengeCubes state={state} size={size} />
        <div className="scroll-quiet max-h-full min-w-0 max-w-[560px] overflow-y-auto py-2">{children}</div>
      </div>);

  }
  return (
    <div className="scroll-quiet flex h-full min-h-0 flex-col gap-5 overflow-y-auto">
      <ChallengeCubes state={state} size={size} className="shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>);

}