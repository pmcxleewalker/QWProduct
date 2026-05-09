import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Promise-based confirm dialog. Replaces native `window.confirm()` with a
 * branded modal anywhere in the app.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete vehicle?',
 *     description: 'This action cannot be undone.',
 *     confirmLabel: 'Delete',
 *     tone: 'danger',
 *   });
 *   if (ok) doDelete();
 */
const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Graceful fallback so the app never crashes if the provider isn't mounted.
    return async (opts) =>
      Promise.resolve(window.confirm(opts?.description || opts?.title || 'Are you sure?'));
  }
  return ctx;
};

const TONE_STYLES = {
  danger: { iconBg: 'bg-rose-100', iconText: 'text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700' },
  warning: { iconBg: 'bg-amber-100', iconText: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' },
  info: { iconBg: 'bg-blue-100', iconText: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' },
};

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setState({
          title: opts?.title || 'Are you sure?',
          description: opts?.description || '',
          confirmLabel: opts?.confirmLabel || 'Confirm',
          cancelLabel: opts?.cancelLabel || 'Cancel',
          tone: opts?.tone || 'info',
          resolve,
        });
      }),
    []
  );

  const finish = useCallback(
    (value) => {
      if (!state) return;
      state.resolve(value);
      setState(null);
      setBusy(false);
    },
    [state]
  );

  // Esc closes; Enter confirms — both feel native to power users.
  React.useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, finish]);

  const tone = state ? TONE_STYLES[state.tone] || TONE_STYLES.info : TONE_STYLES.info;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4"
          onClick={() => finish(false)}
          data-testid="confirm-dialog-backdrop"
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="p-5">
              <div className="flex gap-3 mb-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${tone.iconBg} flex items-center justify-center`}>
                  <AlertTriangle size={18} className={tone.iconText} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 leading-snug">{state.title}</h3>
                  {state.description && (
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{state.description}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 pb-4 flex justify-end gap-2">
              <button
                onClick={() => finish(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                data-testid="confirm-dialog-cancel"
              >
                {state.cancelLabel}
              </button>
              <button
                onClick={() => { setBusy(true); finish(true); }}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg ${tone.btn}`}
                data-testid="confirm-dialog-confirm"
                autoFocus
              >
                {busy && <Loader2 className="animate-spin" size={14} />}
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export default ConfirmProvider;
