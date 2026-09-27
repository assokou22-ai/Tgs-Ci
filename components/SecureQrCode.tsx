import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { encodeTicketId } from '../utils/qrSecurity.ts';

interface SecureQrCodeProps {
  ticketId: string;
  size?: number;
}

const SecureQrCode: React.FC<SecureQrCodeProps> = ({ ticketId, size = 100 }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!ticketId) return;
    
    // Encrypt the ticket ID so standard scan readers see gibberish
    const securedPayload = encodeTicketId(ticketId);

    // Generate QR using the direct lib API
    QRCode.toDataURL(
      securedPayload,
      {
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M'
      },
      (err, url) => {
        if (err) {
          console.error('Error rendering secure QR code:', err);
          return;
        }
        setDataUrl(url);
      }
    );
  }, [ticketId, size]);

  if (!dataUrl) {
    return (
      <div 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          background: '#f4f4f5', 
          borderRadius: '6px',
          border: '1px dashed #e4e4e7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8px',
          color: '#a1a1aa',
          fontWeight: 'bold',
          textTransform: 'uppercase'
        }}
      >
        QR
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ padding: '1mm', background: '#fff', border: '0.4pt solid #e4e4e7', borderRadius: '1.5mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img 
          src={dataUrl} 
          alt="Secure QR Code TGS" 
          style={{ width: `${size}px`, height: `${size}px`, display: 'block' }} 
          referrerPolicy="no-referrer"
        />
      </div>
      <span style={{ fontSize: '5.5px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', display: 'block', marginTop: '2px', letterSpacing: '0.6px', fontFamily: 'monospace' }}>
        🔒 TGSCI SECURE
      </span>
    </div>
  );
};

export default SecureQrCode;
