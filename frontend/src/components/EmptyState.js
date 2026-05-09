import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Standardised empty state used across the app. Pass an icon, headline,
 * subline and an optional action button. Replaces ad-hoc "No data yet"
 * fragments so the look stays consistent.
 *
 * Usage:
 *   <EmptyState icon={Car} title="No vehicles yet" description="…" action={
 *     <button onClick={...}>Add vehicle</button>
 *   } />
 */
const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
  compact = false,
  testId = 'empty-state',
}) => (
  <div
    className={`text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50 ${
      compact ? 'py-6 px-4' : 'py-10 px-6'
    }`}
    data-testid={testId}
  >
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white border border-slate-200 mb-3 text-slate-400">
      <Icon size={20} />
    </div>
    <p className="font-semibold text-slate-900 mb-1">{title}</p>
    {description && <p className="text-sm text-slate-500 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export default EmptyState;
