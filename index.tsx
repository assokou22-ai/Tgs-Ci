
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppSettingsProvider } from './hooks/useAppSettings.ts';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppSettingsProvider>
      <App />
    </AppSettingsProvider>
  </React.StrictMode>
);
