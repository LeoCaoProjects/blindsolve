import React from 'react';
import { BldSetup, FaceColor } from '../../types/app';
import { Face } from '../../utils/cube';
import { ALL_STICKERS, stickerById } from '../../utils/scheme';
import { StickerSwatch } from './StickerSwatch';

interface BufferPanelProps {
  type: 'edge' | 'corner';
  setup: BldSetup;
  colors: Record<Face, FaceColor>;
  onSet: (id: string) => void;
}

const COMMON: Record<'edge' | 'corner', string[]> = {
  edge: ['UF', 'DF', 'UR', 'UB'],
  corner: ['UFR', 'UBL', 'UFL', 'DFR']
};

const METHOD_BUFFER = {
  edge: { m2: 'DF', op: 'UL' } as Record<string, string>,
  corner: { op: 'UBL' } as Record<string, string>
};

const METHOD_NAME: Record<string, string> = { m2: 'M2', op: 'OP' };

export function BufferPanel({ type, setup, colors, onSet }: BufferPanelProps) {
  const current = type === 'edge' ? setup.edgeBuffer : setup.cornerBuffer;
  const info = stickerById(current);
  const method = type === 'edge' ? setup.edgeMethod : setup.cornerMethod;
  const suggested = METHOD_BUFFER[type][method];
  const idFor = (piece: string) => ALL_STICKERS.find((s) => s.type === type && s.piece === piece)?.id;
  const suggestedId = type === 'edge' && method === 'm2' ? undefined : suggested ? idFor(suggested) : undefined;
  const suggestedPiece = suggestedId ? stickerById(suggestedId).piece : suggested;

  return (
    <div>
      <p className="text-[12.5px] text-ink-3">Select {type === 'edge' ? 'an edge' : 'a corner'} on the cube</p>
      <div className="mt-5 flex items-center gap-4">
        <StickerSwatch color={colors[info.face]} token={setup.scheme[current]} size={44} ring />
        <div>
          <p className="font-mono text-[26px] leading-none tracking-[0.06em] text-ink">{info.piece}</p>
          <p className="mt-1.5 text-[12px] text-ink-3">{type === 'edge' ? 'Edge' : 'Corner'} buffer</p>
        </div>
      </div>

      {suggestedPiece && info.piece !== suggestedPiece && suggestedId &&
      <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
          {METHOD_NAME[method]} usually uses {suggestedPiece}
          <button type="button" onClick={() => onSet(suggestedId)} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3">
            Use {suggestedPiece}
          </button>
        </p>
      }

      <div className="mt-7">
        <h4 className="text-[12px] text-ink-3">Common</h4>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COMMON[type].map((piece) => {
            const id = idFor(piece);
            const active = info.piece === piece;
            return (
              <button
                key={piece}
                type="button"
                aria-pressed={active}
                onClick={() => id && onSet(id)}
                className={`h-8 min-w-[52px] rounded-[4px] border px-2.5 font-mono text-[12.5px] transition-colors duration-150 ease-out ${
                active ? 'border-line-strong bg-selected text-ink' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'}`
                }>
                
                {piece}
              </button>);

          })}
        </div>
      </div>
    </div>);

}
