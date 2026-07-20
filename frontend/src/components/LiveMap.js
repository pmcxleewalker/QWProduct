import React from 'react';
import { MapPin, Navigation, Zap } from 'lucide-react';

/**
 * LiveMap
 * -------
 * Placeholder for the live fleet map. A real map view needs a GPS/telematics
 * feed per vehicle — SinoTrack, Traccar, or a similar integration. Until then
 * this shows the visitor exactly what the tab will do and how to enable it.
 */
const LiveMap = ({ cars = [] }) => {
  const withLocation = cars.filter((c) => c.current_location_eircode || c.current_location_label);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" data-testid="live-map">
      <div className="relative p-8 sm:p-12 bg-gradient-to-br from-slate-50 to-blue-50 border-b border-slate-200">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-3 py-1 mb-4">
            <Zap size={12} /> GPS integration required
          </div>
          <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Live vehicle map is one integration away.
          </h3>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Plug in a fleet of SinoTrack 4G, Teltonika or Traccar-compatible GPS units
            and this tab will show every car live on a map — with speed, direction and
            last-seen time. Ask us to switch this on when you&apos;re ready.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            In the meantime, the drop-off locations you save from Fleet Board are listed
            below.
          </p>
        </div>
      </div>

      <div className="p-6">
        <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
          <MapPin size={14} className="text-blue-600" /> Recorded drop-off locations
        </h4>

        {withLocation.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No drop-off locations recorded yet — use the Drop-off button on any Fleet Board card to add one.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {withLocation.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{c.registration}</p>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    {c.current_location_eircode && (
                      <p className="font-mono text-xs font-semibold text-blue-700">
                        {c.current_location_eircode}
                      </p>
                    )}
                    {c.current_location_label && (
                      <p className="text-xs text-slate-600">{c.current_location_label}</p>
                    )}
                  </div>
                  <Navigation size={14} className="text-slate-400" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LiveMap;
