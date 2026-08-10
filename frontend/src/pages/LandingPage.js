import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Shield, Play, ArrowRight, Calculator, Clock, TrendingUp, Wrench, Sparkles,
  MapPin, Activity, BellRing, Route as RouteIcon, Check,
} from 'lucide-react';
import ContactFormModal from '@/components/ContactFormModal';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'roi', label: 'ROI Calculator' },
  { id: 'pricing', label: 'Pricing' },
];

const LandingPage = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState('pricing');

  const openPricingForm = () => { setContactType('pricing'); setContactOpen(true); };
  const goTab = (id) => {
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => goTab('home')} className="flex items-center" data-testid="nav-logo">
            <img src="/quick-wing-logo.png" alt="Quick Wing" className="h-10 w-auto" />
          </button>
          <div className="flex items-center gap-6">
            <Link to="/contact" className="text-sm font-medium hover:text-blue-600 transition-colors" data-testid="nav-contact">Contact</Link>
            <Link to="/login" className="text-sm font-medium hover:text-blue-600 transition-colors" data-testid="nav-login">Login</Link>
            <Button onClick={openPricingForm} className="bg-slate-900 text-white rounded-full px-6" data-testid="nav-get-started">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Tab bar (sticks under nav) */}
      <div className="pt-16">
        <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex justify-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Landing sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => goTab(t.id)}
                  data-testid={`tab-${t.id}`}
                  className={`relative px-4 sm:px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors ${
                    activeTab === t.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                  {activeTab === t.id && (
                    <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab panels */}
      {activeTab === 'home' && <HomeTab openPricingForm={openPricingForm} goTab={goTab} />}
      {activeTab === 'features' && <FeaturesTab openPricingForm={openPricingForm} />}
      {activeTab === 'roi' && <RoiTab openPricingForm={openPricingForm} />}
      {activeTab === 'pricing' && <PricingTab openPricingForm={openPricingForm} />}

      {/* Simple Footer */}
      <footer className="py-12 border-t border-slate-100 text-center">
        <img src="/quick-wing-logo.png" alt="Quick Wing" className="h-8 w-auto mx-auto mb-4 opacity-30 grayscale" />
        <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Quick Wing LTD.</p>
      </footer>

      <ContactFormModal open={contactOpen} onOpenChange={setContactOpen} type={contactType} />
    </div>
  );
};

export default LandingPage;

// ---------- HOME TAB ----------

const HomeTab = ({ openPricingForm, goTab }) => (
  <>
    {/* Hero */}
    <section className="pt-16 pb-12 px-6 bg-gradient-to-b from-slate-50 to-white" data-testid="home-hero">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6">
          <Shield size={14} /> Trusted by Irish Care Providers
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
          Stay compliant. Reduce downtime. <br />
          <span className="text-blue-600">Control your fleet.</span>
        </h1>
        <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          The simple, all-in-one system for vehicle bookings, compliance tracking, and live visibility. Built for teams that can&apos;t afford downtime.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-10 h-14 rounded-xl shadow-lg shadow-blue-200" onClick={openPricingForm} data-testid="home-cta-trial">
            Get Started <ArrowRight className="ml-2" />
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-10 h-14 rounded-xl" onClick={() => goTab('features')} data-testid="home-cta-features">
            See features
          </Button>
        </div>
      </div>
    </section>

    {/* Authority Bar */}
    <div className="py-10 bg-white border-y border-slate-100">
      <div className="max-w-4xl mx-auto px-6">
        <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">As featured in</p>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
          <a
            href="https://youtu.be/_oR2ROeUOp4"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity group"
            data-testid="ai-six-podcast-link"
            aria-label="Watch our founder on AI Six Podcast"
          >
            <img
              src="https://customer-assets-rejwkqb3.emergentagent.net/job_22fc8b90-f3dc-480b-a483-1b60e58c83e5/artifacts/bvfhwrto_IMG_7448.jpeg"
              alt="AI Six Podcast"
              className="h-12 w-12 rounded-xl object-cover shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-300 transition"
              data-testid="ai-six-podcast-logo"
            />
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none">As featured on</p>
              <p className="text-base font-black tracking-tight text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">AI Six Podcast</p>
            </div>
          </a>

          <span className="hidden sm:inline-block w-px h-10 bg-slate-200" aria-hidden="true"></span>

          <div className="flex items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 50 63" className="h-10 w-auto" aria-label="Bluebird Care logo" role="img">
              <path fill="#0F73DB" d="M44.0458207,0 C47.3320227,0 50,2.66697983 50,5.95195322 L50,57.0474713 C50,60.3327603 47.3317658,63 44.045245,63 L5.95495309,63 C2.66832396,63 0,60.3326737 0,57.0472733 L0,5.95272667 C0,2.66732633 2.66832396,0 5.95495309,0 L44.0458207,0 Z M15.0297478,8.21382415 L7.64431603,8.21382415 L7.64431603,44.8958811 C10.9958589,43.9238264 13.7860624,41.6353147 15.4214616,38.6280969 C15.7375825,38.070037 17.7093036,33.5983321 18.8725353,30.8676636 C19.8844577,28.2777813 22.4031991,26.4422706 25.3525764,26.4422706 C27.7942131,26.4422706 29.9402283,27.7007528 31.1812334,29.6032506 L34.8391372,29.6032506 L30.5319632,32.0636261 C32.7629351,33.7357097 34.206654,36.4004558 34.206654,39.4023028 C34.206654,44.4651153 30.1009403,48.569294 25.0363271,48.569294 C22.9332731,48.569294 20.9968765,47.8599713 19.4497858,46.6697539 L19.4497858,46.6833636 C18.0665765,45.4955439 16.269122,44.7760674 14.3024227,44.7760674 C11.5054133,44.7760674 9.0495832,46.2294035 7.64431603,48.4205284 L7.64431603,54.0476415 L14.5989169,54.0476415 L14.5989169,50.1102343 C16.9991336,53.1247535 20.9995598,54.7858974 25.5538449,54.7858974 C35.03178,54.7858974 42.3556499,47.2802481 42.3556499,37.4982551 C42.3556499,27.6547263 34.9702181,20.1490801 25.6154036,20.1490801 C21.1226836,20.1490801 17.3684027,21.7485954 15.0297478,24.5171386 L15.0297478,8.21382415 Z" />
            </svg>
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none">Client</p>
              <p className="text-base font-black tracking-tight text-slate-900 leading-tight">Bluebird Care</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Founder Message */}
    <section className="py-24 px-6 bg-white">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="relative">
          <img src="/lee-walker.jpg" alt="Lee Walker" className="relative rounded-2xl shadow-2xl w-full object-cover aspect-square max-w-md mx-auto" />
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-bold italic">&ldquo;Built from real experience.&rdquo;</h2>
          <div className="text-lg text-slate-600 space-y-4 leading-relaxed">
            <p>&ldquo;I&apos;m proud to announce the launch of Quick Wing. I built this to help businesses manage vehicle bookings, track compliance, and gain clear visibility in one place.&rdquo;</p>
            <p>&ldquo;Designed for real working teams who don&apos;t have time for complicated software.&rdquo;</p>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <p className="font-bold text-xl">Lee Walker</p>
            <p className="text-blue-600 font-medium">Founder &amp; CEO, Quick Wing</p>
          </div>
        </div>
      </div>
    </section>

    {/* Success Story */}
    <section className="py-20 px-6 bg-slate-900 text-white">
      <div className="max-w-4xl mx-auto text-center">
        <div className="text-blue-400 font-bold mb-6 uppercase tracking-widest text-xs">Success Story</div>
        <blockquote className="text-2xl md:text-4xl font-semibold leading-tight md:leading-tight mb-10 text-white">
          <span className="text-blue-400 text-5xl leading-none align-top mr-1">&ldquo;</span>
          Quick Wing has completely changed how we run our fleet. Compliance is under control, downtime is down,
          and my team finally have visibility of every vehicle without chasing spreadsheets. It&apos;s the kind of
          tool you didn&apos;t know you needed until you can&apos;t imagine working without it.
          <span className="text-blue-400 text-5xl leading-none align-top ml-1">&rdquo;</span>
        </blockquote>
        <div className="inline-flex items-center gap-5 pt-6 border-t border-white/10">
          <svg viewBox="0 0 50 63" className="h-14 w-auto shrink-0" aria-label="Bluebird Care logo" role="img">
            <path fill="#0F73DB" d="M44.0458207,0 C47.3320227,0 50,2.66697983 50,5.95195322 L50,57.0474713 C50,60.3327603 47.3317658,63 44.045245,63 L5.95495309,63 C2.66832396,63 0,60.3326737 0,57.0472733 L0,5.95272667 C0,2.66732633 2.66832396,0 5.95495309,0 L44.0458207,0 Z M15.0297478,8.21382415 L7.64431603,8.21382415 L7.64431603,44.8958811 C10.9958589,43.9238264 13.7860624,41.6353147 15.4214616,38.6280969 C15.7375825,38.070037 17.7093036,33.5983321 18.8725353,30.8676636 C19.8844577,28.2777813 22.4031991,26.4422706 25.3525764,26.4422706 C27.7942131,26.4422706 29.9402283,27.7007528 31.1812334,29.6032506 L34.8391372,29.6032506 L30.5319632,32.0636261 C32.7629351,33.7357097 34.206654,36.4004558 34.206654,39.4023028 C34.206654,44.4651153 30.1009403,48.569294 25.0363271,48.569294 C22.9332731,48.569294 20.9968765,47.8599713 19.4497858,46.6697539 L19.4497858,46.6833636 C18.0665765,45.4955439 16.269122,44.7760674 14.3024227,44.7760674 C11.5054133,44.7760674 9.0495832,46.2294035 7.64431603,48.4205284 L7.64431603,54.0476415 L14.5989169,54.0476415 L14.5989169,50.1102343 C16.9991336,53.1247535 20.9995598,54.7858974 25.5538449,54.7858974 C35.03178,54.7858974 42.3556499,47.2802481 42.3556499,37.4982551 C42.3556499,27.6547263 34.9702181,20.1490801 25.6154036,20.1490801 C21.1226836,20.1490801 17.3684027,21.7485954 15.0297478,24.5171386 L15.0297478,8.21382415 Z" />
          </svg>
          <div className="text-left">
            <p className="font-bold text-lg text-white">Director</p>
            <p className="text-slate-400 text-sm">Bluebird Care · Kerry &amp; West Cork</p>
          </div>
        </div>
        <div className="mt-10">
          <a href="https://youtu.be/_oR2ROeUOp4" target="_blank" rel="noreferrer" className="group inline-flex items-center gap-3 text-sm text-blue-300 hover:text-white transition-colors">
            <span className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="fill-current text-white ml-0.5" size={14} />
            </span>
            Watch our founder discuss fleet intelligence on AI Six Podcast
          </a>
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section className="py-20 px-6 bg-white">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to control your fleet?</h2>
        <p className="text-slate-500 mb-8">Set up in a single afternoon. Talk to us to get started.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-10 h-14 rounded-xl shadow-lg shadow-blue-200" onClick={openPricingForm} data-testid="home-cta-final">
            Get Started <ArrowRight className="ml-2" />
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-10 h-14 rounded-xl" onClick={() => goTab('pricing')} data-testid="home-cta-pricing">
            See pricing
          </Button>
        </div>
      </div>
    </section>
  </>
);

// ---------- FEATURES TAB ----------

const FeatureCard = ({ img, title, body, tier }) => (
  <div className="bg-slate-50 p-2 rounded-3xl border border-slate-100 shadow-sm relative">
    {tier === 'plus' && (
      <span className="absolute top-4 right-4 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 text-[10px] font-black uppercase tracking-widest shadow">
        Plus
      </span>
    )}
    {img && <img src={img} alt={title} className="rounded-2xl mb-6 shadow-inner" />}
    <div className="px-4 pb-4">
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-600 text-sm">{body}</p>
    </div>
  </div>
);

const IconFeatureCard = ({ Icon, title, body, tier }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative">
    {tier === 'plus' && (
      <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 text-[10px] font-black uppercase tracking-widest shadow">
        Plus
      </span>
    )}
    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
      <Icon size={22} />
    </div>
    <h3 className="font-bold text-lg mb-2">{title}</h3>
    <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
  </div>
);

const FeaturesTab = ({ openPricingForm }) => (
  <section className="py-20 px-6" data-testid="features-tab">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <p className="text-blue-600 font-bold uppercase tracking-widest text-xs mb-3">Everything on one calm screen</p>
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Features that pay for themselves.</h2>
        <p className="text-slate-500 max-w-2xl mx-auto">Focus on your business, not your paperwork. Quick Wing automates the tedious parts of fleet management.</p>
      </div>

      <h3 className="text-xs font-black uppercase tracking-[0.25em] text-slate-400 mb-5">Included in every plan</h3>
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <FeatureCard img="/bookings-screenshot.jpg" title="Live Bookings" body="See which vehicles are available and assign drivers in seconds." />
        <FeatureCard img="/compliance-screenshot.jpg" title="Compliance Alerts" body="Automated reminders for Tax, NCT, and Insurance before they expire." />
        <FeatureCard img="/reports-screenshot.jpg" title="Smart Reporting" body="Instant mileage and usage reports for easy payroll and auditing." />
      </div>

      <div className="flex items-center gap-4 mb-5">
        <img src="/quick-wing-logo.png" alt="Quick Wing" className="h-9 w-auto" />
        <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent" data-testid="features-plus-wordmark">
          PLUS
        </span>
        <span className="text-xs font-black uppercase tracking-[0.25em] text-amber-600">Only on Plus</span>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <IconFeatureCard Icon={MapPin} tier="plus" title="Live GPS Tracking" body="See every vehicle on a live map. Speed, ignition, satellites — all live." />
        <IconFeatureCard Icon={RouteIcon} tier="plus" title="Journey Playback" body="Replay any trip from any day. Speed and route timeline for audits and staff coaching." />
        <IconFeatureCard Icon={Activity} tier="plus" title="Driver Behaviour" body="Log harsh braking, rapid acceleration and speeding events, linked to the driver on shift." />
        <IconFeatureCard Icon={BellRing} tier="plus" title="Smart Alerts" body="Speeding, tracker unplug, offline vehicles and geofence breaches — instantly to your inbox." />
      </div>

      <div className="text-center mt-16">
        <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-10 h-14 rounded-xl shadow-lg shadow-blue-200" onClick={openPricingForm} data-testid="features-cta">
          Get Started <ArrowRight className="ml-2" />
        </Button>
      </div>
    </div>
  </section>
);

// ---------- ROI TAB ----------

const RoiTab = ({ openPricingForm }) => {
  const [fleetSize, setFleetSize] = useState(15);
  const [hoursPerVehicle, setHoursPerVehicle] = useState(5);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [downtimeDaysAvoided, setDowntimeDaysAvoided] = useState(2);
  const [downtimeCost, setDowntimeCost] = useState(150);

  const [adminSavings, setAdminSavings] = useState(0);
  const [downtimeSavings, setDowntimeSavings] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);
  const [hoursSavedYearly, setHoursSavedYearly] = useState(0);

  useEffect(() => {
    const admin = fleetSize * hoursPerVehicle * 12 * hourlyRate;
    const downtime = fleetSize * downtimeDaysAvoided * downtimeCost;
    const hours = fleetSize * hoursPerVehicle * 12;
    setAdminSavings(admin);
    setDowntimeSavings(downtime);
    setTotalSavings(admin + downtime);
    setHoursSavedYearly(hours);
  }, [fleetSize, hoursPerVehicle, hourlyRate, downtimeDaysAvoided, downtimeCost]);

  return (
    <section className="py-16 px-4 sm:px-6" data-testid="roi-tab">
      <div className="max-w-5xl mx-auto bg-blue-600 text-white rounded-[3rem] p-6 md:p-12 shadow-2xl shadow-blue-200">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4 opacity-80 uppercase tracking-widest text-xs font-bold">
            <Calculator size={16} /> ROI Calculator
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-3">See what Quick Wing gives back.</h2>
          <p className="text-blue-100 max-w-xl mx-auto">Drag the sliders — the numbers below update live. Based on typical Irish care-fleet workflows.</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-6 md:p-10 rounded-3xl border border-white/20">
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <RoiSlider icon={<TrendingUp size={16} />} label="Fleet size" value={fleetSize} onChange={setFleetSize} min={1} max={100} step={1} display={`${fleetSize} vehicles`} testid="roi-fleet-size" />
            <RoiSlider icon={<Clock size={16} />} label="Admin hours saved per vehicle / month" value={hoursPerVehicle} onChange={setHoursPerVehicle} min={1} max={15} step={1} display={`${hoursPerVehicle} hrs`} testid="roi-hours-per-vehicle" />
            <RoiSlider icon={<Sparkles size={16} />} label="Admin hourly rate" value={hourlyRate} onChange={setHourlyRate} min={15} max={60} step={1} display={`€${hourlyRate} / hr`} testid="roi-hourly-rate" />
            <RoiSlider icon={<Wrench size={16} />} label="Downtime days avoided per vehicle / year" value={downtimeDaysAvoided} onChange={setDowntimeDaysAvoided} min={0} max={10} step={1} display={`${downtimeDaysAvoided} day${downtimeDaysAvoided === 1 ? '' : 's'}`} testid="roi-downtime-days" />
            <RoiSlider icon={<Wrench size={16} />} label="Cost of a day off the road (€)" value={downtimeCost} onChange={setDowntimeCost} min={50} max={500} step={10} display={`€${downtimeCost}`} testid="roi-downtime-cost" />
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <RoiOutput label="Admin savings / year" value={`€${adminSavings.toLocaleString()}`} testid="roi-admin-savings" />
            <RoiOutput label="Downtime avoided / year" value={`€${downtimeSavings.toLocaleString()}`} testid="roi-downtime-savings" />
            <RoiOutput label="Hours back to your team" value={`${hoursSavedYearly.toLocaleString()} hrs`} testid="roi-hours-saved" />
          </div>

          <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 rounded-2xl p-6 md:p-8 text-center shadow-xl">
            <p className="text-xs md:text-sm font-bold uppercase tracking-widest text-amber-900 mb-2">Estimated total annual value</p>
            <p className="text-4xl md:text-6xl font-black tabular-nums" data-testid="roi-total">€{totalSavings.toLocaleString()}</p>
            <p className="text-xs md:text-sm text-amber-900/80 mt-3">per year for a fleet of {fleetSize} · updates as you tweak the sliders</p>
          </div>

          <div className="mt-8 text-center">
            <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-base px-8 h-12 rounded-xl shadow-lg" onClick={openPricingForm} data-testid="roi-cta">
              Get pricing for my fleet <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-blue-100 text-xs mt-3">Sanity-check: assumes 12 admin months, per-day downtime cost is the loss when a car is off the road (lost visits + cover).</p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------- PRICING TAB ----------

const STANDARD_FEATURES = [
  'Vehicle bookings & fleet board',
  'Compliance tracking (Tax, NCT, Insurance)',
  'Driver check-ins & photos',
  'Smart reporting & mileage exports',
  'Unlimited staff seats',
  'Email support',
];

const PLUS_FEATURES = [
  'Everything in Standard',
  'Live GPS tracking',
  'Journey playback with speed timeline',
  'Driver behaviour events (harsh brake, speeding)',
  'Smart alerts (speeding, unplug, offline, geofence)',
  'Priority support',
];

const PricingTab = ({ openPricingForm }) => (
  <section className="py-20 px-6" data-testid="pricing-tab">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-blue-600 font-bold uppercase tracking-widest text-xs mb-3">Simple, per-vehicle pricing</p>
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Pick the plan that fits your fleet.</h2>
        <p className="text-slate-500 max-w-2xl mx-auto">No lock-ins. No setup fees. Cancel anytime.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
        {/* Standard */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col" data-testid="pricing-standard-card">
          <div className="flex items-center gap-3 mb-6">
            <img src="/quick-wing-logo.png" alt="Quick Wing Standard" className="h-9 w-auto" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Standard</p>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-slate-400 text-lg">from</span>
            <span className="text-5xl font-black tracking-tight" data-testid="pricing-standard-price">€6.50</span>
          </div>
          <p className="text-slate-500 text-sm mb-8">per car / month</p>

          <ul className="space-y-3 mb-8">
            {STANDARD_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Button size="lg" className="mt-auto bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl" onClick={openPricingForm} data-testid="pricing-standard-cta">
            Start with Standard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Plus */}
        <div className="relative rounded-3xl p-[2px] bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-xl shadow-amber-100" data-testid="pricing-plus-card">
          <div className="bg-slate-900 text-white rounded-[calc(1.5rem-2px)] p-8 h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <img src="/quick-wing-logo.png" alt="Quick Wing" className="h-10 w-auto bg-white/95 rounded-lg px-2 py-1 shadow" data-testid="pricing-plus-logo" />
                <span className="text-3xl font-black tracking-tight bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow" data-testid="pricing-plus-wordmark">
                  PLUS
                </span>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 text-[10px] font-black uppercase tracking-widest shadow">
                Recommended
              </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300 mb-2">Plus · GPS &amp; behaviour</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-slate-400 text-lg">from</span>
              <span className="text-5xl font-black tracking-tight text-white" data-testid="pricing-plus-price">€8.50</span>
            </div>
            <p className="text-slate-400 text-sm mb-8">per car / month</p>

            <ul className="space-y-3 mb-8">
              {PLUS_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-200">
                  <Check size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button size="lg" className="mt-auto bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-900 font-bold h-12 rounded-xl shadow-lg" onClick={openPricingForm} data-testid="pricing-plus-cta">
              Get Quick Wing Plus <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <p className="text-center text-slate-400 text-xs mt-10">
        Prices exclude VAT. GPS hardware sold separately for Plus plans.
      </p>
    </div>
  </section>
);

// ---------- ROI sub-components ----------

const RoiSlider = ({ icon, label, value, onChange, min, max, step, display, testid }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="bg-white/5 hover:bg-white/10 transition-colors rounded-2xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2 gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-100">{icon} {label}</span>
        <span className="text-yellow-400 font-black text-lg tabular-nums shrink-0" data-testid={`${testid}-value`}>{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${pct}%, rgba(255,255,255,0.25) ${pct}%, rgba(255,255,255,0.25) 100%)` }}
        data-testid={testid}
      />
    </div>
  );
};

const RoiOutput = ({ label, value, testid }) => (
  <div className="bg-white/10 border border-white/15 p-5 rounded-2xl">
    <p className="text-blue-100 text-[11px] uppercase font-bold tracking-wider mb-1">{label}</p>
    <p className="text-2xl md:text-3xl font-black tabular-nums" data-testid={testid}>{value}</p>
  </div>
);
