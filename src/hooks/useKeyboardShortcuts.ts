import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/** True when the user is typing into a form control. */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Global replay keyboard shortcuts:
 *  - Space       → play / pause
 *  - Right arrow → step forward one bar
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        useStore.getState().togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        useStore.getState().stepForward();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
