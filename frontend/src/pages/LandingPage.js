import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Play } from 'lucide-react';
import ContactFormModal from '@/components/ContactFormModal';

const LandingPage = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState('pricing');
  const openPricingForm = () => { setContactType('pricing'); setContactOpen(true); };
  const openContactForm = () => { setContactType('general'); setContactOpen(true); };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/">
            <img src="/quick-wing-logo.png" alt="Quick Wing Logo" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-medium hover:text-blue-600 transition-colors">Login</Link>
            <Button onClick={openPricingForm} className="bg-slate-900 text-white rounded-full px-6">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6">
            <Shield size={14} /> Trusted by Irish Care Providers
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Stay compliant. Reduce downtime. <br className="hidden md:block" />
            <span className="text-blue-600">Control your fleet.</span>
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto">
            The simple, all-in-one system for vehicle bookings, compliance tracking, and live visibility. Built for teams that can&apos;t afford downtime.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="bg-slate-900 text-white text-lg px-10 h-14 rounded-xl" onClick={openPricingForm}>Get QuickWing</Button>
            <Button size="lg" variant="outline" className="text-lg px-10 h-14 rounded-xl" onClick={openContactForm}>Talk to Us</Button>
          </div>
        </div>
      </section>

      {/* Authority Bar */}
      <div className="py-8 bg-slate-50 border-y border-slate-100 flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale">
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">As featured in</span>
        <span className="font-black text-xl tracking-tighter">AI SIX PODCAST</span>
        <span className="font-black text-xl tracking-tighter">BLUEBIRD CARE</span>
      </div>

      {/* Founder Message - The Personal Touch */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-100 rounded-3xl -rotate-3 scale-95 opacity-50"></div>
            <img src="/lee-walker.jpg" alt="Lee Walker - Founder" className="relative rounded-2xl shadow-2xl w-full object-cover aspect-square max-w-md mx-auto" />
          </div>
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">A message from our founder</h2>
            <div className="text-lg text-slate-600 space-y-4 leading-relaxed italic">
              <p>&ldquo;I&apos;m proud to announce the launch of Quick Wing, my fleet management software.&rdquo;</p>
              <p>&ldquo;I built Quick Wing to help businesses manage vehicle bookings, track compliance, and gain clear visibility over their fleet in one place.&rdquo;</p>
              <p>&ldquo;Built from real operational experience. Designed for real working teams.&rdquo;</p>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="font-bold text-xl">Lee Walker</p>
              <p className="text-blue-600 font-medium">Founder &amp; CEO, Quick Wing</p>
            </div>
          </div>
        </div>
      </section>

      {/* Success Story & Video */}
      <section className="py-20 px-6 bg-slate-900 text-white rounded-[3rem] mx-4 mb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-blue-400 font-bold mb-4 uppercase tracking-widest text-xs">Success Story</div>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-8">
              &ldquo;The app has saved us <span className="text-blue-400">70% of our working time.</span>&rdquo;
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xl border border-slate-700">CO</div>
              <div>
                <p className="font-bold text-lg text-white">Carly O&apos;Donovan</p>
                <p className="text-slate-400">Operations Manager, Bluebird Care</p>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <a href="https://youtu.be/_oR2ROeUOp4" target="_blank" rel="noreferrer" className="group block relative overflow-hidden rounded-3xl shadow-2xl">
              <img src="https://img.youtube.com/vi/_oR2ROeUOp4/maxresdefault.jpg" className="w-full aspect-video object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" alt="Founder Interview" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl ring-8 ring-white/10">
                  <Play className="fill-current text-white ml-1" size={32} />
                </div>
              </div>
            </a>
            <p className="text-center text-slate-400 font-medium italic">An interview with our founder on the future of fleet intelligence</p>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="pb-12 text-center">
        <img src="/quick-wing-logo.png" alt="Quick Wing Logo" className="h-8 w-auto mx-auto mb-6 opacity-30 grayscale" />
        <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Quick Wing LTD. All rights reserved.</p>
      </footer>

      <ContactFormModal open={contactOpen} onOpenChange={setContactOpen} type={contactType} />
    </div>
  );
};

export default LandingPage;
