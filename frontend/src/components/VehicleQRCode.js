import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, Printer, Car } from 'lucide-react';
import { useParams } from 'react-router-dom';

const VehicleQRCode = ({ vehicle, isOpen, onClose }) => {
  const qrRef = useRef(null);
  const { tenantSlug } = useParams();
  
  if (!isOpen || !vehicle) return null;

  // Get the base URL from environment or current location
  const baseUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin;
  
  // Generate QR code value - URL to mileage log page
  const qrValue = `${baseUrl}/${tenantSlug}/vehicle/${vehicle.id}/mileage`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    // Create canvas to convert SVG to PNG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw QR code centered
      ctx.drawImage(img, 50, 50, 300, 300);
      
      // Add vehicle name
      ctx.fillStyle = 'black';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(vehicle.name, 200, 400);
      
      // Add registration
      ctx.font = '18px Arial';
      ctx.fillText(vehicle.registration, 200, 430);
      
      // Add Quick Wing branding
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText('Quick Wing Fleet Management', 200, 480);
      
      // Download
      const link = document.createElement('a');
      link.download = `qr-${vehicle.registration.replace(/\s/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${vehicle.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .qr-container {
              text-align: center;
              border: 2px solid #ddd;
              padding: 30px;
              border-radius: 16px;
              background: white;
            }
            .vehicle-name {
              font-size: 28px;
              font-weight: bold;
              margin-top: 20px;
              color: #1a1a1a;
            }
            .registration {
              font-size: 20px;
              color: #666;
              margin-top: 8px;
            }
            .instructions {
              font-size: 14px;
              color: #888;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
            .branding {
              font-size: 12px;
              color: #999;
              margin-top: 30px;
            }
            @media print {
              body { padding: 0; }
              .qr-container { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <svg viewBox="0 0 256 256" width="250" height="250">
              ${qrRef.current?.querySelector('svg')?.innerHTML || ''}
            </svg>
            <div class="vehicle-name">${vehicle.name}</div>
            <div class="registration">${vehicle.registration}</div>
            <div class="instructions">
              Scan this QR code with your phone<br/>to update vehicle status and mileage
            </div>
            <div class="branding">Quick Wing Fleet Management</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Vehicle QR Code</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* QR Code Display */}
        <div className="p-6 text-center" ref={qrRef}>
          <div className="bg-white p-4 rounded-lg inline-block shadow-sm border">
            <QRCodeSVG
              value={qrValue}
              size={200}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-center space-x-2 text-gray-900">
              <Car size={20} className="text-blue-600" />
              <h4 className="font-bold text-lg">{vehicle.name}</h4>
            </div>
            <p className="text-gray-600">{vehicle.registration}</p>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            Scan this code to update vehicle status and mileage
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50 flex space-x-3">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center space-x-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download size={18} />
            <span>Download</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center space-x-2 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Printer size={18} />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleQRCode;
