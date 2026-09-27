import type { CubeHighlight } from '../components/cube/Cube3D';
import type { Reconstruction } from '../hooks/useReconstruction';
import { createSpeffzScheme } from '../../domain/bld/speffz';
import { CubeState, Face, PieceType, locateTarget, locationOf } from './cube';
import { ALL_STICKERS, speffzScheme } from './scheme';

export interface BreakTarget {
  /** Facelet on the rendered cube (object space), e.g. "R6" */
  id: string;
  /** The option value the selection logic uses, e.g. "J" */
  value: string;
}

/**
 * The single source of truth for cycle-break targets: each valid option resolved to the exact
 * sticker it names on this cube. The cube's highlight AND its click targets both come from this
 * list, so what's lit up is always exactly what can be picked.
 */
export function breakTargets(state: CubeState, type: PieceType, options: string[]): BreakTarget[] {
  return options.flatMap((value) => {
    const loc = locationOf(value, type);
    return loc ? [{ id: locateTarget(state, loc.face, loc.index), value }] : [];
  });
}

const canonical = createSpeffzScheme();
const magic = speffzScheme();
const physicalToSlot = Object.fromEntries(ALL_STICKERS.flatMap((slot) => {
  const label = magic[slot.id];
  const physical = Object.values(canonical.stickers).find((sticker) => sticker.pieceType === slot.type && sticker.label === label);
  return physical ? [[physical.id, slot.id]] : [];
}));

export function cubeHighlightFor(r: Reconstruction, state: CubeState): CubeHighlight | undefined {
  const step = r.step;
  if (step.kind !== 'break') return undefined;
  return {
    targets: r.breakTargetIds.flatMap((physicalId) => {
      const slot = physicalToSlot[physicalId];
      const sticker = r.draft.engine?.scheme.stickers[physicalId];
      if (!slot || !sticker) return [];
      return [{ id: locateTarget(state, slot[0] as Face, Number(slot.slice(1))), value: sticker.label }];
    }),
    focused: step.options[r.optionFocus],
    selected: r.breaks[step.piece] ?? null,
    onPick: r.pickBreak
  };
}
