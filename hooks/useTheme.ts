
import { useEffect } from 'react';
import { useAppSettings } from './useAppSettings.ts';
import { ColorPalette, ThemeType } from '../types.ts';

const THEMES: Record<Exclude<ThemeType, 'system' | 'ia-aleatoire'>, ColorPalette> = {
    'monochrome': {
        primary: '#3b82f6',
        secondary: '#6b7280',
        bg: '#F5F5F7',
        surface: '#FFFFFF',
        text: '#1D1D1F',
        textMuted: '#86868B',
        accent: '#3b82f6'
    },
    'clair': {
        primary: '#007AFF',
        secondary: '#8E8E93',
        bg: '#F5F5F7',
        surface: '#FFFFFF',
        text: '#1D1D1F',
        textMuted: '#86868B',
        accent: '#007AFF'
    },
    'sombre': {
        primary: '#0A84FF',
        secondary: '#8E8E93',
        bg: '#1C1C1E',
        surface: '#2C2C2E',
        text: '#F5F5F7',
        textMuted: '#8E8E93',
        accent: '#0A84FF'
    },
    'bleu-apple': {
        primary: '#0056D2',
        secondary: '#4A5568',
        bg: '#F0F4F8',
        surface: '#FFFFFF',
        text: '#1A365D',
        textMuted: '#718096',
        accent: '#0056D2'
    },
    'vert-nature': {
        primary: '#2D6A4F',
        secondary: '#52796F',
        bg: '#F2F7F2',
        surface: '#FFFFFF',
        text: '#1B2E1B',
        textMuted: '#84A98C',
        accent: '#2D6A4F'
    },
    'vga-classic': {
        primary: '#0000FF', // Bleu pur pour les boutons
        secondary: '#000000',
        bg: '#D4D0C8', // Gris Windows Classic
        surface: '#FFFFFF',
        text: '#000000',
        textMuted: '#404040',
        accent: '#FF0000' // Rouge pur pour alertes
    }
};

export const useTheme = () => {
    const { settings } = useAppSettings();

    useEffect(() => {
        const root = document.documentElement;
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updateDarkMode = () => {
            if (settings.theme === 'vga-classic') {
                root.classList.remove('dark');
                root.classList.add('legacy-vga');
                return;
            } else {
                root.classList.remove('legacy-vga');
            }

            if (settings.theme === 'system') {
                if (mediaQuery.matches) root.classList.add('dark');
                else root.classList.remove('dark');
            } else if (settings.theme === 'sombre') {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        updateDarkMode();
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', updateDarkMode);
        }

        const palette = settings.theme === 'ia-aleatoire' 
            ? settings.customPalette 
            : THEMES[settings.theme as keyof typeof THEMES];

        if (palette) {
            root.style.setProperty('--color-primary', palette.primary);
            root.style.setProperty('--color-bg', palette.bg);
            root.style.setProperty('--color-surface', palette.surface);
            root.style.setProperty('--color-text', palette.text);
            root.style.setProperty('--color-text-muted', palette.textMuted);
            root.style.setProperty('--color-accent', palette.accent);
            root.classList.add('custom-theme');
        } else {
            root.classList.remove('custom-theme');
        }

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', updateDarkMode);
            }
        };
    }, [settings.theme, settings.customPalette]);
};