import React, { useEffect, useState } from 'react';

/**
 * Time-aware greeting line.
 *
 *   <Greeting user={user} />
 *   -> "Good morning, K"
 *     "Wishing you a smooth shift."
 *
 * Picks the display name in priority order:
 *   1. `user.display_name`  (admin-configurable nickname — "K" for Karen)
 *   2. first word of `user.name`
 *   3. literal "there"
 *
 * The optional subtitle is rotated DETERMINISTICALLY per (date + user) so the
 * same person sees the same line all day — feels personal, not random — and
 * it refreshes the next morning.  Tones are warm but classy; safe for a care
 * company context (no slang, no "ready to roll" energy).
 *
 * Ticks every minute so the greeting flips automatically across noon / 6pm /
 * 10pm without a refresh.
 */
const pickWindow = (date) => {
  const h = date.getHours();
  if (h >= 22 || h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

const HEADLINES = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good evening',
};

const SUBTITLES = {
  morning: [
    'Hope you\u2019ve a great day ahead.',
    'Wishing you a smooth shift.',
    'Coffee on, road clear.',
    'Here\u2019s to a steady one.',
  ],
  afternoon: [
    'Hope it\u2019s going well so far.',
    'Halfway through \u2014 keep it steady.',
    'Everything ticking along nicely?',
    'Good to have you back.',
  ],
  evening: [
    'Hope the day went smoothly.',
    'Almost time to wind down.',
    'End-of-shift check-in.',
    'Quiet roads ahead.',
  ],
  night: [
    'Working late tonight.',
    'Take it easy out there.',
    'Hope the shift\u2019s a quiet one.',
  ],
};

export const displayName = (user) => {
  if (!user) return 'there';
  const explicit = (user.display_name || '').trim();
  if (explicit) return explicit;
  const firstWord = (user.name || '').trim().split(/\s+/)[0];
  return firstWord || 'there';
};

// Tiny stable string hash so the rotation is deterministic per (day, user).
// Not cryptographic — just enough to pick an index.
const stringHash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

const pickSubtitle = (window, user, date) => {
  const lines = SUBTITLES[window];
  if (!lines || lines.length === 0) return '';
  const userKey = user?.id || user?.email || user?.name || 'guest';
  const dayKey = date.toISOString().slice(0, 10);
  return lines[stringHash(`${userKey}:${dayKey}:${window}`) % lines.length];
};

const Greeting = ({
  user,
  className = '',
  subtitleClassName = '',
  as: As = 'h1',
  showSubtitle = true,
  testid = 'greeting',
}) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const window = pickWindow(now);
  const headline = `${HEADLINES[window]}, ${displayName(user)}`;
  const subtitle = showSubtitle ? pickSubtitle(window, user, now) : '';

  return (
    <>
      <As className={className} data-testid={testid}>
        {headline}
      </As>
      {subtitle && (
        <span
          className={subtitleClassName}
          data-testid={`${testid}-subtitle`}
        >
          {subtitle}
        </span>
      )}
    </>
  );
};

export default Greeting;
