import React, { ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon } from './icons.tsx';

interface Props {
  children?: ReactNode;
  name: string;
}

interface State {
  hasError: boolean;
}

/**
 * Un wrapper sécurisé pour empêcher une erreur dans un module 
 * de faire planter toute l'application.
 */
class ErrorBoundaryWrapper extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Erreur dans le module [${this.props.name}]:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-900/10 border border-red-900/30 rounded-2xl text-center">
          <ExclamationTriangleIcon className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-sm font-black text-white uppercase tracking-tighter">Le module "{this.props.name}" est indisponible</h3>
          <p className="text-xs text-red-400/70 mt-2 mb-4">Une erreur d'affichage s'est produite.</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-red-500 transition-colors"
          >
            Tenter de recharger
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryWrapper;