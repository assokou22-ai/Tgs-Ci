import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, InfoIcon, AlertTriangleIcon, XIcon } from './icons.tsx';
import { Toast, ToastType } from '../hooks/useToast.ts';

interface ToastProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircleIcon className="w-5 h-5 text-emerald-400" />;
      case 'error': return <XCircleIcon className="w-5 h-5 text-rose-400" />;
      case 'warning': return <AlertTriangleIcon className="w-5 h-5 text-amber-400" />;
      case 'info':
      default: return <InfoIcon className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBgColor = (type: ToastType) => {
    switch (type) {
      case 'success': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'error': return 'bg-rose-500/10 border-rose-500/20';
      case 'warning': return 'bg-amber-500/10 border-amber-500/20';
      case 'info':
      default: return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`flex items-center gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl min-w-[300px] max-w-md ${getBgColor(toast.type)}`}
    >
      <div className="flex-shrink-0">
        {getIcon(toast.type)}
      </div>
      <div className="flex-1">
        <p className="text-xs font-black text-white uppercase tracking-tight leading-tight">
          {toast.message}
        </p>
      </div>
      <button 
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const ToastContainer: React.FC<ToastProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
