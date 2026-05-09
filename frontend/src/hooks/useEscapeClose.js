import { useEffect } from 'react';

/**
 * Close-on-Escape hook for any custom modal. Pass the open boolean and a
 * close callback. Native shadcn dialogs already handle this — this is for
 * the rest of our modals.
 *
 * Usage:
 *   useEscapeClose(isOpen, onClose);
 */
export const useEscapeClose = (isOpen, onClose) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);
};

export default useEscapeClose;
