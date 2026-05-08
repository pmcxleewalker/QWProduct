import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { QrCode, Download, Copy, Smartphone, Maximize2, X } from 'lucide-react';

/**
 * Admin-facing card showing a QR code that staff scan to land on the
 * tenant's login page. Includes copy, download (PNG), and an enlarge
 * modal for showing the code on a screen at the depot.
 */
const StaffAppQRCard = ({ tenantSlug, tenantName }) => {
  const canvasRef = useRef(null);
  const [enlarged, setEnlarged] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const loginUrl = `${baseUrl}/${tenantSlug}/login`;

  const handleCopy = () => {
    navigator.clipboard.writeText(loginUrl);
    toast.success('Staff login URL copied');
  };

  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${tenantSlug}-staff-app-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR code downloaded');
  };

  return (
    <>
      <div
        className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-start"
        data-testid="staff-qr-card"
      >
        {/* QR */}
        <div ref={canvasRef} className="flex-shrink-0 p-3 bg-white border-2 border-slate-100 rounded-xl">
          <QRCodeCanvas
            value={loginUrl}
            size={132}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#0f172a"
            data-testid="staff-qr-canvas"
          />
        </div>

        {/* Copy / details */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase tracking-wider mb-2">
            <Smartphone size={11} />
            Staff app
          </div>
          <h3 className="font-bold text-slate-900 mb-1">Scan to open the staff app</h3>
          <p className="text-sm text-slate-600 mb-3">
            Print or display this QR. Staff scan with their phone camera and land directly on{' '}
            <span className="font-medium">{tenantName || 'your'}</span> login page.
          </p>
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200"
              data-testid="staff-qr-copy"
            >
              <Copy size={13} /> Copy URL
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800"
              data-testid="staff-qr-download"
            >
              <Download size={13} /> Download PNG
            </button>
            <button
              onClick={() => setEnlarged(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
              data-testid="staff-qr-enlarge"
            >
              <Maximize2 size={13} /> Display
            </button>
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-3 break-all">{loginUrl}</p>
        </div>
      </div>

      {/* Enlarged display modal */}
      {enlarged && (
        <div
          className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4"
          onClick={() => setEnlarged(false)}
          data-testid="staff-qr-modal"
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-8 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEnlarged(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X size={18} className="text-slate-600" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <QrCode size={12} />
              Staff app · {tenantName}
            </div>
            <div className="flex items-center justify-center mb-4">
              <QRCodeCanvas value={loginUrl} size={280} level="H" includeMargin={false} bgColor="#ffffff" fgColor="#0f172a" />
            </div>
            <p className="text-base font-semibold text-slate-900 mb-1">Scan with your phone camera</p>
            <p className="text-sm text-slate-500">
              You'll land on the {tenantName} login page.
            </p>
            <p className="text-[11px] font-mono text-slate-400 mt-3 break-all">{loginUrl}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default StaffAppQRCard;
