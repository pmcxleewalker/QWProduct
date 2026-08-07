import { useEffect, useState } from 'react';

/**
 * useCollapseState — persists a boolean expand/collapse flag in
 * localStorage keyed by `storageKey`, so panels remember their state
 * between reloads on the same browser.
 *
 * Falls back to `defaultOpen` when nothing is stored yet or when
 * localStorage isn't accessible (SSR, private mode, etc.).
 */
export default function useCollapseState(storageKey, defaultOpen = true) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === '0') return false;
      if (raw === '1') return true;
    } catch {
      /* localStorage unavailable */
    }
    return defaultOpen;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open, storageKey]);

  return [open, setOpen];
}
