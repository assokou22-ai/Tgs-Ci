import React from 'react';
import { Role } from '../types.ts';
import BackupStatus from './BackupStatus.tsx';
import BackgroundAnimation from './BackgroundAnimation.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { backupData } from '../services/backupService.ts';
import { 
    ArrowRight, Download, Sparkles, 
    DoorOpen, Headphones, Cpu, 
    SlidersHorizontal, Receipt, ShieldCheck 
} from 'lucide-react';
import { AppleLogo } from './icons.tsx';
import { CoteDIvoireFlag, BeninFlag } from './Flags.tsx';
import { DeviceProfileSwitchButton } from './DeviceProfileSwitchButton.tsx';
import { DeviceProfileStartupSelector } from './DeviceProfileStartupSelector.tsx';
import { useDeviceProfile } from '../context/DeviceProfileContext.tsx';



interface RoleSelectionProps {
  onSelectRole: (role: Role) => void;
}

interface RoleCardData {
    role: Role;
    featureKey: 'menu_accueil' | 'menu_assistant_clientele' | 'menu_technicien' | 'menu_editeur' | 'menu_finance' | 'menu_engagements_sav';
    title: string;
    subtitle: string;
    description: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    iconBg: string;
    iconColor: string;
    tagLabel?: string;
    tagColor?: string;
    borderGlow: string;
}

