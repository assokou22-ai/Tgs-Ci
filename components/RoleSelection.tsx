
import React from 'react';
import { Role } from '../types.ts';
import BackupStatus from './BackupStatus.tsx';
import BackgroundAnimation from './BackgroundAnimation.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { backupData } from '../services/backupService.ts';
import { ArrowDownTrayIcon } from './icons.tsx';

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

  const handleQuickBackup = () => {
    // Fix: backupData expects a type 'FULL' | 'FINANCE' | 'TECH', the filename is generated internally
    backupData('FULL');
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 text-white relative overflow-hidden">
        <BackgroundAnimation />
        <main className="flex-grow flex flex-col justify-center items-center w-full py-8">
            <div className="text-center mb-12 z-10">
                <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic text-white">RéparerMonMac</h1>
                <p className="mt-4 text-sm md:text-lg text-gray-400 font-bold uppercase tracking-widest">Atelier TGS - Côte d'Ivoire</p>
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
                {isFeatureEnabled('menu_engagements_sav') && (
                    <RoleButton
                        role="Engagements SAV"
                        description="Suivi des promesses de remplacement, prises en charge SAV et relances clients."
                        onSelect={() => onSelectRole('Engagements SAV')}
                    />
                )}
                
                {!isFeatureEnabled('menu_accueil') && !isFeatureEnabled('menu_technicien') && !isFeatureEnabled('menu_editeur') && !isFeatureEnabled('menu_finance') && !isFeatureEnabled('menu_engagements_sav') && (
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
            <footer className="bg-gray-900/90 backdrop-blur-md text-[10px] text-gray-500 py-3 px-6 flex flex-col sm:flex-row justify-between items-center gap-4 uppercase font-black tracking-widest border-t border-gray-800">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-apple-blue shadow-[0_0_8px_#0071e3]"></div>
                    <span>TGS-CI Groupe 2025 • Système Modulaire Certifié</span>
                </div>
                
                <button 
                    onClick={handleQuickBackup}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-apple-muted hover:text-white px-3 py-1.5 rounded-lg border border-white/5 transition-all active:scale-95 group"
                >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                    <span>Archive Flash (JSON)</span>
                </button>
            </footer>
        </div>
    </div>
  );
};

export default RoleSelection;
