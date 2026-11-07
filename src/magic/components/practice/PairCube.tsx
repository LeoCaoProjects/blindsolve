import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppData, useDefaultView } from '../../contexts/AppDataContext';
import { LetterScheme } from '../../types/app';
import { FRONT_ROT, Rot, bestRotation, oppositeRot } from '../../utils/camera';
import { Face, slotType } from '../../utils/cube';
import { EASE_OUT } from '../../utils/keyboard';
import { SchemeCube } from '../cube/SchemeCube';

type Kind = 'edge' | 'corner';

interface PairCubeProps {
  tokens: string[];
  /** null = Both: the pair is resolved through the edge lettering AND the corner lettering */
  type: Kind | null;
  size: number;
  animateOrientation?: boolean;
}

/**
 * Turns the lettered cube the short way to a view that shows the pair's stickers.
 * Each token is resolved separately per piece type, so an edge "X" and a corner "CH" never mix.
 * When one view can't show every target, it shows as many as possible and a small far-side
 * view appears for the rest, only for that card.
 */
export function PairCube({ tokens, type, size, animateOrientation = false }: PairCubeProps) {
  // A visit/card cube establishes its initial controlled angle before enabling
  // subsequent card transitions. Remounting on re-entry resets this lifecycle.
  const [established, setEstablished] = useState(false);
  useLayoutEffect(() => setEstablished(true), []);
  const { setup } = useAppData();
  const camera = useDefaultView();
  const last = useRef<Rot>(FRONT_ROT);

  const kinds: Kind[] = type ? [type] : ['edge', 'corner'];

  // Exact sticker ids: first token's stickers, then second token's. Same list drives camera and highlight.
  const { ids, primaryCount } = useMemo(() => {
    const first = kinds.map((k) => findSticker(setup.scheme, tokens[0], k)).filter((id): id is string => !!id);
    const second = kinds.map((k) => findSticker(setup.scheme, tokens[1], k)).filter((id): id is string => !!id);
    return { ids: [...first, ...second], primaryCount: first.length };
  }, [tokens.join('|'), type, setup.scheme]);

  const { rot, hidden } = useMemo(() => {
    const faces = ids.map((id) => id[0] as Face);
    if (!faces.length) return { rot: FRONT_ROT, hidden: [] as Face[] };
    return bestRotation(faces, camera, last.current);
  }, [ids.join('|'), camera.top, camera.front]);
  last.current = rot;

  const hiddenIds = ids.filter((id) => hidden.includes(id[0] as Face));
  const inset = Math.round(size * 0.42);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <SchemeCube
        scheme={setup.scheme}
        size={size}
        mode="static"
        rotation={rot}
        animateOrientation={animateOrientation && established}
        highlightIds={ids}
        highlightPrimaryCount={primaryCount}
        label={`Where ${tokens.join('')} sits on the cube${type ? '' : ', edges and corners'}`} />
      
      <AnimatePresence>
        {hiddenIds.length > 0 &&
        <motion.figure
          key={`${tokens.join('|')}-${type ?? 'both'}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="absolute -bottom-2 -right-3">
          
            <SchemeCube
            scheme={setup.scheme}
            size={inset}
            mode="static"
            rotation={oppositeRot(rot)}
            highlightIds={ids}
            highlightPrimaryCount={primaryCount}
            label={`${hiddenIds.length} more ${hiddenIds.length === 1 ? 'sticker' : 'stickers'} on the far side`} />
          
          </motion.figure>
        }
      </AnimatePresence>
    </div>);

}

function findSticker(scheme: LetterScheme, token: string | undefined, kind: Kind): string | null {
  if (!token) return null;
  const hit = Object.entries(scheme).find(([id, t]) => t === token && slotType(Number(id.slice(1))) === kind);
  return hit ? hit[0] : null;
}
