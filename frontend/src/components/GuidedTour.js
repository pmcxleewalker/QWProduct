import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  X, ChevronRight, ChevronLeft, Volume2, VolumeX, Loader2, CheckCircle, Hand, Play
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const NEXUS_AVATAR = '/nexus-instructor.jpg';

// Nexus, Quick Wing's built-in instructor, walks the admin through every tab
// AND its sub-tabs, tailored to the plan. Narration is warm and kept to short
// sentences; bodies carry the fuller detail. Actionable steps invite a try.
export const buildTourSteps = (franchiseName, planName, opts = {}) => {
  const { gpsEnabled = false, features = {}, maxUsers = null } = opts;

  const joinList = (arr) => arr.length <= 1 ? (arr[0] || '') :
    `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;

  const seatLine = maxUsers ? ` (up to ${maxUsers} on your plan)` : '';

  const vehicleExtras = [];
  if (features.qr_codes) vehicleExtras.push('print a QR code for each vehicle');
  if (features.block_vehicles) vehicleExtras.push('block a vehicle when it\'s off the road');
  const vehicleExtrasText = vehicleExtras.length ? ` You can also ${joinList(vehicleExtras)}.` : '';
  const vehicleExtrasSpoken = features.qr_codes ? ' You can print QR codes too.' : '';

  const overviewAlerts = ['tax, NCT and insurance expiries', 'overdue vehicle inspections', 'driver\'s licence renewals', 'open incident reports'];
  if (features.mileage_tracking) overviewAlerts.push('mileage-based service reminders');
  const overviewAlertsText = joinList(overviewAlerts);

  const steps = [];

  steps.push({
    id: 'welcome',
    target: 'dashboard-title',
    showAvatar: true,
    title: `Hello, I'm Nexus`,
    body: `I'm your built-in instructor for ${franchiseName || 'your team'}. I'll show you around your dashboard, one easy step at a time. Take as long as you like — and bring me back whenever you need a hand.`,
    narration: `Hello! I'm Nexus, your built-in instructor. I'll show you around. We'll go nice and easy. Ready? Let's begin.`,
  });

  steps.push({
    id: 'overview',
    target: 'tab-overview',
    tab: 'overview',
    title: 'Overview — your home base',
    body: `Start here each day. The Action Required panel gently flags ${overviewAlertsText}, so nothing important slips by.`,
    narration: `This is your Overview. It's your home base. The Action Required panel flags anything that needs your attention.`,
  });

  steps.push({
    id: 'fleet',
    target: 'tab-fleet',
    tab: 'fleet',
    subTab: 'live-fleet',
    title: 'Fleet — your vehicles',
    body: 'The Fleet area holds everything about your vehicles. It has a few sections along the top. Let me walk you through each one.',
    narration: `Now, your Fleet. This is everything about your vehicles. It has a few sections up top. Let's look at each one.`,
  });

  steps.push({
    id: 'fleet-live',
    target: 'subtab-live-fleet',
    tab: 'fleet',
    subTab: 'live-fleet',
    title: 'Live Status',
    body: 'Live Status shows every vehicle\'s current state — free, booked, in use, blocked, or needing attention. It refreshes on its own, so it\'s a lovely first glance each morning.',
    narration: `First, Live Status. It shows each vehicle's state. It updates on its own. A great first glance each morning.`,
    tryPrompt: 'Go on — try searching or filtering the list. I\'ll wait right here.',
  });

  steps.push({
    id: 'fleet-vehicles',
    target: 'subtab-vehicles',
    tab: 'fleet',
    subTab: 'vehicles',
    title: 'Manage Vehicles',
    body: `Add and edit vehicles here, and set their tax, insurance, NCT and service dates so your compliance alerts stay accurate.${vehicleExtrasText}`,
    narration: `Next, Manage Vehicles. Add or edit a vehicle here. Set its tax, insurance and service dates.${vehicleExtrasSpoken}`,
    tryPrompt: 'Try it yourself — open a vehicle and take a look. I\'ll wait.',
  });

  steps.push({
    id: 'fleet-board',
    target: 'subtab-car-calendars',
    tab: 'fleet',
    subTab: 'car-calendars',
    title: 'Fleet Board',
    body: 'The Fleet Board lays every vehicle\'s bookings side by side, like a wall planner, so gaps and clashes are easy to spot.',
    narration: `This is the Fleet Board. It shows every vehicle's bookings side by side. Gaps and clashes are easy to spot.`,
  });

  steps.push({
    id: 'fleet-allcars',
    target: 'subtab-all-cars',
    tab: 'fleet',
    subTab: 'all-cars',
    title: 'All Cars Calendar',
    body: 'The All Cars Calendar brings the whole fleet onto one calendar — perfect for planning a busy week ahead.',
    narration: `And the All Cars Calendar. Your whole fleet, on one calendar. Handy for a busy week.`,
  });

  if (gpsEnabled) {
    steps.push({
      id: 'live-map',
      target: 'live-map-btn',
      title: 'Live GPS Map',
      body: 'Because your plan includes GPS tracking, this button opens a live map showing where every vehicle is right now.',
      narration: `Your plan has G P S tracking. This button opens a live map. It shows where each vehicle is, right now.`,
    });
  }

  steps.push({
    id: 'team',
    target: 'tab-team',
    tab: 'team',
    title: 'Team',
    body: `Invite staff and admins${seatLine}, set their roles, reset passwords, and deactivate anyone who leaves. New members receive a branded welcome email automatically.`,
    narration: `Here's your Team. Invite staff and admins. Set their roles. Reset passwords when needed.`,
    tryPrompt: 'Have a go — open the Add Member form. I\'ll be right here.',
  });

  steps.push({
    id: 'reports',
    target: 'tab-reports',
    tab: 'reports',
    subTab: 'fleet-reports',
    title: 'Reports & Analytics',
    body: 'Reports has a few sections too. Let me show you what each one gives you.',
    narration: `Now, Reports. This area has a few sections too. Let's take them one at a time.`,
  });

  steps.push({
    id: 'reports-fleet',
    target: 'subtab-fleet-reports',
    tab: 'reports',
    subTab: 'fleet-reports',
    title: 'Fleet Reports',
    body: 'Fleet Reports show utilisation, idle days and mileage per vehicle, and you can export them as a polished PDF whenever you need to.',
    narration: `Fleet Reports show utilisation and mileage. You can export a clean P D F anytime.`,
  });

  steps.push({
    id: 'reports-incidents',
    target: 'subtab-incident-reports',
    tab: 'reports',
    subTab: 'incident-reports',
    title: 'Incident Reports',
    body: 'Every damage, accident or near-miss your team logs lands here — each one timestamped and linked to a vehicle and driver.',
    narration: `Incident Reports gather every bump and near-miss. Each one is linked to a vehicle and a driver.`,
  });

  steps.push({
    id: 'reports-documents',
    target: 'subtab-documents',
    tab: 'reports',
    subTab: 'documents',
    title: 'Documents Inbox',
    body: 'Staff submissions arrive here — inspections and any custom forms you create. You can review them, filter, and open the attached photos.',
    narration: `The Documents inbox holds staff submissions. Inspections, and your own custom forms. Review them here.`,
    tryPrompt: 'Try opening a submission to see the detail. I\'ll wait.',
  });

  steps.push({
    id: 'reports-timeline',
    target: 'subtab-daily-timeline',
    tab: 'reports',
    subTab: 'daily-timeline',
    title: 'Daily Timeline',
    body: 'The Daily Timeline plots your fleet\'s activity hour by hour, so your busy and quiet periods are easy to see.',
    narration: `And the Daily Timeline. It shows activity, hour by hour. Your busy and quiet times, at a glance.`,
  });

  steps.push({
    id: 'announcements',
    target: 'tab-announcements',
    tab: 'announcements',
    title: 'Announcements',
    body: 'Broadcast important messages to your whole team. They see them the moment they log in, and you can ask for a read-receipt on critical notices.',
    narration: `Announcements let you message your whole team. They see it the moment they log in.`,
  });

  steps.push({
    id: 'help',
    target: 'help-button',
    showAvatar: true,
    title: 'You\'re all set',
    body: 'That\'s the full walk-through. Bring me back any time from this button. And don\'t worry — running through it a few times is the best way to make it stick.',
    narration: `That's the tour! You did great. Bring me back any time from the Help button. Try things a few times. That's how it sticks. Take care!`,
  });

  return steps;
};

