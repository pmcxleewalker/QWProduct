import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  X, ChevronRight, ChevronLeft, Volume2, VolumeX, Loader2, Sparkles, CheckCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Build the tour steps. Each step targets a real UI element by data-testid,
// tells the dashboard which tab to open, and carries warm narration text.
// `opts` tailors the tour to what this tenant's UI actually shows
// (e.g. GPS / Live Map only appears on plans that have tracking enabled).
export const buildTourSteps = (franchiseName, planName, opts = {}) => {
  const { gpsEnabled = false, features = {}, maxUsers = null } = opts;

  // Team capacity line reflects the tenant's actual seat limit.
  const seatLine = maxUsers ? ` (up to ${maxUsers} on your plan)` : '';
  const seatSpoken = maxUsers ? `, with room for up to ${maxUsers} people on your plan,` : '';

  // Reports wording adapts to the analytics this plan actually unlocks.
  const reportExtras = [];
  if (features.cost_analytics) reportExtras.push('cost analytics using your own cost-per-kilometre rates');
  if (features.detailed_reports) reportExtras.push('detailed vehicle-level analytics');
  else if (features.enhanced_reports) reportExtras.push('enhanced utilisation insights');
  const extrasText = reportExtras.length
    ? ` Your plan also unlocks ${reportExtras.length === 2 ? `${reportExtras[0]} and ${reportExtras[1]}` : reportExtras[0]}.`
    : '';
  const reportsBody = `Dig into fleet reports, incident reports, submitted documents and a daily timeline, and export polished PDFs whenever you need them.${extrasText}`;
  const reportsNarration = `The Reports tab gives you fleet reports, incident reports, submitted documents and a daily timeline, and you can export polished P D F reports whenever you need them.${extrasText}`;

  const steps = [
  {
    id: 'welcome',
    target: 'dashboard-title',
    title: `Welcome to ${franchiseName || 'Quick Wing'}`,
    body: `You're on the ${planName || 'Standard'} plan. I'll give you a quick guided walk-through of your command centre — it only takes a minute.`,
    narration: `Welcome to ${franchiseName || 'Quick Wing'}! I'm your guide, and I'll show you around your fleet command centre. It only takes a minute, so let's get started.`,
  },
  {
    id: 'overview',
    target: 'tab-overview',
    tab: 'overview',
    title: 'Your Overview',
    body: 'This is your home base. At a glance you\'ll see fleet status, action items like compliance alerts, and anything that needs your attention today.',
    narration: 'This is your Overview tab, your home base. At a glance, you will see your fleet status, compliance alerts, and anything that needs your attention today.',
  },
  {
    id: 'fleet',
    target: 'tab-fleet',
    tab: 'fleet',
    subTab: 'live-fleet',
    title: 'Manage Your Fleet',
    body: 'Add vehicles, track tax, insurance and service dates, print QR codes, and see each vehicle\'s current status at a glance. Compliance alerts appear automatically as renewals fall due.',
    narration: 'Under the Fleet tab, you can add vehicles, track tax, insurance and service dates, print Q R codes, and see each vehicle\'s current status. Compliance alerts appear automatically as renewals fall due.',
  },
  ];

  // GPS / Live Map only exists for tenants who have tracking enabled.
  if (gpsEnabled) {
    steps.push({
      id: 'live-map',
      target: 'live-map-btn',
      title: 'Live GPS Map',
      body: 'Because your plan includes GPS tracking, this button opens a live map showing exactly where every vehicle is right now.',
      narration: 'Because your plan includes G P S tracking, this Live Map button opens a live map showing exactly where every vehicle is right now.',
    });
  }

  steps.push(
  {
    id: 'team',
    target: 'tab-team',
    tab: 'team',
    title: 'Your Team',
    body: `Invite staff and admins${seatLine}, set their roles, reset passwords, and deactivate anyone who leaves. New members get a branded welcome email automatically.`,
    narration: `The Team tab is where you invite staff and admins${seatSpoken} set their roles, reset passwords, and manage who has access. New members get a branded welcome email automatically.`,
  },
  {
    id: 'reports',
    target: 'tab-reports',
    tab: 'reports',
    subTab: 'fleet-reports',
    title: 'Reports & Analytics',
    body: reportsBody,
    narration: reportsNarration,
  },
  {
    id: 'announcements',
    target: 'tab-announcements',
    tab: 'announcements',
    title: 'Announcements',
    body: 'Broadcast important messages to your whole team. They\'ll see them the moment they log in, and you can require a read-receipt for critical notices.',
    narration: 'Use the Announcements tab to broadcast important messages to your whole team. They will see them the moment they log in, and you can require a read receipt for critical notices.',
  },
  {
    id: 'help',
    target: 'help-button',
    title: 'Help Is Always Here',
    body: 'You can replay this guided tour any time from this button. That\'s the whole tour — you\'re ready to run your fleet.',
    narration: 'And finally, you can replay this guided tour any time from the Help button up here. That is the whole tour. You are all set to run your fleet with confidence!',
  },
  );

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

  // Ensure audio element exists
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

  // Reset to first step whenever the tour opens
  useEffect(() => {
    if (isOpen) setCurrent(0);
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
        const res = await axios.post(`${API}/tour/narration`, { text: step.narration, voice: 'coral' });
        url = `${process.env.REACT_APP_BACKEND_URL}${res.data.url}`;
        urlCacheRef.current[step.id] = url;
        setLoadingAudio(false);
      }
      audio.src = url;
      audio.currentTime = 0;
      await audio.play();
    } catch (err) {
      setLoadingAudio(false);
      // Autoplay likely blocked until user interaction
      if (err && err.name === 'NotAllowedError') setNeedsPlayTap(true);
    }
  }, [step, muted]);

  // On step change: navigate the dashboard, then locate target + play voice
  useEffect(() => {
    if (!isOpen || !step) return;
    if (onNavigate) onNavigate(step);
    if (audioRef.current) audioRef.current.pause();
    const t = setTimeout(() => {
      locateTarget();
      playNarration();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isOpen]);

  // Reposition on resize/scroll
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

  const next = () => { if (!isLast) setCurrent(current + 1); else finish(); };
  const prev = () => { if (current > 0) setCurrent(current - 1); };
  const finish = () => {
    if (audioRef.current) audioRef.current.pause();
    onClose && onClose();
  };
  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (nextMuted && audioRef.current) audioRef.current.pause();
    else playNarration();
  };

  // Tooltip position: below the target if room, else above; fallback centered
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const cardWidth = 380;
  let cardStyle = {};
  if (rect) {
    const below = rect.top + rect.height + 16;
    const placeBelow = below + 240 < vh;
    let left = rect.left + rect.width / 2 - cardWidth / 2;
    left = Math.max(16, Math.min(left, vw - cardWidth - 16));
    cardStyle = placeBelow
      ? { top: `${below}px`, left: `${left}px` }
      : { top: `${Math.max(16, rect.top - 236)}px`, left: `${left}px` };
  } else {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[9999]" data-testid="guided-tour">
      {/* Dark overlay with spotlight cut-out */}
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

      {/* Tooltip card */}
      <div
        className="absolute w-[380px] max-w-[calc(100vw-32px)] rounded-2xl overflow-hidden shadow-2xl"
        style={{ ...cardStyle, background: '#ffffff', border: '1px solid rgba(216,180,254,0.6)' }}
        data-testid="guided-tour-card"
      >
        {/* Header */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)' }}
        >
          <div className="flex items-center space-x-2 text-white">
            <Sparkles size={18} className="text-fuchsia-200" />
            <span className="text-sm font-semibold tracking-tight">Guided Tour</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white/90"
              data-testid="tour-mute-toggle"
              title={muted ? 'Unmute voiceover' : 'Mute voiceover'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              onClick={finish}
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
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight" data-testid="tour-step-title">
              {step.title}
            </h3>
            {(loadingAudio || (!muted && !needsPlayTap)) && (
              loadingAudio
                ? <Loader2 size={16} className="text-purple-500 animate-spin" />
                : <Volume2 size={15} className="text-purple-400" />
            )}
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
              <span>Play voiceover</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? 'w-5 bg-purple-600' : i < current ? 'w-1.5 bg-purple-300' : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center space-x-2">
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
