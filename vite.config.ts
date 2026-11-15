import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false,
      },
      plugins: [react()],
      build: {
        chunkSizeWarningLimit: 2500,
        rollupOptions: {
          output: {
            // Bibliothèques lourdes séparées : chargées seulement quand on en a besoin
            // et mises en cache indépendamment des mises à jour de l'application.
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('xlsx')) return 'vendor-xlsx';
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify') || id.includes('canvg')) return 'vendor-pdf';
              if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'vendor-charts';
              if (id.includes('@google/genai')) return 'vendor-genai';
              if (id.includes('framer-motion') || id.includes('motion')) return 'vendor-motion';
              if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
              return undefined;
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