const GuidedTour = ({ isOpen, onClose, steps, onNavigate, muted: mutedProp }) => {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState(null);
  const [muted, setMuted] = useState(!!mutedProp);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [needsPlayTap, setNeedsPlayTap] = useState(false);
  const [paused, setPaused] = useState(false);
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
      setPaused(false);
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

  const pauseAndExplore = () => {
    if (audioRef.current) audioRef.current.pause();
    setPaused(true);
  };

  const resumeTour = () => {
    setPaused(false);
    if (onNavigate) onNavigate(step);
    setTimeout(() => { locateTarget(); playNarration(); }, 400);
  };

  // Paused: hide the overlay so the admin can freely click the screen,
  // leaving only a floating "Resume" pill from Nexus.
  if (paused) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]" data-testid="tour-paused">
        <button
          onClick={resumeTour}
          className="flex items-center gap-3 pl-2 pr-4 py-2 rounded-full shadow-2xl text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', border: '1px solid rgba(216,180,254,0.6)' }}
          data-testid="tour-resume"
          title="Resume the tour with Nexus"
        >
          <img
            src={NEXUS_AVATAR}
            alt="Nexus"
            className="w-9 h-9 rounded-full object-cover"
            style={{ border: '2px solid rgba(216,180,254,0.8)' }}
          />
          <div className="text-left leading-tight">
            <span className="block text-sm font-semibold">Resume tour</span>
            <span className="block text-[11px] text-purple-200">Nexus is waiting · {current + 1}/{steps.length}</span>
          </div>
          <Play size={16} className="ml-1" />
        </button>
      </div>
    );
  }

  // A light dim keeps the app clearly visible; a bright ring + soft glow draws
  // the eye to the element Nexus is describing (no heavy blackout).
  const DIM = 'rgba(17,9,38,0.34)';

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const cardWidth = 400;
  let cardStyle = {};
  if (rect) {
    const below = rect.top + rect.height + 16;
    const placeBelow = below + 300 < vh;
    let left = rect.left + rect.width / 2 - cardWidth / 2;
    left = Math.max(16, Math.min(left, vw - cardWidth - 16));
    cardStyle = placeBelow
      ? { top: `${below}px`, left: `${left}px` }
      : { top: `${Math.max(16, rect.top - 312)}px`, left: `${left}px` };
  } else {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[9999]" data-testid="guided-tour">
      {rect ? (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: `0 0 0 9999px ${DIM}, 0 0 0 3px rgba(216,180,254,1), 0 0 26px 6px rgba(168,85,247,0.65)`,
            border: '2px solid rgba(255,255,255,0.9)',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: DIM }} />
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

          {step.tryPrompt && (
            <div
              className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background: '#f5f3ff', border: '1px solid #e9d5ff' }}
              data-testid="tour-try-prompt"
            >
              <Hand size={15} className="text-purple-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-purple-800 leading-relaxed">{step.tryPrompt}</p>
            </div>
          )}

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

        {/* Pause & explore this screen — inviting */}
        <button
          onClick={pauseAndExplore}
          className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border-t border-gray-100 ${
            step.tryPrompt ? 'text-white' : 'text-purple-700 hover:bg-purple-50'
          }`}
          style={step.tryPrompt ? { background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' } : undefined}
          data-testid="tour-pause-try"
        >
          <Hand size={15} />
          <span>{step.tryPrompt ? 'Let me try this myself' : 'Pause — let me try this myself'}</span>
        </button>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-1 flex-wrap gap-y-1 max-w-[42%]">
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
