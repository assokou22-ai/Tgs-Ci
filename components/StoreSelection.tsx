import React from 'react';
import { BuildingStorefrontIcon } from './icons.tsx';
import BackgroundAnimation from './BackgroundAnimation.tsx';

interface StoreSelectionProps {
  onSelectStore: (storeId: string) => void;
}

const StoreSelection: React.FC<StoreSelectionProps> = ({ onSelectStore }) => {
  const storeName = "Magasin Principal";
  const storeId = "magasin-principal";

  return (
    <div className="min-h-screen flex flex-col items-center p-4 text-white relative overflow-hidden">
        <BackgroundAnimation />
        <main className="flex-grow flex flex-col justify-center items-center w-full py-8">
            <div className="text-center mb-12 z-10">
                <h1 className="text-5xl font-bold">RéparerMonMac</h1>
                <p className="mt-4 text-lg text-gray-300">Veuillez sélectionner votre magasin</p>
            </div>
            <div className="w-full max-w-2xl flex justify-center z-10">
                <button
                    onClick={() => onSelectStore(storeId)}
                    className="w-full max-w-md text-left p-8 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg hover:bg-gray-700/80 hover:ring-2 hover:ring-blue-500 transition-all duration-200 flex items-center gap-6"
                >
                    <BuildingStorefrontIcon className="w-12 h-12 text-blue-400 flex-shrink-0" />
                    <div>
                        <h3 className="text-2xl font-bold text-white">{storeName}</h3>
                        <p className="mt-1 text-gray-400">Accéder à l'environnement de données du magasin principal.</p>
                    </div>
                </button>
            </div>
        </main>

        <footer className="text-xs text-gray-500 z-10 pb-4">
            copyright TGS-CI Groupe 2025
        </footer>
    </div>
  );
};

export default StoreSelection;