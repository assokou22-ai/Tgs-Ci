import React from 'react';

/**
 * Drapeau officiel de la Côte d'Ivoire (Orange, Blanc, Vert)
 */
export const CoteDIvoireFlag: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
    <svg 
        viewBox="0 0 3 2" 
        className={`inline-block rounded-[2px] shadow-sm border border-white/10 ${className}`}
        aria-label="Drapeau de la Côte d'Ivoire"
    >
        <rect width="1" height="2" x="0" fill="#F77F00" />
        <rect width="1" height="2" x="1" fill="#FFFFFF" />
        <rect width="1" height="2" x="2" fill="#009E60" />
    </svg>
);

/**
 * Drapeau officiel du Bénin (Vert vertical à gauche, Jaune et Rouge horizontaux à droite)
 */
export const BeninFlag: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
    <svg 
        viewBox="0 0 3 2" 
        className={`inline-block rounded-[2px] shadow-sm border border-white/10 ${className}`}
        aria-label="Drapeau du Bénin"
    >
        <rect width="1.2" height="2" x="0" fill="#008751" />
        <rect width="1.8" height="1" x="1.2" y="0" fill="#FCD116" />
        <rect width="1.8" height="1" x="1.2" y="1" fill="#E8112D" />
    </svg>
);
