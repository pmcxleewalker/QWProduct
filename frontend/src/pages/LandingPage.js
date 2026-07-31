import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Play, ArrowRight, Calculator } from 'lucide-react';
import ContactFormModal from '@/components/ContactFormModal';

const LandingPage = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState('pricing');
  const [fleetSize, setFleetSize] = useState(10);
  const [savings, setSavings] = useState(0);

  useEffect(() => {
    // Logic: 5 hours saved per vehicle/month * €25/hr
    setSavings(fleetSize * 5 * 12 * 25);
  }, [fleetSize]);

  const openPricingForm = () => { setContactType('pricing'); setContactOpen(true); };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/">
            <img src="/quick-wing-logo.png" alt="Quick Wing" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-medium hover:text-blue-600 transition-colors">Login</Link>
            <Button onClick={openPricingForm} className="bg-slate-900 text-white rounded-full px-6">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-6 bg-gradient-to-b from-slate-50 to-white">
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
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-10 h-14 rounded-xl shadow-lg shadow-blue-200" onClick={openPricingForm}>
              Start Your Free Trial <ArrowRight className="ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Authority Bar */}
      <div className="py-8 bg-white border-y border-slate-100 flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale">
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">As featured in</span>
        <span className="font-black text-xl tracking-tighter">AI SIX PODCAST</span>
        <span className="font-black text-xl tracking-tighter">BLUEBIRD CARE</span>
      </div>

      {/* App Showcase - The "Important Info" */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need, on one calm screen.</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Focus on your business, not your paperwork. Quick Wing automates the tedious parts of fleet management.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 p-2 rounded-3xl border border-slate-100 shadow-sm">
              <img src="/bookings-screenshot.jpg" alt="Bookings" className="rounded-2xl mb-6 shadow-inner" />
              <div className="px-4 pb-4">
                <h3 className="font-bold text-lg mb-2">Live Bookings</h3>
                <p className="text-slate-600 text-sm">See which vehicles are available and assign drivers in seconds.</p>
              </div>
            </div>
            <div className="bg-slate-50 p-2 rounded-3xl border border-slate-100 shadow-sm">
              <img src="/compliance-screenshot.jpg" alt="Compliance" className="rounded-2xl mb-6 shadow-inner" />
              <div className="px-4 pb-4">
                <h3 className="font-bold text-lg mb-2">Compliance Alerts</h3>
                <p className="text-slate-600 text-sm">Automated reminders for Tax, NCT, and Insurance before they expire.</p>
              </div>
            </div>
            <div className="bg-slate-50 p-2 rounded-3xl border border-slate-100 shadow-sm">
              <img src="/reports-screenshot.jpg" alt="Reports" className="rounded-2xl mb-6 shadow-inner" />
              <div className="px-4 pb-4">
                <h3 className="font-bold text-lg mb-2">Smart Reporting</h3>
                <p className="text-slate-600 text-sm">Instant mileage and usage reports for easy payroll and auditing.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-20 px-6 bg-blue-600 text-white rounded-[3rem] mx-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6 opacity-80 uppercase tracking-widest text-xs font-bold">
            <Calculator size={16} /> ROI Calculator
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-8">How much can you save?</h2>
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
            <label className="block text-xl mb-4 font-medium">My fleet size is: <span className="text-yellow-400 font-bold">{fleetSize} Vehicles</span></label>
            <input
              type="range" min="1" max="100" value={fleetSize}
              onChange={(e) => setFleetSize(Number(e.target.value))}
              className="w-full h-3 bg-blue-400 rounded-lg appearance-none cursor-pointer accent-white mb-10"
            />
            <div className="grid sm:grid-cols-2 gap-8 text-left">
              <div className="bg-white/10 p-6 rounded-2xl">
                <p className="text-blue-100 text-sm uppercase font-bold mb-1">Estimated Annual Savings</p>
                <p className="text-4xl font-black">€{savings.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 p-6 rounded-2xl">
                <p className="text-blue-100 text-sm uppercase font-bold mb-1">Admin Time Saved</p>
                <p className="text-4xl font-black">~{fleetSize * 60} hrs/year</p>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* Success Story & Video */}
      <section className="py-20 px-6 bg-slate-900 text-white mb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-blue-400 font-bold mb-4 uppercase tracking-widest text-xs">Success Story</div>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-8">
              &ldquo;The app has saved us <span className="text-blue-400">70% of our working time.</span>&rdquo;
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xl border border-slate-700 text-white">CO</div>
              <div>
                <p className="font-bold text-lg">Carly O&apos;Donovan</p>
                <p className="text-slate-400">Operations Manager, Bluebird Care</p>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <a href="https://youtu.be/_oR2ROeUOp4" target="_blank" rel="noreferrer" className="group block relative overflow-hidden rounded-3xl shadow-2xl">
              <img src="https://img.youtube.com/vi/_oR2ROeUOp4/maxresdefault.jpg" className="w-full aspect-video object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" alt="Founder Interview" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl">
                  <Play className="fill-current text-white ml-1" size={32} />
                </div>
              </div>
            </a>
            <p className="text-center text-slate-400 font-medium">An interview with our founder on the future of fleet intelligence</p>
          </div>
        </div>
      </section>

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
