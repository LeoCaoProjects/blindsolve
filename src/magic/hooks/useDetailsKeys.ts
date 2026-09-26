import { useEffect } from 'react';
import { Penalty } from '../types/solve';
import { isTypingTarget } from '../utils/keyboard';

export function useDetailsKeys(onClose: () => void, onPenalty: (p: Penalty) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      if (e.key === '1') onPenalty('ok');
      if (e.key === '2') onPenalty('+2');
      if (e.key === '3') onPenalty('dnf');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPenalty]);
}