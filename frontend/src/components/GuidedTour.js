import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  X, ChevronRight, ChevronLeft, Volume2, VolumeX, Loader2, CheckCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const NEXUS_AVATAR = '/nexus-instructor.jpg';

// Build the tour steps. Nexus, Quick Wing's built-in instructor, walks the
// admin through every tab AND its sub-tabs, tailored to what this tenant's
// plan actually shows. Narration is calm and unhurried.
export const buildTourSteps = (franchiseName, planName, opts = {}) => {
  const { gpsEnabled = false, features = {}, maxUsers = null } = opts;

  const joinList = (arr) => arr.length <= 1 ? (arr[0] || '') :
    `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;

  const seatLine = maxUsers ? ` (up to ${maxUsers} on your plan)` : '';
  const seatSpoken = maxUsers ? `, with room for up to ${maxUsers} people on your plan,` : '';

  // Manage-vehicles extras depend on the plan's toolset.
  const vehicleExtras = [];
  if (features.qr_codes) vehicleExtras.push('print a QR code for each vehicle');
  if (features.block_vehicles) vehicleExtras.push('block a vehicle when it\'s off the road');
  const vehicleExtrasText = vehicleExtras.length ? ` You can also ${joinList(vehicleExtras)}.` : '';

  const overviewAlerts = ['tax, NCT and insurance expiries', 'overdue vehicle inspections', 'driver\'s licence renewals', 'open incident reports'];
  if (features.mileage_tracking) overviewAlerts.push('mileage-based service reminders');
  const overviewAlertsText = joinList(overviewAlerts);

  const steps = [];

  // 1. Welcome — Nexus introduces itself
  steps.push({
    id: 'welcome',
    target: 'dashboard-title',
    showAvatar: true,
    title: `Hello, I'm Nexus`,
    body: `I'm Quick Wing's built-in instructor for ${franchiseName || 'your team'}. I'll walk you through your dashboard, one calm step at a time — take as long as you like, and bring me back whenever you need a refresher.`,
    narration: `Hello, I'm Nexus, Quick Wing's built-in instructor. It's lovely to meet you. I'll walk you through your dashboard, one calm step at a time. There's no rush at all — take as long as you like, and you can bring me back whenever you or your team need a refresher. Let's begin.`,
  });

  // 2. Overview
  steps.push({
    id: 'overview',
    target: 'tab-overview',
    tab: 'overview',
    title: 'Overview — your home base',
    body: `This is where you start each day. The Action Required panel gently flags ${overviewAlertsText}, so nothing important slips by.`,
    narration: `This is your Overview, your home base. It's where I'd suggest starting each day. The Action Required panel gently flags ${overviewAlertsText}. So nothing important slips by.`,
  });

  // 3. Fleet — intro
  steps.push({
    id: 'fleet',
    target: 'tab-fleet',
    tab: 'fleet',
    subTab: 'live-fleet',
    title: 'Fleet — manage your vehicles',
    body: 'The Fleet area is home to everything about your vehicles. It has a few sections along the top — let me take you through each one.',
    narration: 'Now, let\'s look at your Fleet. This is home to everything about your vehicles. It has a few sections along the top, and I\'ll take you through each one gently.',
  });

  // Fleet sub-tabs
  steps.push({
    id: 'fleet-live',
    target: 'subtab-live-fleet',
    tab: 'fleet',
    subTab: 'live-fleet',
    title: 'Live Status',
    body: 'Live Status shows every vehicle\'s current state — free, booked, in use, blocked, or needing attention. It refreshes on its own, so it\'s a lovely first glance each morning.',
    narration: 'First, Live Status. This shows every vehicle\'s current state — free, booked, in use, blocked, or needing attention. It refreshes on its own, so it makes a lovely first glance each morning.',
  });
  steps.push({
    id: 'fleet-vehicles',
    target: 'subtab-vehicles',
    tab: 'fleet',
    subTab: 'vehicles',
    title: 'Manage Vehicles',
    body: `Here you add and edit vehicles, and set their tax, insurance, NCT and service dates so the compliance alerts stay accurate.${vehicleExtrasText}`,
    narration: `Next is Manage Vehicles. Here you add and edit each vehicle, and set its tax, insurance, N C T and service dates, which keeps your compliance alerts accurate.${vehicleExtrasText}`,
  });
  steps.push({
    id: 'fleet-board',
    target: 'subtab-car-calendars',
    tab: 'fleet',
    subTab: 'car-calendars',
    title: 'Fleet Board',
    body: 'The Fleet Board lays every vehicle\'s bookings side by side, like a wall planner, so gaps and clashes are easy to spot.',
    narration: 'The Fleet Board lays every vehicle\'s bookings side by side, rather like a wall planner. It makes gaps and clashes easy to spot at a glance.',
  });
  steps.push({
    id: 'fleet-allcars',
    target: 'subtab-all-cars',
    tab: 'fleet',
    subTab: 'all-cars',
    title: 'All Cars Calendar',
    body: 'The All Cars Calendar brings the whole fleet onto one calendar — perfect for planning a busy week ahead.',
    narration: 'And the All Cars Calendar brings your whole fleet onto a single calendar. It\'s perfect for planning a busy week ahead.',
  });

  // GPS / Live Map — only when tracking is enabled
  if (gpsEnabled) {
    steps.push({
      id: 'live-map',
      target: 'live-map-btn',
      title: 'Live GPS Map',
      body: 'Because your plan includes GPS tracking, this button opens a live map showing where every vehicle is right now.',
      narration: 'Because your plan includes G P S tracking, this Live Map button opens a live map, showing you where every vehicle is, right now.',
    });
  }

  // Team
  steps.push({
    id: 'team',
    target: 'tab-team',
    tab: 'team',
    title: 'Team',
    body: `Invite staff and admins${seatLine}, set their roles, reset passwords, and deactivate anyone who leaves. New members receive a branded welcome email automatically.`,
    narration: `Let\'s move to your Team. Here you invite staff and admins${seatSpoken} set their roles, reset passwords, and manage who has access. New members receive a branded welcome email automatically.`,
  });

  // Reports — intro
  steps.push({
    id: 'reports',
    target: 'tab-reports',
    tab: 'reports',
    subTab: 'fleet-reports',
    title: 'Reports & Analytics',
    body: 'Reports has a few sections too. Let me show you what each one gives you.',
    narration: 'Now for Reports and Analytics. This area also has a few sections, so let me show you what each one gives you.',
  });
  steps.push({
    id: 'reports-fleet',
    target: 'subtab-fleet-reports',
    tab: 'reports',
    subTab: 'fleet-reports',
    title: 'Fleet Reports',
    body: 'Fleet Reports show utilisation, idle days and mileage per vehicle, and you can export them as a polished PDF whenever you need to.',
    narration: 'Fleet Reports show utilisation, idle days and mileage for each vehicle. And you can export them as a polished P D F whenever you need to.',
  });
  steps.push({
    id: 'reports-incidents',
    target: 'subtab-incident-reports',
    tab: 'reports',
    subTab: 'incident-reports',
    title: 'Incident Reports',
    body: 'Every damage, accident or near-miss your team logs lands here — each one timestamped and linked to a vehicle and driver.',
    narration: 'Incident Reports gather every damage, accident or near-miss your team logs. Each one is timestamped, and linked to a vehicle and a driver.',
  });
  steps.push({
    id: 'reports-documents',
    target: 'subtab-documents',
    tab: 'reports',
    subTab: 'documents',
    title: 'Documents Inbox',
    body: 'Staff submissions arrive here — inspections and any custom forms you create. You can review them, filter, and open the attached photos.',
    narration: 'The Documents inbox is where staff submissions arrive — inspections, and any custom forms you create. You can review them, filter them, and open the attached photos.',
  });
  steps.push({
    id: 'reports-timeline',
    target: 'subtab-daily-timeline',
    tab: 'reports',
    subTab: 'daily-timeline',
    title: 'Daily Timeline',
    body: 'The Daily Timeline plots your fleet\'s activity hour by hour, so your busy and quiet periods are easy to see.',
    narration: 'And the Daily Timeline plots your fleet\'s activity, hour by hour. It makes your busy and quiet periods easy to see.',
  });

  // Announcements
  steps.push({
    id: 'announcements',
    target: 'tab-announcements',
    tab: 'announcements',
    title: 'Announcements',
    body: 'Broadcast important messages to your whole team. They see them the moment they log in, and you can ask for a read-receipt on critical notices.',
    narration: 'Announcements let you broadcast important messages to your whole team. They see them the moment they log in, and you can ask for a read receipt on the critical ones.',
  });

  // Help / signoff — Nexus returns
  steps.push({
    id: 'help',
    target: 'help-button',
    showAvatar: true,
    title: 'You\'re all set',
    body: 'That\'s the full walk-through. You can bring me back any time from this button — I\'ll be right here whenever you, or a new team member, need a hand.',
    narration: 'And that\'s the full walk-through. You did wonderfully. You can bring me back any time from this Help button. I\'ll be right here whenever you, or a new team member, need a hand. Take care, and happy driving.',
  });

  return steps;
};

