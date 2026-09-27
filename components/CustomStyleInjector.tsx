
import React from 'react';
import { useAppSettings } from '../hooks/useAppSettings.ts';

/**
 * Ce composant injecte le CSS utilisateur dans une balise style.
 * Il réagit instantanément aux changements de l'éditeur.
 */
const CustomStyleInjector: React.FC = () => {
    const { settings } = useAppSettings();

    if (!settings.customCss) return null;

    return (
        <style id="tgs-custom-css" type="text/css">
            {settings.customCss}
        </style>
    );
};

export default CustomStyleInjector;
