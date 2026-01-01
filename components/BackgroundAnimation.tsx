import React, { useState, useEffect } from 'react';

// Simplified SVG for Pentalobe Screwdriver (common for MacBooks)
const PentalobeScrewdriver = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 20 100" className={className} fill="none" stroke="currentColor" strokeWidth="1">
        {/* Tip */}
        <path d="M10 98 L10 85" />
        <path d="M8 87 L10 85 L12 87" />
        <path d="M7 89 L10 85 L13 89" />
        {/* Shaft */}
        <path d="M10 85 L10 20" strokeWidth="2" />
        {/* Handle */}
        <rect x="5" y="0" width="10" height="20" rx="3" fill="currentColor" />
    </svg>
);

// Simplified SVG for Phillips Screwdriver
const PhillipsScrewdriver = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 20 100" className={className} fill="none" stroke="currentColor" strokeWidth="1">
        {/* Tip */}
        <path d="M10 98 L10 85" />
        <path d="M7 90 L13 90" />
        {/* Shaft */}
        <path d="M10 85 L10 20" strokeWidth="2" />
        {/* Handle */}
        <rect x="5" y="0" width="10" height="20" rx="3" fill="currentColor" />
    </svg>
);

// Simplified SVG path for Côte d'Ivoire map
const CoteDIvoireMap = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 500 500" className={className} fill="currentColor">
        <path d="M363.1,83.9c-10.4-1.1-21.2-0.1-31.5-1.5c-15.6-2.1-30.9-5.6-46.5-7.3c-14.8-1.6-29.6-3.3-44.4-4.2
	c-24-1.5-48-1.5-72-1.1c-14.2,0.3-28.5,1.2-42.6,2.8c-10.3,1.2-20.5,2.9-30.5,5.4c-5.8,1.4-11.4,3.5-16.9,5.8
	c-9.7,4-18.9,8.9-27.2,15.1c-6.2,4.6-11.7,10-16.6,16c-4.9,6-8.9,12.7-12,19.8c-3.1,7.1-5,14.7-6.5,22.4
	c-1.5,7.9-2.3,15.9-2.5,23.9c-0.3,10-0.1,20.1-0.1,30.1c0,23.3-0.2,46.7,0,70c0.1,14.6,1.1,29.1,2.8,43.5
	c1.4,11.8,4,23.4,7.4,34.7c3,9.9,7.1,19.5,12,28.6c4.6,8.6,10.1,16.7,16.5,24.2c6.1,7.2,13.1,13.6,20.8,19.2
	c9.8,7.2,20.5,12.8,31.8,17.2c12.2,4.8,25,8,38,10c14.7,2.2,29.6,2.9,44.4,2.9c13,0,26-0.3,39-1.2c13.7-1,27.3-2.9,40.8-5.7
	c11.9-2.5,23.6-5.8,35.1-9.9c13.5-4.8,26.6-10.7,38.8-18.2c10.4-6.4,20.1-13.9,28.8-22.6c8.5-8.6,15.9-18.1,21.9-28.5
	c5.9-10.1,10.2-20.9,13.3-32.1c2.9-10.6,4.8-21.4,5.8-32.4c1-11.3,1.3-22.7,1.1-34.1c-0.2-12.2-0.9-24.4-2.1-36.5
	c-1.4-13.9-3.9-27.6-7.3-41c-3.1-12.3-7.2-24.3-12.2-35.8c-5.2-11.9-11.6-23.2-19-33.8c-3.9-5.6-8.1-10.9-12.8-15.8
	c-8.1-8.5-17.4-15.9-27.6-21.8C379.7,86.2,371.4,84.7,363.1,83.9z"/>
    </svg>
);


const BackgroundAnimation: React.FC = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            setMousePosition({ x: event.clientX, y: event.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    const parallax = (factor: number) => {
        if (typeof window === 'undefined') return { x: 0, y: 0 };
        const x = (mousePosition.x - window.innerWidth / 2) * factor;
        const y = (mousePosition.y - window.innerHeight / 2) * factor;
        return { x, y };
    };

    const screwdriver1Pos = parallax(0.02);
    const screwdriver2Pos = parallax(-0.03);

    return (
        <div className="absolute inset-0 overflow-hidden -z-10">
            {/* Scrolling Map */}
            <div className="absolute inset-0 animate-pan-map">
                <CoteDIvoireMap className="absolute -left-1/4 -top-1/4 w-[150%] h-[150%] text-gray-800 opacity-50" />
            </div>

            {/* Floating Screwdrivers */}
            <div 
                className="absolute top-1/4 left-1/4 transition-transform duration-500 ease-out"
                style={{ transform: `translate(${screwdriver1Pos.x}px, ${screwdriver1Pos.y}px) rotate(35deg)` }}
            >
                <PentalobeScrewdriver className="w-24 h-24 text-gray-700" />
            </div>

            <div 
                className="absolute bottom-1/4 right-1/4 transition-transform duration-500 ease-out"
                style={{ transform: `translate(${screwdriver2Pos.x}px, ${screwdriver2Pos.y}px) rotate(-120deg)` }}
            >
                <PhillipsScrewdriver className="w-28 h-28 text-gray-700" />
            </div>
        </div>
    );
};

export default BackgroundAnimation;
