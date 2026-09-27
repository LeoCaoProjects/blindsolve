import React, { useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppData, useDefaultView } from '../../contexts/AppDataContext';
import { FRONT_ROT, Rot, bestRotation, oppositeRot } from '../../utils/camera';
import { Face, slotType } from '../../utils/cube';
import { EASE_OUT } from '../../utils/keyboard';
import { SchemeCube } from '../cube/SchemeCube';

interface PairCubeProps {
  tokens: string[];
  type: 'edge' | 'corner' | null;
  size: number;
}

/**
 * Turns the lettered cube the short way to a view that shows both stickers of the pair.
 * When they sit on opposite faces, the main view shows the first and a small far-side view
 * appears for the second — only for that card.
 */
export function PairCube({ tokens, type, size }: PairCubeProps) {
  const { setup } = useAppData();
  const camera = useDefaultView();
  const last = useRef<Rot>(FRONT_ROT);

  const { rot, hidden } = useMemo(() => {
    const faceOf = (token: string): Face | null => {
      const hit = Object.entries(setup.scheme).find(([id, t]) => {
        if (t !== token) return false;
        const kind = slotType(Number(id.slice(1)));
        return type ? kind === type : !!kind;
      });
      return hit ? hit[0][0] as Face : null;
    };
    const faces = tokens.map(faceOf).filter((f): f is Face => !!f);
    if (!faces.length) return { rot: FRONT_ROT, hidden: [] as Face[] };
    return bestRotation(faces, camera, last.current);
  }, [tokens.join('|'), type, setup.scheme, camera.top, camera.front]);
  last.current = rot;

  const farToken = hidden.length ? tokens[1] : null;
  const inset = Math.round(size * 0.42);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <SchemeCube
        scheme={setup.scheme}
        size={size}
        mode="static"
        rotation={rot}
        highlightTokens={tokens}
        highlightType={type}
        label={`Where ${tokens.join('')} sits on the cube`} />
      
      <AnimatePresence>
        {farToken &&
        <motion.figure
          key={tokens.join('|')}
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
            highlightTokens={tokens}
            highlightType={type}
            label={`${farToken} on the far side`} />
          
          </motion.figure>
        }
      </AnimatePresence>
    </div>);

}