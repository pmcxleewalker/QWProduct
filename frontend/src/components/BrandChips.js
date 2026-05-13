import React, { useMemo } from 'react';

/**
 * Brand quick-filter chips for the fleet list.
 *
 * Derives brands from the FIRST WORD of each vehicle's `name` ("Ford Transit"
 * -> "Ford"). Counts are auto-calculated, so as the fleet grows the chips
 * stay in sync with no admin config. Sorted by count desc; chips with fewer
 * than 1 match are hidden. The "All" chip is always first.
 *
 * Why first-word and not a separate `brand` field? Karen and most fleet
 * admins already encode the brand at the start of the car's name. Asking
 * them to fill an extra column would be busywork.
 */
const brandOf = (name) => {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  if (!first) return null;
  // Normalise common abbreviations so chips don't fragment.
  const upper = first.toUpperCase();
  if (upper === 'VW' || upper === 'VOLKSWAGEN') return 'VW';
  if (upper === 'BMW') return 'BMW';
  // Title-case otherwise (handles "ford" / "FORD" / "Ford" -> "Ford")
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
};

const BrandChips = ({ vehicles = [], selected, onSelect, testid = 'brand-chips' }) => {
  const brands = useMemo(() => {
    const counts = new Map();
    for (const v of vehicles) {
      const b = brandOf(v.name);
      if (!b) continue;
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [vehicles]);

  // Don't render the bar if there's only one brand — no choice to make.
  if (brands.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={testid}>
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
          !selected
            ? 'bg-slate-900 text-white shadow-sm'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
        data-testid={`${testid}-all`}
      >
        All <span className="opacity-75 ml-0.5">{vehicles.length}</span>
      </button>
      {brands.map(([brand, count]) => {
        const isActive = selected === brand;
        return (
          <button
            key={brand}
            onClick={() => onSelect(isActive ? null : brand)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              isActive
                ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            data-testid={`${testid}-${brand.toLowerCase()}`}
          >
            {brand} <span className="opacity-75 ml-0.5">{count}</span>
          </button>
        );
      })}
    </div>
  );
};

export const filterByBrand = (vehicles, brand) => {
  if (!brand) return vehicles;
  return vehicles.filter(v => {
    const b = brandOf(v.name);
    return b === brand;
  });
};

export default BrandChips;
