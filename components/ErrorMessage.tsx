import React from 'react';
import { ExclamationTriangleIcon } from './icons.tsx';

interface Action {
  label: string;
  onClick: () => void;
}

interface ErrorMessageProps {
  title: string;
  message?: string;
  actions?: Action[];
  children?: React.ReactNode;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ title, message, actions, children }) => {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto bg-gray-800 border border-red-700 rounded-lg p-8 shadow-2xl">
            <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
            {message && <p className="text-red-300 mb-6">{message}</p>}
            
            {children}

            {actions && actions.length > 0 && (
              <div className="mt-8 flex justify-center gap-4">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-500 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
        </div>
    </div>
  );
};

export default ErrorMessage;
