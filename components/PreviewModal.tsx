
import React, { useRef, useState, useEffect } from 'react';
import Modal from './Modal.tsx';
import { exportElementToPdf } from '../services/exportService.ts';
import { ArrowDownTrayIcon, XCircleIcon, PrinterIcon } from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  fileName: string;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, children, fileName }) => {
  const { showToast } = useToastContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const padding = 32;
        const availableWidth = containerWidth - padding;
        const a4WidthPx = 793.7; 
        
        if (availableWidth < a4WidthPx) {
          setScale(availableWidth / a4WidthPx);
        } else {
          setScale(1);
        }
      }
    };

    if (isOpen) {
      updateScale();
      window.addEventListener('resize', updateScale);
    }
    return () => window.removeEventListener('resize', updateScale);
  }, [isOpen]);

  const handleDownload = async () => {
    if (contentRef.current) {
        try {
            await exportElementToPdf(contentRef.current, fileName);
            showToast("PDF généré avec succès.", "success");
        } catch (error) {
            console.error("PDF Export failed:", error);
            showToast("Erreur lors de la génération du PDF.", "error");
        }
    }
  };

  const handlePrint = () => {
    if (contentRef.current) {
      const printWindow = window.open('', '_blank', 'height=900,width=850');
      if (printWindow) {
        const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
          .map(style => style.outerHTML)
          .join('\n');

        const content = contentRef.current.innerHTML;
        
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Export TGS-CI - ${fileName}</title>
              ${styleTags}
              <style>
                @page { 
                  size: A4 portrait; 
                  margin: 0 !important; 
                }
                body { 
                  margin: 0 !important; 
                  padding: 0 !important; 
                  background: #fff !important; 
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .printable-page { 
                  border: none !important; 
                  box-shadow: none !important; 
                  width: 210mm !important;
                  height: auto !important;
                  min-height: 297mm !important;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                  letter-spacing: 0.02em !important;
                  word-spacing: normal !important;
                }
                .printable-page.ticket-single-page,
                .printable-page.single-page-fit {
                  height: 285mm !important;
                  max-height: 285mm !important;
                  min-height: 0 !important;
                  padding: 5mm 7mm !important;
                  overflow: hidden !important;
                  page-break-after: avoid !important;
                  page-break-inside: avoid !important;
                  page-break-before: avoid !important;
                  break-after: avoid !important;
                  break-inside: avoid !important;
                  break-before: avoid !important;
                }
                .printable-page * {
                  letter-spacing: 0.02em !important;
                }
                * { box-sizing: border-box; }
              </style>
            </head>
            <body>
              ${content}
              <script>
                // Utilisation d'une approche plus directe pour déclencher l'impression
                (function() {
                  const checkReady = () => {
                    if (document.readyState === 'complete') {
                      setTimeout(() => {
                        window.print();
                        // Optionnel: fermer la fenêtre après impression
                        // window.onafterprint = () => window.close();
                      }, 1200);
                    } else {
                      setTimeout(checkReady, 100);
                    }
                  };
                  checkReady();
                })();
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  // Fix: Removed the undefined 'isRendered' check. The 'Modal' component handles its own mounting state and animation lifecycle via its own internal 'isRendered' state.
  return (
    <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-apple-surface rounded-2xl shadow-2xl w-full max-w-[98vw] h-[98vh] flex flex-col border border-white/10 overflow-hidden">
      <header className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-white/5 glass z-10 gap-3">
        <div className="text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Aperçu Impression Certifiée</h2>
            <p className="hidden sm:block text-[10px] text-apple-muted font-bold uppercase tracking-widest">{fileName}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 transition-colors">
          <XCircleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-apple-muted hover:text-white" />
        </button>
      </header>

      {/* Floating Action Bar - Fixed at bottom right for desktop, full width bottom for mobile */}
      <div className="fixed bottom-0 left-0 right-0 md:bottom-8 md:right-8 md:left-auto p-4 md:p-0 bg-black/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-t md:border-none border-white/10 z-[210] flex flex-row md:flex-col gap-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:pb-0 justify-center md:justify-end pointer-events-auto">
          <button 
              onClick={handlePrint}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-white text-black rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-white/10 group min-h-[48px] md:min-w-[180px] active:scale-95"
          >
              <PrinterIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Imprimer</span>
          </button>
          <button 
              onClick={handleDownload}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-apple-blue text-white rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 group min-h-[48px] md:min-w-[180px] active:scale-95"
          >
              <ArrowDownTrayIcon className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              <span>Générer PDF</span>
          </button>
      </div>

      <main 
        ref={containerRef}
        className="flex-1 overflow-auto p-2 sm:p-8 bg-[#0a0a0a] flex justify-center items-start custom-scrollbar pb-32 md:pb-8"
      >
        <div 
            style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out'
            }}
        >
            <div 
                ref={contentRef} 
                className="bg-white shadow-[0_0_100px_rgba(0,0,0,0.9)] border border-white/5" 
                style={{ width: '210mm', minHeight: '297mm', position: 'relative' }}
            >
              {children}
            </div>
        </div>
      </main>
    </Modal>
  );
};

export default PreviewModal;