const ROLES_CONFIG: RoleCardData[] = [
    {
        role: 'Accueil',
        featureKey: 'menu_accueil',
        title: 'Accueil & Réception',
        subtitle: 'Entrée Atelier & Prise en Charge',
        description: 'Accueil des clients, prise en charge immédiate, fiches de dépôt, signature numérique et programmation des retraits.',
        icon: DoorOpen,
        iconBg: 'bg-blue-500/15 border border-blue-500/30 text-blue-400 group-hover:bg-blue-500 group-hover:text-white',
        iconColor: 'text-blue-400',
        tagLabel: 'Entrée Atelier',
        tagColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        borderGlow: 'hover:border-blue-500/50 hover:shadow-blue-500/10'
    },
    {
        role: 'Assistant Clientèle',
        featureKey: 'menu_assistant_clientele',
        title: 'Assistant(e) Clientèle',
        subtitle: 'Coordination & Rallonges',
        description: 'Suivi des dossiers en cours, gestion des blocages, journal des interventions et relances WhatsApp.',
        icon: Headphones,
        iconBg: 'bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:bg-amber-500 group-hover:text-white',
        iconColor: 'text-amber-400',
        tagLabel: 'Journal & Stylo',
        tagColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        borderGlow: 'hover:border-amber-500/50 hover:shadow-amber-500/10'
    },
    {
        role: 'Technicien',
        featureKey: 'menu_technicien',
        title: 'Atelier Technicien',
        subtitle: 'Micro-électronique & Réparation',
        description: 'Expertise micro-électronique sous stéréomicroscope, relevés de tensions, diagnostics cartes mères et micro-soudure BGA.',
        icon: Cpu,
        iconBg: 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white',
        iconColor: 'text-cyan-400',
        tagLabel: 'Microscope BGA',
        tagColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        borderGlow: 'hover:border-cyan-500/50 hover:shadow-cyan-500/10'
    },
    {
        role: 'Editeur',
        featureKey: 'menu_editeur',
        title: 'Console Superviseur',
        subtitle: 'Régie, Stock & Paramètres',
        description: 'Pilotage complet tel une console de contrôle : gestion des pièces détachées, imprimantes et configuration globale.',
        icon: SlidersHorizontal,
        iconBg: 'bg-purple-500/15 border border-purple-500/30 text-purple-400 group-hover:bg-purple-500 group-hover:text-white',
        iconColor: 'text-purple-400',
        tagLabel: 'Table de Mixage',
        tagColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        borderGlow: 'hover:border-purple-500/50 hover:shadow-purple-500/10'
    },
    {
        role: 'Facture et Commande',
        featureKey: 'menu_finance',
        title: 'Finances & Commandes',
        subtitle: 'Facturation & Fournisseurs',
        description: 'Bordereaux de commande, proformas officielles, factures avec soldes et règlements en Francs CFA.',
        icon: Receipt,
        iconBg: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white',
        iconColor: 'text-emerald-400',
        tagLabel: 'CFA · Bordereau',
        tagColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-bold',
        borderGlow: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10'
    },
    {
        role: 'Engagements SAV',
        featureKey: 'menu_engagements_sav',
        title: 'Engagements SAV',
        subtitle: 'Garanties & Éco-Recyclage',
        description: 'Suivi des ré-interventions par nos techniciens qualifiés, promesses d\'échange et recyclage éco-responsable.',
        icon: ShieldCheck,
        iconBg: 'bg-teal-500/15 border border-teal-500/30 text-teal-400 group-hover:bg-teal-500 group-hover:text-white',
        iconColor: 'text-teal-400',
        tagLabel: 'Recyclage ♻️',
        tagColor: 'bg-teal-500/15 text-teal-200 border-teal-500/40',
        borderGlow: 'hover:border-teal-500/50 hover:shadow-teal-500/10'
    }
];

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  const { isFeatureEnabled } = useAppSettings();
  const { isMobile, isTablet } = useDeviceProfile();

  const handleQuickBackup = () => {
    backupData('FULL');
  };

  const enabledRoles = ROLES_CONFIG.filter(cfg => isFeatureEnabled(cfg.featureKey));

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 md:p-8 text-white relative overflow-hidden bg-[#07080a] selection:bg-apple-blue selection:text-white">
        <BackgroundAnimation />
        
        {/* Top subtle branding strip with Côte d'Ivoire & Bénin flags */}
        <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-2 z-10">
            <div className="flex items-center gap-2.5">
                <AppleLogo className="w-5 h-5 text-white" />
                <span className="text-xs font-bold tracking-tight text-white uppercase">TGS-CI Pro</span>
                <span className="text-zinc-600 text-xs">·</span>
                <span className="text-[11px] text-zinc-400 font-medium">Atelier Spécialisé MacBook</span>
            </div>
            
            <div className="flex items-center gap-3">
                <DeviceProfileSwitchButton />

                {/* Localisation & Drapeaux Côte d'Ivoire & Bénin */}
                <div className="flex flex-col items-end">

                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-bold text-white tracking-wide">Cocody, Abidjan</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-300 font-medium">Côte d'Ivoire</span>
                    <CoteDIvoireFlag className="w-4 h-2.5" />
                    <span className="text-zinc-600 text-[10px]">·</span>
                    <span className="text-[10px] text-zinc-300 font-medium">Bénin</span>
                    <BeninFlag className="w-4 h-2.5" />
                </div>
            </div>
        </div>
        </header>

        {/* Center Main Stage */}
        <main className="flex-grow flex flex-col justify-center items-center w-full max-w-6xl py-4 md:py-8 z-10">
            {/* Title & Kicker */}
            <div className="text-center mb-5 md:mb-6 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-zinc-300 font-medium mb-3 backdrop-blur-sm">
                    <Sparkles className="w-3.5 h-3.5 text-apple-blue" />
                    <span>Système d'Exploitation Atelier 2026</span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                    Sélectionnez votre espace de travail
                </h1>
                <p className="mt-2 text-xs md:text-sm text-zinc-400 font-normal leading-relaxed">
                    Chaque poste dispose d'outils dédiés pour la prise en charge, le diagnostic micro-électronique et la gestion clientèle.
                </p>
            </div>

            {/* SÉLECTEUR DE MODE D'AFFICHAGE AU DÉMARRAGE (ORDINATEUR / TABLETTE / MOBILE) */}
            <DeviceProfileStartupSelector variant="hero" className="mb-6 sm:mb-8" />

            {/* Visual Card Grid adaptatif selon le mode sélectionné */}
            <div className={`w-full grid gap-4 md:gap-5 ${
                isMobile 
                    ? 'grid-cols-1' 
                    : isTablet 
                    ? 'grid-cols-1 sm:grid-cols-2' 
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
                {enabledRoles.map((item) => {
                    const IconComponent = item.icon;
                    return (
                        <button
                            key={item.role}
                            onClick={() => onSelectRole(item.role)}
                            className={`group relative text-left rounded-3xl border border-white/[0.08] bg-[#0d0f14]/80 hover:bg-[#12151c] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl flex flex-col justify-between overflow-hidden backdrop-blur-md min-h-[200px] p-5 sm:p-6 active:scale-[0.98] ${item.borderGlow}`}
                        >
                            {/* Ambient top light gradient */}
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent group-hover:via-apple-blue/60 transition-all duration-500 z-10" />
                            
                            {/* Card Content Top */}
                            <div className="relative z-10">
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    {/* Pure Vector Icon Badge (Instant loading, crisp, super light) */}
                                    <div className={`w-13 h-13 rounded-2xl flex items-center justify-center p-3.5 transition-all duration-300 shadow-md group-hover:scale-110 ${item.iconBg}`}>
                                        <IconComponent className="w-6 h-6" />
                                    </div>

                                    {/* Tag pill */}
                                    {item.tagLabel && (
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border backdrop-blur-md shadow-sm ${item.tagColor}`}>
                                            {item.tagLabel}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1 mt-1">
                                    <h3 className="text-lg font-black text-white group-hover:text-apple-blue transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="text-xs text-zinc-300 font-semibold tracking-wide">
                                        {item.subtitle}
                                    </p>
                                </div>

                                <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed line-clamp-2">
                                    {item.description}
                                </p>
                            </div>

                            {/* Card Bottom CTA */}
                            <div className="relative z-10 mt-5 pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs text-zinc-400 group-hover:text-white transition-colors">
                                <span className="font-medium text-[11px]">Accéder au module</span>
                                <span className="font-mono text-xs font-bold text-apple-blue group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    <span>Ouvrir</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {enabledRoles.length === 0 && (
                <div className="p-8 text-center bg-red-950/20 border border-red-900/50 rounded-2xl max-w-md mx-auto">
                    <p className="text-red-400 font-bold text-sm">Tous les modules sont actuellement désactivés.</p>
                    <p className="text-xs text-zinc-500 mt-2">Veuillez réactiver les modules dans la configuration de l'établissement.</p>
                </div>
            )}
        </main>
        
        {/* Bottom Status & Licence Bar */}
        <div className="w-full max-w-6xl z-10">
            <div className="bg-[#0f1115]/60 backdrop-blur-md rounded-2xl border border-white/[0.07] p-4 shadow-xl">
                <BackupStatus />
            </div>
            
            <footer className="text-[11px] text-zinc-500 py-4 px-2 flex flex-col sm:flex-row justify-between items-center gap-3 font-medium">
                <div className="flex items-center gap-2">
                    <CoteDIvoireFlag className="w-4 h-2.5 shrink-0" />
                    <BeninFlag className="w-4 h-2.5 shrink-0" />
                    <span>Licence d'exploitation : TGSCI Informatique, Hautes Réparations Spécialisées à Abidjan, société ivoiro-béninoise</span>
                </div>
                
                <button 
                    onClick={handleQuickBackup}
                    className="flex items-center gap-2 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-white/[0.06] transition-all active:scale-95 text-xs"
                >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sauvegarde Rapide (JSON)</span>
                </button>
            </footer>
        </div>
    </div>
  );
};

export default RoleSelection;
