import React, { useMemo } from 'react';
import { AlertTriangle, IdCard, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { computeLicenceStatus } from './DriverLicenceCard';
import useCollapseState from '../hooks/useCollapseState';

/**
 * Admin-only banner shown in the dashboard "Action Required" section.
 * Aggregates driver's licence expiries that are either already past
 * or within the 30-day reminder window.
 *
 * Mirrors the visual language of ComplianceAlerts (red = critical,
 * amber = warning) so admins read both panels the same way.
 */
const StaffLicenceAlerts = ({ teamMembers = [], onManageClick }) => {
  const [expanded, setExpanded] = useCollapseState('qw:panel:licence-reminders', true);
  const { expired, warning, missing } = useMemo(() => {
    const exp = [];
    const warn = [];
    const miss = [];
    for (const m of teamMembers) {
      // Only chase staff and admins who *drive* — skip support / master_admin
      // helper accounts that don't operate vehicles.
      if (m.role !== 'staff' && m.role !== 'admin') continue;
      if (!m.driver_licence_expiry) {
        miss.push({ member: m, status: { state: 'missing', label: 'Not on file' } });
        continue;
      }
      const s = computeLicenceStatus(m.driver_licence_expiry);
      if (s.state === 'expired') exp.push({ member: m, status: s });
      else if (s.state === 'warning') warn.push({ member: m, status: s });
    }
    exp.sort((a, b) => a.status.daysUntil - b.status.daysUntil);
    warn.sort((a, b) => a.status.daysUntil - b.status.daysUntil);
    miss.sort((a, b) => (a.member.name || '').localeCompare(b.member.name || ''));
    return { expired: exp, warning: warn, missing: miss };
  }, [teamMembers]);

  const total = expired.length + warning.length + missing.length;
  if (total === 0) return null;

  const isCritical = expired.length > 0;
  // Headline subtitle — pick the most urgent line
  let subtitle;
  if (expired.length > 0 && warning.length > 0 && missing.length > 0) {
    subtitle = `${expired.length} expired · ${warning.length} due within 30 days · ${missing.length} not on file`;
  } else if (expired.length > 0 && warning.length > 0) {
    subtitle = `${expired.length} expired · ${warning.length} due within 30 days`;
  } else if (expired.length > 0 && missing.length > 0) {
    subtitle = `${expired.length} expired · ${missing.length} not on file`;
  } else if (warning.length > 0 && missing.length > 0) {
    subtitle = `${warning.length} due within 30 days · ${missing.length} not on file`;
  } else if (expired.length > 0) {
    subtitle = `${expired.length} expired`;
  } else if (warning.length > 0) {
    subtitle = `${warning.length} due within 30 days`;
  } else {
    subtitle = `${missing.length} not on file — chase staff to record their licence`;
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isCritical ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      }`}
      data-testid="staff-licence-alerts"
    >
      <div
        className={`p-4 cursor-pointer ${isCritical ? 'bg-red-100' : 'bg-amber-100'}`}
        onClick={() => setExpanded((v) => !v)}
        data-testid="staff-licence-alerts-toggle"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isCritical ? 'bg-red-200' : 'bg-amber-200'
              }`}
            >
              <IdCard className={isCritical ? 'text-red-700' : 'text-amber-700'} size={20} />
            </div>
            <div className="min-w-0">
              <h3
                className={`font-semibold ${
                  isCritical ? 'text-red-800' : 'text-amber-800'
                }`}
              >
                Driver&rsquo;s Licence Reminders
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    isCritical ? 'bg-red-200' : 'bg-amber-200'
                  }`}
                >
                  {total} {total === 1 ? 'staff' : 'staff'}
                </span>
              </h3>
              <p
                className={`text-sm ${
                  isCritical ? 'text-red-700' : 'text-amber-700'
                }`}
              >
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {onManageClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onManageClick(); }}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg ${
                  isCritical
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
                data-testid="staff-licence-manage-btn"
              >
                Manage Team
                <ChevronRight size={14} />
              </button>
            )}
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-2">
        {expired.map(({ member, status }) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 p-3 bg-white border border-red-200 rounded-lg"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {member.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{member.email}</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full flex-shrink-0">
              {status.label}
            </span>
          </div>
        ))}
        {warning.map(({ member, status }) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 p-3 bg-white border border-amber-200 rounded-lg"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {member.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{member.email}</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full flex-shrink-0">
              {status.label}
            </span>
          </div>
        ))}
        {missing.map(({ member, status }) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg"
            data-testid={`licence-missing-${member.id}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <IdCard size={16} className="text-slate-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {member.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{member.email}</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-full flex-shrink-0">
              {status.label}
            </span>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};

export default StaffLicenceAlerts;
