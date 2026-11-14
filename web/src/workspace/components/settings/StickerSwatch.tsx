import { designRem } from "../../hooks/useDesignPixels";
import React from 'react';
import { FaceColor } from '../../types/app';
import { COLOR_HEX, COLOR_TEXT } from '../../utils/scheme';

interface StickerSwatchProps {
  color: FaceColor;
  token?: string;
  size?: number;
  ring?: boolean;
  className?: string;
}

export function StickerSwatch({ color, token, size = 28, ring, className = '' }: StickerSwatchProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-[3px] font-mono font-medium leading-none ${className}`}
      style={{
        width: designRem(size),
        height: designRem(size),
        background: COLOR_HEX[color],
        color: COLOR_TEXT[color],
        fontSize: designRem(size * (token && token.length > 1 ? 0.34 : 0.44)),
        boxShadow: ring ? 'inset 0 0 0 2px rgba(0,0,0,0.72), 0 0 0 1.5px var(--ink)' : 'inset 0 0 0 1px rgba(0,0,0,0.25)'
      }}>
      
      {token}
    </span>);

}