import React from 'react';

interface NetworkStatusIconProps {
  quality: number; // 0 (offline) to 4 (excellent)
  className?: string;
}

const NetworkStatusIcon: React.FC<NetworkStatusIconProps> = ({ quality, className = 'w-6 h-6' }) => {
  const bars = Array.from({ length: 4 }, (_, i) => i < quality);

  if (quality === 0) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="14" width="4" height="6" rx="1" className={bars[0] ? 'text-current' : 'text-gray-600'} fill="currentColor" />
        <rect x="8" y="10" width="4" height="10" rx="1" className={bars[1] ? 'text-current' : 'text-gray-600'} fill="currentColor" />
        <rect x="14" y="6" width="4" height="14" rx="1" className={bars[2] ? 'text-current' : 'text-gray-600'} fill="currentColor" />
        <rect x="20" y="2" width="4" height="18" rx="1" className={bars[3] ? 'text-current' : 'text-gray-600'} fill="currentColor" />
    </svg>
  );
};

export default NetworkStatusIcon;