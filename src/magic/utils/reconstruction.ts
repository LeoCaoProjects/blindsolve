import type { CubeHighlight } from '../components/cube/Cube3D';
import type { Reconstruction } from '../hooks/useReconstruction';

export function cubeHighlightFor(r: Reconstruction): CubeHighlight | undefined {
  const step = r.step;
  if (step.kind !== 'break') return undefined;
  return {
    type: step.piece === 'corners' ? 'corner' : 'edge',
    letters: step.options,
    focused: step.options[r.optionFocus],
    selected: r.breaks[step.piece] ?? null,
    onPick: r.pickBreak
  };
}