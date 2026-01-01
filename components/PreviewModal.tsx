
import React, { useRef } from 'react';
import Modal from './Modal.tsx';
import { exportElementToPdf } from '../services/exportService.ts';
import { ArrowDownTrayIcon, XCircleIcon, PrinterIcon } from './icons.tsx';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  fileName: string;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, children, fileName }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (contentRef.current) {
      exportElementToPdf(contentRef.current, fileName);
    }
  };

  const handlePrint = () => {
    if (contentRef.current) {
      const printWindow = window.open('', '_blank', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Impression - TGS CI</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
          @page { size: A4; margin: 0; }
          body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; }
          * { box-sizing: border-box; }
          @media print {
            .no-print { display: none !important; }
            body { width: 210mm; height: 297mm; }
          }
        `);
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(contentRef.current.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        };
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl m-4 h-[95vh] flex flex-col border border-gray-700">
      <header className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900 rounded-t-xl">
        <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Édition Document</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{fileName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-black uppercase transition-all border border-gray-700">
            <PrinterIcon className="w-4 h-4" /> Imprimer
          </button>
          <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase transition-all shadow-lg shadow-blue-900/40">
            <ArrowDownTrayIcon className="w-4 h-4" /> PDF
          </button>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-800 transition-colors ml-2">
            <XCircleIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>
      </header>
      <main className="flex-grow overflow-y-auto p-12 bg-gray-950/50 flex justify-center custom-scrollbar">
        <div 
            ref={contentRef} 
            className="shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-white" 
            style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
        >
          {children}
        </div>
      </main>
    </Modal>
  );
};

export default PreviewModal;
