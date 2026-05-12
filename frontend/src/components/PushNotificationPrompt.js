import React, { useEffect, useState } from 'react';
import { Bell, X, Megaphone, Car as CarIcon } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { toast } from 'sonner';

/**
 * First-login prompt asking staff to enable browser push notifications.
 *
 * Logic:
 *  - Only shows once browser supports push AND we have a logged-in user.
 *  - Skipped if the user has already granted (subscribed) or hard-denied.
 *  - Skipped if they previously tapped "Not now" within the last 14 days
 *    (stored under `pushPromptDismissedAt:<user_id>` in localStorage so it
 *    isn't naggy but eventually re-asks if they change their mind).
 *  - Appears 2s after mount so it doesn't fight the post-login spinner.
 *
 * Why a modal rather than auto-firing Notification.requestPermission()?
 * Browsers now block "drive-by" permission prompts that fire without a clear
 * user gesture. Showing context + an explicit Enable button (a) keeps the
 * prompt user-initiated, and (b) explains *why* we want it so they don't
 * reflexively click Block.
 */
const STORAGE_KEY = (userId) => `pushPromptDismissedAt:${userId || 'anon'}`;
const COOLDOWN_DAYS = 14;

const PushNotificationPrompt = ({ user }) => {
  const { isSupported, isSubscribed, permission, subscribe } =
    usePushNotifications(user);
  const [open, setOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!user || !isSupported) return;
    if (isSubscribed) return;          // already on
    if (permission === 'denied') return; // browser locked us out — modal won't help
    // Honour 14-day cooldown after "Not now"
    try {
      const last = window.localStorage.getItem(STORAGE_KEY(user.id));
      if (last) {
        const days = (Date.now() - Number(last)) / 86_400_000;
        if (days < COOLDOWN_DAYS) return;
      }
    } catch {
      // localStorage blocked — fall through and show anyway
    }
    const t = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(t);
  }, [user, isSupported, isSubscribed, permission]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY(user?.id), String(Date.now()));
    } catch { /* ignore quota / privacy mode */ }
    setOpen(false);
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const ok = await subscribe();
      if (ok) {
        toast.success('Notifications enabled');
        // Clear the cooldown — they actively said yes
        try { window.localStorage.removeItem(STORAGE_KEY(user?.id)); } catch { /* ignore */ }
        setOpen(false);
      } else {
        toast.error("Couldn't enable notifications. You can try again from Settings.");
        dismiss();
      }
    } catch (err) {
      toast.error('Notifications failed to enable. Please try again later.');
      dismiss();
    } finally {
      setEnabling(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !enabling) dismiss();
      }}
      data-testid="push-prompt-overlay"
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        data-testid="push-prompt-modal"
      >
        {/* Header — purple AI vibe to match the dashboard */}
        <div
          className="relative px-6 py-7 text-white"
          style={{
            background:
              'linear-gradient(135deg, #4c1d95 0%, #7c3aed 55%, #a855f7 100%)',
          }}
        >
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Close"
            data-testid="push-prompt-close"
          >
            <X size={16} />
          </button>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 0 18px rgba(216,180,254,0.6)',
            }}
          >
            <Bell size={22} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Stay in the loop</h2>
          <p className="text-sm text-purple-100 mt-1">
            Turn on notifications so nothing important slips by.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Megaphone size={18} className="text-purple-700" />
            </div>
            <div className="text-sm">
              <div className="font-semibold text-slate-900">Announcements from admins</div>
              <div className="text-slate-600 text-[13px] leading-snug">
                Hear about rota changes, vehicle updates and important notices the moment they go out.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CarIcon size={18} className="text-emerald-700" />
            </div>
            <div className="text-sm">
              <div className="font-semibold text-slate-900">Lift requests from teammates</div>
              <div className="text-slate-600 text-[13px] leading-snug">
                Help a colleague who needs a ride &mdash; pick up requests without watching the screen.
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            Your browser will ask you to confirm. We&rsquo;ll only notify you about app activity &mdash; never marketing.
          </p>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
          <button
            onClick={dismiss}
            disabled={enabling}
            className="flex-1 px-4 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-sm font-medium"
            data-testid="push-prompt-skip"
          >
            Not now
          </button>
          <button
            onClick={handleEnable}
            disabled={enabling}
            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-semibold inline-flex items-center justify-center gap-2"
            data-testid="push-prompt-enable"
          >
            <Bell size={14} />
            {enabling ? 'Enabling...' : 'Enable notifications'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationPrompt;
