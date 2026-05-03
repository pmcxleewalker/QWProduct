import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Clock, TrendingDown, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';

// Animated number hook — counts smoothly from previous value to new value
const useAnimatedNumber = (target, duration = 800) => {
  const [value, setValue] = useState(target);
  const startRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = startRef.current;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startRef.current = target;
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
};

const formatEuro = (n) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const formatHours = (n) =>
  new Intl.NumberFormat('en-IE', { maximumFractionDigits: 1 }).format(n);

const ROICalculator = () => {
  // Inputs
  const [managers, setManagers] = useState(2);
  const [hoursPerWeek, setHoursPerWeek] = useState(15);
  const [hourlyRate, setHourlyRate] = useState(18);
  // Quick Wing's proven time savings — fixed at 70%
  const savingsPct = 70;

  // Derived calculations
  const totalHoursWeek = managers * hoursPerWeek;
  const currentCostWeek = totalHoursWeek * hourlyRate;
  const currentCostMonth = currentCostWeek * 4.33;
  const currentCostYear = currentCostWeek * 52;

  const savedHoursWeek = totalHoursWeek * (savingsPct / 100);
  const savedCostWeek = currentCostWeek * (savingsPct / 100);
  const savedCostMonth = currentCostMonth * (savingsPct / 100);
  const savedCostYear = currentCostYear * (savingsPct / 100);

  // Animated outputs
  const aHoursWeek = useAnimatedNumber(savedHoursWeek);
  const aCostWeek = useAnimatedNumber(savedCostWeek);
  const aCostMonth = useAnimatedNumber(savedCostMonth);
  const aCostYear = useAnimatedNumber(savedCostYear);
  const aCurrentYear = useAnimatedNumber(currentCostYear);
  const aWithQwYear = useAnimatedNumber(currentCostYear - savedCostYear);

  return (
    <section
      id="roi-calculator"
      className="py-16 sm:py-20 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white relative overflow-hidden"
      aria-labelledby="roi-heading"
      data-testid="roi-calculator-section"
    >
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-10 -left-20 w-72 h-72 bg-cyan-400 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -right-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-400/10 border border-cyan-400/30 rounded-full text-cyan-300 text-xs font-medium mb-4">
            <Sparkles size={14} />
            ROI Calculator
          </div>
          <h2
            id="roi-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4"
          >
            How much is fleet admin
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              {' '}costing your business?
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
            Adjust the sliders below to see how much time and money your team could save by automating fleet management with Quick Wing.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
          {/* INPUTS PANEL */}
          <div
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8"
            data-testid="roi-inputs-panel"
          >
            <div className="flex items-center gap-2 mb-6">
              <Calculator className="text-cyan-400" size={20} />
              <h3 className="text-lg font-semibold text-white">Your Fleet Today</h3>
            </div>

            {/* Managers */}
            <div className="mb-6">
              <div className="flex justify-between items-baseline mb-2">
                <label htmlFor="roi-managers" className="text-sm text-slate-300">
                  Fleet managers / admin staff
                </label>
                <span
                  className="text-xl font-bold text-cyan-300"
                  data-testid="roi-managers-value"
                >
                  {managers}
                </span>
              </div>
              <input
                id="roi-managers"
                type="range"
                min="1"
                max="20"
                step="1"
                value={managers}
                onChange={(e) => setManagers(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
                data-testid="roi-managers-slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span>20</span>
              </div>
            </div>

            {/* Hours per week */}
            <div className="mb-6">
              <div className="flex justify-between items-baseline mb-2">
                <label htmlFor="roi-hours" className="text-sm text-slate-300">
                  Hours per week each spends on fleet admin
                </label>
                <span
                  className="text-xl font-bold text-cyan-300"
                  data-testid="roi-hours-value"
                >
                  {hoursPerWeek}h
                </span>
              </div>
              <input
                id="roi-hours"
                type="range"
                min="1"
                max="40"
                step="1"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
                data-testid="roi-hours-slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1h</span>
                <span>40h</span>
              </div>
            </div>

            {/* Hourly rate */}
            <div className="mb-6">
              <div className="flex justify-between items-baseline mb-2">
                <label htmlFor="roi-rate" className="text-sm text-slate-300">
                  Average hourly rate
                </label>
                <span
                  className="text-xl font-bold text-cyan-300"
                  data-testid="roi-rate-value"
                >
                  €{hourlyRate}/hr
                </span>
              </div>
              <input
                id="roi-rate"
                type="range"
                min="10"
                max="40"
                step="1"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
                data-testid="roi-rate-slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>€10</span>
                <span>€40</span>
              </div>
            </div>

            {/* Savings % — fixed Quick Wing claim */}
            <div className="pt-6 border-t border-white/10">
              <div className="flex items-center justify-between bg-emerald-400/10 border border-emerald-400/30 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-300" />
                  <span className="text-sm text-slate-200">
                    Time saved by automating with Quick Wing
                  </span>
                </div>
                <span
                  className="text-2xl font-bold text-emerald-300"
                  data-testid="roi-savings-value"
                >
                  {savingsPct}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 italic text-center">
                Based on real Quick Wing customer results.
              </p>
            </div>
          </div>

          {/* RESULTS PANEL */}
          <div className="space-y-4" data-testid="roi-results-panel">
            {/* TWIN HEADLINE CARDS — money + time, side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Money saved per year */}
              <div className="bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-cyan-500/20">
                <div className="flex items-center gap-2 mb-2 text-emerald-50">
                  <TrendingUp size={16} />
                  <span className="text-xs font-medium uppercase tracking-wide">You save</span>
                </div>
                <div
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-1 leading-none"
                  data-testid="roi-yearly-savings"
                >
                  {formatEuro(aCostYear)}
                </div>
                <p className="text-emerald-50 text-xs sm:text-sm">per year</p>
              </div>

              {/* Time freed up per week */}
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-blue-500/20">
                <div className="flex items-center gap-2 mb-2 text-blue-50">
                  <Clock size={16} />
                  <span className="text-xs font-medium uppercase tracking-wide">You free up</span>
                </div>
                <div
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-1 leading-none"
                  data-testid="roi-hours-saved"
                >
                  {formatHours(aHoursWeek)}<span className="text-2xl sm:text-3xl ml-1">hrs</span>
                </div>
                <p className="text-blue-50 text-xs sm:text-sm">per week</p>
              </div>
            </div>

            {/* Per week / per month savings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                <div className="text-xs text-slate-400 mb-1">Saved per week</div>
                <div
                  className="text-xl font-bold text-emerald-300"
                  data-testid="roi-weekly-savings"
                >
                  {formatEuro(aCostWeek)}
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                <div className="text-xs text-slate-400 mb-1">Saved per month</div>
                <div
                  className="text-xl font-bold text-emerald-300"
                  data-testid="roi-monthly-savings"
                >
                  {formatEuro(aCostMonth)}
                </div>
              </div>
            </div>

            {/* Before / After comparison */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-3 font-semibold">
                Annual fleet admin cost
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={16} className="text-rose-400" />
                    <span className="text-sm text-slate-300">Without Quick Wing</span>
                  </div>
                  <span className="text-lg font-semibold text-rose-300 line-through decoration-rose-500/40">
                    {formatEuro(aCurrentYear)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <span className="text-sm text-slate-300">With Quick Wing</span>
                  </div>
                  <span className="text-lg font-semibold text-emerald-300">
                    {formatEuro(aWithQwYear)}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <a
              href="mailto:Lee.quickwing@gmail.com?subject=Quick Wing Demo Request — ROI Calculator"
              className="group w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-white text-slate-900 rounded-xl font-semibold hover:bg-cyan-50 transition-all shadow-lg shadow-cyan-500/10"
              data-testid="roi-book-demo-btn"
              aria-label="Book a free Quick Wing demo"
            >
              Book a Free Demo
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ROICalculator;
