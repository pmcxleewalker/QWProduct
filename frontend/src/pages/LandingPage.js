import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Car, Calendar, Users, Shield, BarChart3, Clock, 
  CheckCircle, Mail, Instagram, ChevronRight, Star,
  Zap, Building2, ArrowRight, Menu, X
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const plans = [
    {
      name: "Standard",
      price: "179",
      period: "month",
      tagline: "Best for small teams",
      description: "A practical fleet system for smaller franchises",
      features: [
        "Up to 15 vehicles",
        "Up to 25 users",
        "Vehicle booking system",
        "Fleet compliance tracking",
        "Staff calendars",
        "Basic reports",
        "Email support",
        "Standard onboarding"
      ],
      highlighted: false
    },
    {
      name: "Essential",
      price: "279",
      period: "month",
      tagline: "Best value",
      description: "The best fit for growing franchises that need more control",
      features: [
        "Up to 25 vehicles",
        "Up to 35 users",
        "Everything in Standard, plus:",
        "Enhanced reports & analytics",
        "Booking visibility controls",
        "Admin booking control",
        "Compliance oversight",
        "Cost analytics",
        "Faster support response"
      ],
      highlighted: true,
      badge: "Most Popular"
    },
    {
      name: "Professional",
      price: "449",
      period: "month",
      tagline: "Best for multi-site operations",
      description: "For larger franchises that need scale and visibility",
      features: [
        "Up to 50 vehicles",
        "Up to 50 users",
        "Everything in Essential, plus:",
        "Detailed reporting suite",
        "Priority support",
        "Multi-site oversight",
        "Advanced permissions",
        "Custom data exports",
        "4 customizations/month"
      ],
      highlighted: false
    }
  ];

  const features = [
    {
      icon: Car,
      title: "Fleet Management",
      description: "Track all your vehicles in one place. Know who's driving what, when, and where."
    },
    {
      icon: Calendar,
      title: "Smart Booking",
      description: "Easy booking system that prevents double-bookings and keeps everyone informed."
    },
    {
      icon: Shield,
      title: "Compliance Tracking",
      description: "Never miss a tax disc, NCT, or insurance renewal. Automated reminders keep you legal."
    },
    {
      icon: Users,
      title: "Staff Management",
      description: "Assign vehicles to staff, track usage, and manage permissions effortlessly."
    },
    {
      icon: BarChart3,
      title: "Reports & Analytics",
      description: "Get insights into fleet usage, costs, and efficiency with detailed reports."
    },
    {
      icon: Clock,
      title: "Real-Time Updates",
      description: "Instant notifications for bookings, returns, and compliance deadlines."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center space-x-3">
              <img 
                src="/quick-wing-logo.png" 
                alt="Quick Wing" 
                className="h-10 sm:h-14 w-auto"
              />
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 font-medium">Contact</a>
              <a 
                href="mailto:Lee.quickwing@gmail.com"
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Get Started
              </a>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block py-2 text-gray-600 font-medium" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#pricing" className="block py-2 text-gray-600 font-medium" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#contact" className="block py-2 text-gray-600 font-medium" onClick={() => setMobileMenuOpen(false)}>Contact</a>
              <a 
                href="mailto:Lee.quickwing@gmail.com"
                className="block w-full text-center px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium"
              >
                Get Started
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-24 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 bg-blue-500/20 rounded-full text-blue-300 text-sm font-medium mb-6">
                <Zap size={16} className="mr-2" />
                Fleet Management Made Simple
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Take Control of Your
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400"> Fleet</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-300 mb-8 max-w-xl mx-auto lg:mx-0">
                The complete fleet management system designed for healthcare franchises. 
                Book vehicles, track compliance, and manage your team — all in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a 
                  href="mailto:Lee.quickwing@gmail.com?subject=Quick Wing Demo Request"
                  className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25"
                >
                  Request a Demo
                  <ArrowRight className="ml-2" size={20} />
                </a>
                <a 
                  href="#pricing"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20"
                >
                  View Pricing
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="relative z-10">
                <img 
                  src="/quick-wing-logo-3d.png" 
                  alt="Quick Wing Logo" 
                  className="w-full max-w-md mx-auto drop-shadow-2xl"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              The Problem We Solve
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Managing a fleet shouldn't be chaotic. Quick Wing brings order to your operations.
            </p>
          </div>
          <div className="flex justify-center">
            <img 
              src="/problem-solution.png" 
              alt="Without Quick Wing vs With Quick Wing" 
              className="w-full max-w-4xl rounded-2xl shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Manage Your Fleet
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful features designed specifically for healthcare and care franchises.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 bg-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                  <feature.icon className="text-blue-600 group-hover:text-white transition-colors" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Screenshots Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              See Quick Wing in Action
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              A clean, intuitive interface that your team will actually want to use.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <img 
                src="/app-screenshot-timeline.jpeg" 
                alt="Quick Wing Timeline View" 
                className="w-full rounded-xl shadow-2xl"
              />
              <p className="text-center mt-4 text-gray-300">Timeline View - See all bookings at a glance</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <img 
                src="/app-screenshot-fleet.jpeg" 
                alt="Quick Wing Fleet Overview" 
                className="w-full rounded-xl shadow-2xl"
              />
              <p className="text-center mt-4 text-gray-300">Fleet Overview - Manage all vehicles in one place</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your franchise. No hidden fees, no surprises.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <div 
                key={index}
                className={`relative rounded-2xl p-8 ${
                  plan.highlighted 
                    ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/25 scale-105' 
                    : 'bg-white border border-gray-200'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-semibold rounded-full shadow-lg">
                      <Star size={14} className="mr-1" />
                      {plan.badge}
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className={`text-xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                    {plan.tagline}
                  </p>
                </div>
                
                <div className="text-center mb-6">
                  <span className={`text-5xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    €{plan.price}
                  </span>
                  <span className={`${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                    /{plan.period}
                  </span>
                </div>
                
                <p className={`text-sm text-center mb-6 ${plan.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                  {plan.description}
                </p>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start">
                      <CheckCircle 
                        size={18} 
                        className={`mr-2 flex-shrink-0 mt-0.5 ${
                          plan.highlighted ? 'text-blue-200' : 'text-blue-600'
                        }`} 
                      />
                      <span className={`text-sm ${plan.highlighted ? 'text-white' : 'text-gray-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <a 
                  href={`mailto:Lee.quickwing@gmail.com?subject=Interested in Quick Wing ${plan.name}`}
                  className={`block w-full py-3 rounded-xl font-semibold text-center transition-all ${
                    plan.highlighted
                      ? 'bg-white text-blue-600 hover:bg-gray-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Get Started
                </a>
              </div>
            ))}
          </div>
          
          <p className="text-center text-gray-500 mt-8">
            All plans include setup, training, and ongoing support. Contact us for custom enterprise pricing.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to Take Control?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Get in touch to schedule a demo or ask any questions. We're here to help.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:Lee.quickwing@gmail.com?subject=Quick Wing Inquiry"
              className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg"
            >
              <Mail className="mr-2" size={20} />
              Lee.quickwing@gmail.com
            </a>
            <a 
              href="https://www.instagram.com/quick.wing2025?igsh=MXNvcnF2ZWJhMnQ1Zw%3D%3D&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg"
            >
              <Instagram className="mr-2" size={20} />
              Follow on Instagram
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <img 
                src="/quick-wing-logo.png" 
                alt="Quick Wing" 
                className="h-12 w-auto mb-4 brightness-0 invert"
              />
              <p className="text-gray-400 max-w-md">
                Quick Wing is the complete fleet management solution for healthcare and care franchises across Ireland.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="mailto:Lee.quickwing@gmail.com" className="hover:text-white transition-colors">
                    Lee.quickwing@gmail.com
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.instagram.com/quick.wing2025?igsh=MXNvcnF2ZWJhMnQ1Zw%3D%3D&utm_source=qr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors inline-flex items-center"
                  >
                    <Instagram size={16} className="mr-2" />
                    @quick.wing2025
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Quick Wing. All rights reserved.
            </p>
            <button 
              onClick={() => navigate('/login')}
              className="text-gray-600 text-sm hover:text-gray-400 transition-colors mt-4 sm:mt-0"
            >
              Franchise Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