const GuidedTour = ({ isOpen, onClose, steps, onNavigate, muted: mutedProp }) => {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState(null);
  const [muted, setMuted] = useState(!!mutedProp);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [needsPlayTap, setNeedsPlayTap] = useState(false);
  const audioRef = useRef(null);
  const urlCacheRef = useRef({});

  const step = steps && steps[current];

  const logEvent = useCallback((event, extra = {}) => {
    axios.post(`${API}/tour/event`, {
      event,
      total_steps: steps ? steps.length : null,
      ...extra,
    }).catch(() => {});
  }, [steps]);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrent(0);
      logEvent('start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const locateTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-testid="${step.target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [step]);

  const playNarration = useCallback(async () => {
    if (!step || !step.narration || muted) return;
    const audio = audioRef.current;
    if (!audio) return;
    try {
      setNeedsPlayTap(false);
      let url = urlCacheRef.current[step.id];
      if (!url) {
        setLoadingAudio(true);
        const res = await axios.post(`${API}/tour/narration`, { text: step.narration });
        url = `${process.env.REACT_APP_BACKEND_URL}${res.data.url}`;
        urlCacheRef.current[step.id] = url;
        setLoadingAudio(false);
      }
      audio.src = url;
      audio.currentTime = 0;
      await audio.play();
    } catch (err) {
      setLoadingAudio(false);
      if (err && err.name === 'NotAllowedError') setNeedsPlayTap(true);
    }
  }, [step, muted]);

  useEffect(() => {
    if (!isOpen || !step) return;
    if (onNavigate) onNavigate(step);
    if (audioRef.current) audioRef.current.pause();
    const t = setTimeout(() => {
      locateTarget();
      playNarration();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => locateTarget();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [isOpen, locateTarget]);

  if (!isOpen || !step) return null;

  const isLast = current === steps.length - 1;

  const next = () => { if (!isLast) setCurrent(current + 1); else finish(true); };
  const prev = () => { if (current > 0) setCurrent(current - 1); };
  const finish = (completed = false) => {
    if (audioRef.current) audioRef.current.pause();
    logEvent(completed ? 'finish' : 'skip', { step_id: step ? step.id : null, step_index: current });
    onClose && onClose(completed);
  };
  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (nextMuted && audioRef.current) audioRef.current.pause();
    else playNarration();
  };

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const cardWidth = 400;
  let cardStyle = {};
  if (rect) {
    const below = rect.top + rect.height + 16;
    const placeBelow = below + 280 < vh;
    let left = rect.left + rect.width / 2 - cardWidth / 2;
    left = Math.max(16, Math.min(left, vw - cardWidth - 16));
    cardStyle = placeBelow
      ? { top: `${below}px`, left: `${left}px` }
      : { top: `${Math.max(16, rect.top - 292)}px`, left: `${left}px` };
  } else {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[9999]" data-testid="guided-tour">
      {rect ? (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(10,4,25,0.72)',
            border: '2px solid rgba(216,180,254,0.95)',
            outline: '2px solid rgba(168,85,247,0.5)',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(10,4,25,0.72)' }} />
      )}

      <div
        className="absolute w-[400px] max-w-[calc(100vw-32px)] rounded-2xl overflow-hidden shadow-2xl"
        style={{ ...cardStyle, background: '#ffffff', border: '1px solid rgba(216,180,254,0.6)' }}
        data-testid="guided-tour-card"
      >
        {/* Header — Nexus is always present */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)' }}
        >
          <div className="flex items-center space-x-2.5 text-white min-w-0">
            <img
              src={NEXUS_AVATAR}
              alt="Nexus"
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              style={{ border: '2px solid rgba(216,180,254,0.8)' }}
              data-testid="nexus-avatar"
            />
            <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold truncate">Nexus</p>
              <p className="text-[11px] text-purple-200 truncate">Quick Wing Instructor</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white/90"
              data-testid="tour-mute-toggle"
              title={muted ? 'Unmute Nexus' : 'Mute Nexus'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              onClick={() => finish(false)}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white/90"
              data-testid="tour-close"
              title="End tour"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {step.showAvatar && (
            <div className="flex justify-center mb-3">
              <img
                src={NEXUS_AVATAR}
                alt="Nexus, your instructor"
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: '3px solid #ede9fe', boxShadow: '0 4px 14px rgba(124,58,237,0.25)' }}
              />
            </div>
          )}
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight" data-testid="tour-step-title">
              {step.title}
            </h3>
            {loadingAudio
              ? <Loader2 size={16} className="text-purple-500 animate-spin" />
              : (!muted && !needsPlayTap && <Volume2 size={15} className="text-purple-400" />)}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed" data-testid="tour-step-body">
            {step.body}
          </p>

          {needsPlayTap && !muted && (
            <button
              onClick={playNarration}
              className="mt-3 inline-flex items-center space-x-2 text-xs font-semibold text-purple-700 hover:text-purple-900"
              data-testid="tour-play-voice"
            >
              <Volume2 size={14} />
              <span>Play Nexus's voice</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-1 flex-wrap gap-y-1 max-w-[45%]">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? 'w-4 bg-purple-600' : i < current ? 'w-1.5 bg-purple-300' : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-gray-400 mr-1">{current + 1}/{steps.length}</span>
            {current > 0 && (
              <button
                onClick={prev}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
                data-testid="tour-prev"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center space-x-1.5 px-4 py-1.5 text-sm font-semibold text-white rounded-lg"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}
              data-testid="tour-next"
            >
              {isLast ? (
                <>
                  <CheckCircle size={16} />
                  <span>Finish</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
