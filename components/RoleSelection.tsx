
import React from 'react';
import { Role } from '../types.ts';
import BackupStatus from './BackupStatus.tsx';
import BackgroundAnimation from './BackgroundAnimation.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';

interface RoleSelectionProps {
  onSelectRole: (role: Role) => void;
}

const RoleButton: React.FC<{ role: Role, description: string, onSelect: () => void }> = ({ role, description, onSelect }) => (
    <button
        onClick={onSelect}
        className="w-full text-left p-6 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg hover:bg-gray-700/80 hover:ring-2 hover:ring-blue-500 transition-all duration-200 group"
    >
        <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{role}</h3>
            <div className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-gray-500 group-hover:border-blue-500 group-hover:text-blue-500 transition-all">
                →
            </div>
        </div>
        <p className="mt-1 text-gray-400 text-sm">{description}</p>
    </button>
);

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  const { isFeatureEnabled } = useAppSettings();

  return (
    <div className="min-h-screen flex flex-col items-center p-4 text-white relative overflow-hidden">
        <BackgroundAnimation />
        <main className="flex-grow flex flex-col justify-center items-center w-full py-8">
            <div className="text-center mb-12 z-10">
                <h1 className="text-5xl font-black uppercase tracking-tighter italic">RéparerMonMac</h1>
                <p className="mt-4 text-lg text-gray-400 font-bold uppercase tracking-widest">Atelier TGS - Côte d'Ivoire</p>
            </div>
            <div className="w-full max-w-2xl space-y-4 z-10">
                {isFeatureEnabled('menu_accueil') && (
                    <RoleButton
                        role="Accueil"
                        description="Enregistrement des machines, Signature Client et Prise de rendez-vous."
                        onSelect={() => onSelectRole('Accueil')}
                    />
                )}
                {isFeatureEnabled('menu_technicien') && (
                    <RoleButton
                        role="Technicien"
                        description="Accès technique, Diagnostics avancés, Rapports IA et Traçabilité."
                        onSelect={() => onSelectRole('Technicien')}
                    />
                )}
                {isFeatureEnabled('menu_editeur') && (
                    <RoleButton
                        role="Editeur"
                        description="Superviseur : Configuration, Stock, Statistiques et Architecture."
                        onSelect={() => onSelectRole('Editeur')}
                    />
                )}
                {isFeatureEnabled('menu_finance') && (
                    <RoleButton
                        role="Facture et Commande"
                        description="Facturation client, Proformas et Commandes de pièces fournisseurs."
                        onSelect={() => onSelectRole('Facture et Commande')}
                    />
                )}
                
                {!isFeatureEnabled('menu_accueil') && !isFeatureEnabled('menu_technicien') && !isFeatureEnabled('menu_editeur') && !isFeatureEnabled('menu_finance') && (
                    <div className="p-8 text-center bg-red-900/20 border border-red-900/50 rounded-xl">
                        <p className="text-red-400 font-bold uppercase tracking-widest">Tous les menus ont été désactivés par l'administrateur.</p>
                        <p className="text-xs text-gray-500 mt-2">Veuillez réinitialiser les réglages de l'application.</p>
                    </div>
                )}
            </div>
        </main>
        
        <div className="w-full max-w-4xl z-10 mt-auto">
            <div className="bg-gray-800/50 backdrop-blur-md rounded-t-xl border-t border-x border-gray-700 p-4 shadow-2xl">
                <BackupStatus />
            </div>
            <footer className="bg-gray-900/80 backdrop-blur-md text-[10px] text-gray-500 py-3 flex justify-center uppercase font-black tracking-widest border-t border-gray-800">
                TGS-CI Groupe 2025 • Système Modulaire Certifié
            </footer>
        </div>
    </div>
  );
};

export default RoleSelection;
