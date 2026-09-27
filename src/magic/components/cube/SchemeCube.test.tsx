import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { speffzScheme } from '../../utils/scheme';
import { SchemeCube } from './SchemeCube';

describe('SchemeCube pair highlighting', () => {
  it('keeps only exact target stickers bright and dims centres and unrelated pieces', () => {
    const { container } = render(<SchemeCube scheme={speffzScheme()} size={300} mode="static" highlightIds={['U1', 'F1']} />);
    const stickers = Array.from(container.querySelectorAll<HTMLElement>('[style*="opacity"]'));
    expect(stickers.filter((sticker) => sticker.style.opacity === '1')).toHaveLength(2);
    expect(stickers.filter((sticker) => sticker.style.opacity === '0.2').length).toBeGreaterThan(40);
    expect(screen.getByRole('group', { name: 'Cube' })).toBeTruthy();
  });
});
