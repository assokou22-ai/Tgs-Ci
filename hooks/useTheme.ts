
import { useEffect } from 'react';
import { useAppSettings } from './useAppSettings.ts';
import { ColorPalette, ThemeType } from '../types.ts';

const THEMES: Record<Exclude<ThemeType, 'system' | 'ia-aleatoire'>, ColorPalette> = {
    'blanc-noir-bleu': {
        primary: '#2563eb', // Blue 600
        secondary: '#1e293b', // Slate 800
        bg: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        textMuted: '#64748b',
        accent: '#3b82f6'
    },
    'blanc-vert-bleu': {
        primary: '#10b981', // Emerald 500
        secondary: '#0369a1', // Sky 700
        bg: '#ffffff',
        surface: '#f0fdf4',
        text: '#064e3b',
        textMuted: '#6b7280',
        accent: '#0ea5e9'
    },
    'blanc-bleu-noir': {
        primary: '#0ea5e9', // Sky 500
        secondary: '#0f172a', // Slate 900
        bg: '#ffffff',
        surface: '#f1f5f9',
        text: '#1e293b',
        textMuted: '#475569',
        accent: '#2563eb'
    },
    'professionnel': {
        primary: '#000000',
        secondary: '#4b5563',
        bg: '#ffffff',
        surface: '#ffffff',
        text: '#000000',
        textMuted: '#9ca3af',
        accent: '#111827'
    }
};

export const useTheme = () => {
    const { settings } = useAppSettings();

    useEffect(() => {
        const root = document.documentElement;
        
        // 1. Dark mode logic
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updateDarkMode = () => {
            if (settings.theme === 'system') {
                if (mediaQuery.matches) root.classList.add('dark');
                else root.classList.remove('dark');
            } else {
                // For custom themes, we usually disable standard dark mode to control everything via variables
                root.classList.remove('dark');
            }
        };

        updateDarkMode();
        mediaQuery.addEventListener('change', updateDarkMode);

        // 2. Custom Variables Injection
        if (settings.theme !== 'system') {
            let palette: ColorPalette | undefined;
            
            if (settings.theme === 'ia-aleatoire') {
                palette = settings.customPalette;
            } else {
                palette = THEMES[settings.theme as keyof typeof THEMES];
            }

            if (palette) {
                root.style.setProperty('--color-primary', palette.primary);
                root.style.setProperty('--color-bg', palette.bg);
                root.style.setProperty('--color-surface', palette.surface);
                root.style.setProperty('--color-text', palette.text);
                root.style.setProperty('--color-text-muted', palette.textMuted);
                root.style.setProperty('--color-accent', palette.accent);
                
                // Add a global class to help components adapt
                root.classList.add('custom-theme');
            }
        } else {
            // Reset to defaults
            root.classList.remove('custom-theme');
            root.style.removeProperty('--color-primary');
            root.style.removeProperty('--color-bg');
            root.style.removeProperty('--color-surface');
            root.style.removeProperty('--color-text');
            root.style.removeProperty('--color-text-muted');
            root.style.removeProperty('--color-accent');
        }

        return () => mediaQuery.removeEventListener('change', updateDarkMode);
    }, [settings.theme, settings.customPalette]);
};
