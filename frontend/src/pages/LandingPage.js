import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Car, Calendar, Users, Shield, BarChart3, Clock, 
  CheckCircle, Mail, Instagram, Star,
  ArrowRight, Menu, X, Play, ChevronLeft, ChevronRight
} from 'lucide-react';

const ScreenshotCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const screenshots = [
    { src: 'https://customer-assets.emergentagent.com/job_22fc8b90-f3dc-480b-a483-1b60e58c83e5/artifacts/n105nizt_IMG_5913.jpeg', alt: 'Fleet Reports', label: 'Fleet Reports' },
    { src: 'https://customer-assets.emergentagent.com/job_22fc8b90-f3dc-480b-a483-1b60e58c83e5/artifacts/88y0o78p_IMG_5914.jpeg', alt: 'Car Bookings', label: 'Car Bookings' },
    { src: 'https://customer-assets.emergentagent.com/job_22fc8b90-f3dc-480b-a483-1b60e58c83e5/artifacts/iku1do9b_IMG_5909.jpeg', alt: 'Daily Availability Timeline', label: 'Daily Availability Timeline' }
  ];

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % screenshots.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
  };

  // Auto-advance every 4 seconds
  useEffect(() => {
    const timer = setInterval(nextSlide, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      {/* Fixed height container for consistent layout */}
      <div className="bg-gray-100 rounded-xl p-4 overflow-hidden">
        <div className="relative w-full" style={{ height: '500px' }}>
          <div className="overflow-hidden rounded-lg shadow-lg bg-white h-full">
            <img 
              src={screenshots[currentIndex].src}
              alt={screenshots[currentIndex].alt}
              className="w-full h-full object-contain bg-white"
            />
          </div>
        </div>
        <p className="text-center text-sm text-gray-600 mt-3 font-medium">
          {screenshots[currentIndex].label}
        </p>
      </div>

      {/* Navigation Arrows */}
      <button 
        onClick={prevSlide}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all"
      >
        <ChevronLeft size={20} className="text-gray-700" />
      </button>
      <button 
        onClick={nextSlide}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all"
      >
        <ChevronRight size={20} className="text-gray-700" />
      </button>

      {/* Dots */}
      <div className="flex justify-center space-x-2 mt-4">
        {screenshots.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              index === currentIndex ? 'bg-blue-600 w-6' : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Set document title and meta for SPA
  useEffect(() => {
    document.title = 'Quick Wing | Fleet Management Software for Irish Businesses';
  }, []);

  const plans = [
    {
      name: "Standard",
      price: "179",
      period: "month",
      tagline: "Best for small teams",
      description: "A practical fleet system for smaller organisations",
      features: [
        "Up to 10 vehicles",
        "Up to 15 users",
        "Vehicle booking system",
        "Fleet compliance tracking",
        "Staff calendars",
        "Basic reports",
        "Email support"
      ],
      highlighted: false
    },
    {
      name: "Essential",
      price: "299",
      period: "month",
      tagline: "Best value",
      description: "For growing organisations needing more control",
      features: [
        "Up to 25 vehicles",
        "Up to 35 users",
        "Everything in Standard, plus:",
        "Enhanced reports & analytics",
        "Booking visibility controls",
        "Admin booking control",
        "Compliance oversight",
        "Cost analytics"
      ],
      highlighted: true,
      badge: "Most Popular"
    },
    {
      name: "Professional",
      price: "499",
      period: "month",
      tagline: "Best for multi-site operations",
      description: "For larger organisations requiring scale",
      features: [
        "Up to 50 vehicles",
        "Up to 50 users",
        "Everything in Essential, plus:",
        "Detailed reporting suite",
        "Priority support",
        "Multi-site oversight",
        "Advanced permissions",
        "Custom data exports"
      ],
      highlighted: false
    }
  ];

  const features = [
    { icon: Car, title: "Fleet Management", description: "Track all vehicles in one place" },
    { icon: Calendar, title: "Smart Booking", description: "Prevent double-bookings automatically" },
    { icon: Shield, title: "Compliance Tracking", description: "Never miss a tax, NCT or insurance renewal" },
    { icon: Users, title: "Staff Management", description: "Assign vehicles and track usage" },
    { icon: BarChart3, title: "Reports & Analytics", description: "Insights to optimise your fleet" },
    { icon: Clock, title: "Real-Time Updates", description: "Instant notifications and live data" }
  ];

  return (
    <main className="min-h-screen bg-white" role="main">
      {/* Navigation */}
      <header>
        <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-grey-100" aria-label="Main navigation">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <a href="/" aria-label="Quick Wing Home">
                <img 
                  src="/quick-wing-logo.png" 
                  alt="Quick Wing Fleet Management Software Logo"
                  className="h-8 w-auto"
                  width="120"
                  height="32"
                />
              </a>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-6">
              <a href="#pricing" className="text-grey-600 hover:text-grey-900 text-sm font-medium">Pricing</a>
              <a href="#contact" className="text-grey-600 hover:text-grey-900 text-sm font-medium">Contact</a>
              <a 
                href="mailto:Lee.quickwing@gmail.com?subject=Try Quick Wing"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colours"
              >
                Try it yourself!
              </a>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-3 space-y-2">
              <a href="#pricing" className="block py-2 text-grey-600 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#contact" className="block py-2 text-grey-600 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Contact</a>
              <a 
                href="mailto:Lee.quickwing@gmail.com?subject=Try Quick Wing"
                className="block w-full text-centre px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                Try it yourself!
              </a>
            </div>
          </div>
        )}
      </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-12 sm:pt-24 sm:pb-16 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white" aria-labelledby="hero-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 id="hero-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Fleet Management Software
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400"> for Ireland</span>
          </h1>
          <p className="text-lg text-grey-300 mb-8 max-w-2xl mx-auto">
            The complete fleet management system trusted by Irish businesses. Book vehicles, track compliance, manage your team, and generate reports — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a 
              href="mailto:Lee.quickwing@gmail.com?subject=Quick Wing Demo Request"
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
              aria-label="Request a free demo of Quick Wing"
            >
              <Play className="mr-2" size={18} aria-hidden="true" />
              Request Free Demo
            </a>
            <a 
              href="#pricing"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-grey-50" id="features" aria-labelledby="features-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="features-heading" className="sr-only">Key Features</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-4 bg-white rounded-xl border border-grey-200 text-centre hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <feature.icon className="text-blue-600" size={20} />
                </div>
                <h3 className="text-sm font-semibold text-grey-900">{feature.title}</h3>
                <p className="text-xs text-grey-500 mt-1">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Screenshots - Carousel */}
      <section className="py-12" id="demo" aria-labelledby="demo-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="demo-heading" className="text-2xl font-bold text-center text-grey-900 mb-6">See Quick Wing in Action</h2>
          <ScreenshotCarousel />
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 bg-grey-50" aria-labelledby="pricing-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 id="pricing-heading" className="text-2xl sm:text-3xl font-bold text-grey-900 mb-2">
              Simple, Transparent Pricing
            </h2>
            <p className="text-grey-600">
              No hidden fees. Cancel anytime. All plans include full support.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <div 
                key={index}
                className={`relative rounded-2xl p-6 ${
                  plan.highlighted 
                    ? 'bg-blue-600 text-white shadow-xl scale-105' 
                    : 'bg-white border border-grey-200'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-semibold rounded-full">
                      <Star size={12} className="mr-1" />
                      {plan.badge}
                    </span>
                  </div>
                )}
                
                <div className="text-centre mb-4">
                  <h3 className={`text-lg font-bold ${plan.highlighted ? 'text-white' : 'text-grey-900'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-xs ${plan.highlighted ? 'text-blue-100' : 'text-grey-500'}`}>
                    {plan.tagline}
                  </p>
                </div>
                
                <div className="text-centre mb-4">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-grey-900'}`}>
                    €{plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlighted ? 'text-blue-100' : 'text-grey-500'}`}>
                    /{plan.period}
                  </span>
                </div>
                
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start">
                      <CheckCircle 
                        size={16} 
                        className={`mr-2 flex-shrink-0 mt-0.5 ${
                          plan.highlighted ? 'text-blue-200' : 'text-blue-600'
                        }`} 
                      />
                      <span className={`text-sm ${plan.highlighted ? 'text-white' : 'text-grey-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <a 
                  href={`mailto:Lee.quickwing@gmail.com?subject=Interested in Quick Wing ${plan.name}`}
                  className={`block w-full py-2.5 rounded-lg font-semibold text-centre text-sm transition-all ${
                    plan.highlighted
                      ? 'bg-white text-blue-600 hover:bg-grey-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Get Started
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-12" aria-labelledby="contact-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="contact-heading" className="text-2xl font-bold text-grey-900 mb-2">
            Ready to Get Started?
          </h2>
          <p className="text-grey-600 mb-6">
            Get in touch for a free demo or to ask any questions about fleet management.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a 
              href="mailto:Lee.quickwing@gmail.com?subject=Quick Wing Enquiry"
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
              aria-label="Email us at Lee.quickwing@gmail.com"
            >
              <Mail className="mr-2" size={18} aria-hidden="true" />
              Lee.quickwing@gmail.com
            </a>
            <a 
              href="https://www.instagram.com/quick.wing2025"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all"
              aria-label="Follow us on Instagram @quick.wing2025"
            >
              <Instagram className="mr-2" size={18} aria-hidden="true" />
              @quick.wing2025
            </a>
          </div>
        </div>
      </section>

      {/* Who Uses Quick Wing - Social Proof Section */}
      <section className="py-12 bg-grey-50" aria-labelledby="industries-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="industries-heading" className="text-xl font-bold text-grey-900 mb-6">
            Trusted by Businesses Across Ireland
          </h2>
          <div className="flex flex-wrap justify-center gap-8 text-grey-500 text-sm">
            <span>Care Providers</span>
            <span>Transport Companies</span>
            <span>Delivery Services</span>
            <span>Construction Firms</span>
            <span>Healthcare Organisations</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8" role="contentinfo">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <img 
                src="/quick-wing-logo.png" 
                alt="Quick Wing Fleet Management"
                className="h-8 w-auto mx-auto md:mx-0 mb-2 brightness-0 invert"
                width="120"
                height="32"
              />
              <p className="text-grey-400 text-sm">
                Fleet management software for Irish businesses.
              </p>
            </div>
            
            <nav className="flex items-center space-x-4 text-sm text-grey-400" aria-label="Footer navigation">
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="#pricing" className="hover:text-white transition-colors">
                Pricing
              </a>
              <a href="mailto:Lee.quickwing@gmail.com" className="hover:text-white transition-colors">
                Contact
              </a>
              <a 
                href="https://www.instagram.com/quick.wing2025"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Instagram
              </a>
              <button 
                onClick={() => navigate('/login')}
                className="hover:text-white transition-colors"
              >
                Franchise Login
              </button>
            </nav>
          </div>
          
          <div className="border-t border-grey-800 mt-6 pt-6 text-center">
            <p className="text-grey-500 text-xs">
              © {new Date().getFullYear()} Quick Wing Fleet Management. All rights reserved. | Fleet Management Software Ireland
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;
