import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Truck, Shield, Calendar, Bell, BarChart3,
  ArrowRight, Check, Settings, Car, Clock, Play
} from 'lucide-react';
import ContactFormModal from '@/components/ContactFormModal';

const LandingPage = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState('pricing');
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const openPricingForm = () => {
    setContactType('pricing');
    setContactOpen(true);
  };

  const openContactForm = () => {
    setContactType('general');
    setContactOpen(true);
  };

  const features = [
    { icon: Calendar, label: "Vehicle Bookings", desc: "See availability, assign vehicles instantly" },
    { icon: Bell, label: "Compliance Tracking", desc: "Tax, NCT, insurance alerts before deadlines" },
    { icon: BarChart3, label: "Fleet Reports", desc: "Usage data and exportable records" },
    { icon: Car, label: "Full Fleet Control", desc: "Manage vehicles, staff access, and maintenance" },
  ];

  const slides = [
    { src: "/bookings-screenshot.jpg", label: "Booking Calendar" },
    { src: "/compliance-screenshot.jpg", label: "Compliance Dashboard" },
    { src: "/reports-screenshot.jpg", label: "Fleet Reports" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
                <Truck className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">QuickWing Directors Suite</span>
            </Link>

            <div className="hidden sm:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">How It Works</a>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">
                Login
              </Link>
              <Button
                onClick={openPricingForm}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 h-9 text-sm"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero + Product Section */}
      <section className="pt-16 sm:pt-20 pb-10 sm:pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center lg:min-h-[calc(100vh-180px)]">
            {/* Left - Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium mb-5">
                <Shield className="h-3.5 w-3.5" />
                Fleet Management & Compliance
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-4 sm:mb-5">
                Stay compliant.<br />
                Reduce downtime.<br />
                <span className="text-blue-600">Control your fleet.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 mb-6 sm:mb-8 max-w-md">
                One system for vehicle bookings, compliance tracking, and operational visibility.
                Built for care providers and service teams.
              </p>

              {/* Quick Features */}
              <div id="features" className="grid grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8">
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 sm:gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <f.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-700" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">{f.label}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6 h-11"
                  onClick={openPricingForm}
                >
                  Get QuickWing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium h-11"
                  onClick={openContactForm}
                >
                  Talk to Us
                </Button>
              </div>
            </div>

            {/* Right - Product Screenshot */}
            <div className="relative">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                {/* Browser Chrome */}
                <div className="h-9 bg-slate-100 border-b border-slate-200 flex items-center px-3 gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                  <div className="flex-1 mx-3">
                    <div className="bg-white rounded px-2 py-0.5 text-xs text-slate-400 border border-slate-200 max-w-[200px]">
                      app.quickwing.com
                    </div>
                  </div>
                </div>

                {/* Screenshots */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {slides.map((slide, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        activeSlide === index ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <img
                        src={slide.src}
                        alt={slide.label}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ))}

                  {/* Label */}
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg px-3 py-1.5 shadow-lg border border-slate-200">
                    <p className="text-xs font-semibold text-slate-900">{slides[activeSlide].label}</p>
                  </div>
                </div>
              </div>

              {/* Slide Indicators */}
              <div className="flex justify-center gap-1.5 mt-4">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSlide(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      activeSlide === i ? 'w-6 bg-slate-900' : 'w-1.5 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Authority Bar */}
      <section className="py-8 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 opacity-60">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-slate-400">As seen in</span>
            <div className="flex items-center gap-8 sm:gap-12 flex-wrap justify-center">
               <div className="flex items-center gap-2">
                 <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
                   <Clock className="h-3 w-3" />
                 </div>
                 <span className="text-sm font-bold text-slate-900 tracking-tight">AI SIX PODCAST</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                   <Check className="h-3 w-3" />
                 </div>
                 <span className="text-sm font-bold text-slate-900 tracking-tight uppercase">Bluebird Care</span>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compact Value Props */}
      <section className="py-8 sm:py-10 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-4 sm:gap-8 flex-wrap justify-center md:justify-start">
              {[
                "Built from real operational experience",
                "Irish compliance workflows",
                "Setup in minutes"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-400" />
                  <span className="text-xs sm:text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
            <div className="text-xs sm:text-sm text-slate-400">
              For fleets of 5-50+ vehicles
            </div>
          </div>
        </div>
      </section>

      {/* Success Story / Social Proof */}
      <section className="py-16 sm:py-24 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 md:p-16 relative">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>

            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold mb-6">
                  <BarChart3 className="h-3 w-3" />
                  Real-world Impact
                </div>

                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">
                  &ldquo;The app has saved us <span className="text-blue-400">70% of our working time.</span>&rdquo;
                </h2>

                <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                  One leading Irish care agency recently moved their fleet onto QuickWing.
                  By automating 60% of their vehicle monitoring, they stopped chasing paper
                  and started focusing on operations.
                </p>

                <div className="flex items-center gap-4 border-t border-white/10 pt-8">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-white uppercase">
                    CO
                  </div>
                  <div>
                    <p className="text-white font-semibold">Carly O&apos;Donovan</p>
                    <p className="text-slate-500 text-sm">Operations Manager, Bluebird Care</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <a
                  href="https://youtu.be/_oR2ROeUOp4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative aspect-video bg-slate-800 rounded-2xl border border-white/10 overflow-hidden group shadow-2xl"
                >
                  <img
                    src="https://img.youtube.com/vi/_oR2ROeUOp4/maxresdefault.jpg"
                    alt="AI Six Podcast Interview"
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 group-hover:scale-110 transition-transform">
                      <Play className="h-8 w-8 fill-current" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 text-center">
                    <p className="text-white/80 text-xs font-medium backdrop-blur-sm bg-black/20 py-2 rounded-lg px-2">
                      Lee Walker discusses the future of fleet intelligence on AI Six
                    </p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-12 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-8 sm:mb-10">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              { num: "1", title: "Add your fleet", desc: "Enter vehicles, compliance dates, and create staff accounts" },
              { num: "2", title: "Manage bookings", desc: "Staff book vehicles, admins see availability at a glance" },
              { num: "3", title: "Stay compliant", desc: "Track renewals, get alerts, and keep records in one place" }
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 text-white rounded-full flex items-center justify-center text-lg sm:text-xl font-bold mx-auto mb-3">
                  {step.num}
                </div>
                <h3 className="font-semibold text-slate-900 mb-1 text-sm sm:text-base">{step.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simple CTA */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
            Ready to run your fleet properly?
          </h2>
          <p className="text-slate-600 mb-6">
            Get pricing tailored to your fleet size. Setup and onboarding support included.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8"
              onClick={openPricingForm}
            >
              Get Pricing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-white"
              onClick={openContactForm}
            >
              Contact Us
            </Button>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-8 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-200 rounded flex items-center justify-center text-slate-600">
                <Truck className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-medium text-slate-600">QuickWing Directors Suite</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-500">
              <button onClick={openContactForm} className="hover:text-slate-900">Contact</button>
              <Link to="/login" className="hover:text-slate-900 flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Login
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} QuickWing Directors Suite. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Contact Form Modal */}
      <ContactFormModal
        open={contactOpen}
        onOpenChange={setContactOpen}
        type={contactType}
      />
    </div>
  );
};

export default LandingPage;
