import { useState, useEffect } from 'react';

export interface OrientationState {
  orientation: 'portrait' | 'landscape';
  isLandscape: boolean;
  isPortrait: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isMobileLandscape: boolean;
  width: number;
  height: number;
}

export const useOrientation = (): OrientationState => {
  const [state, setState] = useState<OrientationState>({
    orientation: 'portrait',
    isLandscape: false,
    isPortrait: true,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isMobileLandscape: false,
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Determine orientation based on aspect ratio or window orientation API
      let orientation: 'portrait' | 'landscape' = 'portrait';
      if (window.screen && window.screen.orientation) {
        orientation = window.screen.orientation.type.startsWith('landscape') ? 'landscape' : 'portrait';
      } else {
        orientation = width > height ? 'landscape' : 'portrait';
      }

      const isLandscape = orientation === 'landscape';
      const isPortrait = orientation === 'portrait';

      // Detect device type based on width
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;

      // Mobile in landscape mode is when width is larger than height, but height is small (typical of smartphones horizontally)
      const isMobileLandscape = isLandscape && (height < 500 || width < 900);

      setState({
        orientation,
        isLandscape,
        isPortrait,
        isMobile,
        isTablet,
        isDesktop,
        isMobileLandscape,
        width,
        height,
      });
    };

    // Initial calculation
    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return state;
};
