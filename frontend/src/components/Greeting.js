import React, { useEffect, useState } from 'react';

/**
 * Time-aware greeting line.
 *
 *   <Greeting user={user} />
 *   -> "Good morning, K"
 *   -> "Good afternoon, K"
 *   -> "Good evening, K"
 *
 * Picks the display name in priority order:
 *   1. `user.display_name`  (admin-configurable nickname — e.g. "K" for Karen)
 *   2. first word of `user.name`
 *   3. literal "there"
 *
 * Ticks every minute so the greeting flips automatically without a refresh
 * (handy if the staff member leaves the dashboard open across noon / 6pm).
 */
const pickWindow = (date) => {
  const h = date.getHours();
  if (h < 5)  return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const displayName = (user) => {
  if (!user) return 'there';
  const explicit = (user.display_name || '').trim();
  if (explicit) return explicit;
  const firstWord = (user.name || '').trim().split(/\s+/)[0];
  return firstWord || 'there';
};

const Greeting = ({ user, className = '', as: As = 'h1', testid = 'greeting' }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <As className={className} data-testid={testid}>
      {pickWindow(now)}, {displayName(user)}
    </As>
  );
};

export default Greeting;
