
import React, { useState } from 'react';
import { useAppSettings, AppSettings } from '../hooks/useAppSettings.ts';
import { ThemeType, FeatureId } from '../types.ts';
import { SparklesIcon, BuildingStorefrontIcon, ShieldCheckIcon, AcademicCapIcon, BanknotesIcon, DocumentDuplicateIcon } from './icons.tsx';
import { generateAiTheme } from '../services/aiThemeService.ts';

const ToggleSwitch: React.FC<{ label: string; isEnabled: boolean; onToggle: () => void; colorClass?: string }> = ({ label, isEnabled, onToggle, colorClass = 'bg-blue-600' }) => (
    <div className="flex items-center justify-between p-3 bg-gray-700/40 border border-gray-700 rounded-md">
        <span className="text-white text-sm font-bold">{label}</span>
        <button
            type="button"
            onClick={onToggle}
            className={`relative inline-flex items-center h-5 rounded-full w-10 transition-colors ${isEnabled ? colorClass : 'bg-gray-600'}`}
        >
            <span
                className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    </div>
);

const FeatureControlRow: React.FC<{ 
    id: FeatureId; 
    label: string; 
    enabled: boolean; 
    session: boolean; 
    onToggleEnabled: () => void; 
    onToggleSession: () => void 
}> = ({ label, enabled, session, onToggleEnabled, onToggleSession }) => (
    <div className={`p-3 border rounded-lg transition-all ${enabled ? 'bg-gray-800/80 border-gray-600' : 'bg-gray-900/40 border-gray-800 opacity-60'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                <span className="text-sm font-black text-white uppercase tracking-tighter">{label}</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Actif</span>
                    <button onClick={onToggleEnabled} className={`relative inline-flex items-center h-4 rounded-full w-8 transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-600'}`}>
                        <span className={`inline-block w-2.5 h-2.5 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Session requise</span>
                    <button onClick={onToggleSession} className={`relative inline-flex items-center h-4 rounded-full w-8 transition-colors ${session ? 'bg-purple-600' : 'bg-gray-600'}`}>
                        <span className={`inline-block w-2.5 h-2.5 transform bg-white rounded-full transition-transform ${session ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const AppSettingsManager: React.FC = () => {
    const { settings, updateSettings, toggleFeature } = useAppSettings();
    const [isGenerating, setIsGenerating] = useState(false);

    const handleToggle = <K extends keyof AppSettings>(category: K, key: keyof AppSettings[K]) => {
        updateSettings(category, { [key]: !settings[category][key] } as any);
    };

    const handleThemeChange = (theme: ThemeType) => {
        updateSettings('theme', theme);
    };

    const handleAiTheme = async () => {
        setIsGenerating(true);
        try {
            const palette = await generateAiTheme();
            updateSettings('customPalette', palette);
            updateSettings('theme', 'ia-aleatoire');
        } catch (error) {
            alert("Échec de la génération du thème IA.");
        } finally {
            setIsGenerating(false);
        }
    };

    const themeOptions: { id: ThemeType; label: string; colors: string[] }[] = [
        { id: 'system', label: 'Système', colors: ['#3b82f6', '#1f2937'] },
        { id: 'blanc-noir-bleu', label: 'Contrast B/N/B', colors: ['#ffffff', '#000000', '#2563eb'] },
        { id: 'blanc-vert-bleu', label: 'Nature', colors: ['#ffffff', '#10b981', '#0369a1'] },
        { id: 'blanc-bleu-noir', label: 'Océan', colors: ['#ffffff', '#0ea5e9', '#0f172a'] },
        { id: 'professionnel', label: 'Elite Pro', colors: ['#ffffff', '#000000', '#4b5563'] },
    ];

    const featureGroups: { title: string; icon: any; color: string; items: { id: FeatureId; label: string }[] }[] = [
        {
            title: "Navigation Principale (Menus)",
            icon: BuildingStorefrontIcon,
            color: "text-blue-500",
            items: [
                { id: 'menu_accueil', label: 'Tableau Accueil' },
                { id: 'menu_technicien', label: 'Espace Technicien' },
                { id: 'menu_editeur', label: 'Console Éditeur' },
                { id: 'menu_finance', label: 'Gestion Finance' },
            ]
        },
        {
            title: "Outils d'Intelligence Artificielle",
            icon: SparklesIcon,
            color: "text-purple-500",
            items: [
                { id: 'tool_ai_reports', label: 'Rapports IA d\'activité' },
                { id: 'tool_ai_diag', label: 'Aide au Diagnostic' },
                { id: 'tool_ai_price', label: 'Estimation de prix IA' },
                { id: 'tool_ai_correction', label: 'Correction Orthographique' },
                { id: 'tool_ai_search', label: 'Recherche Sémantique Documents' },
            ]
        },
        {
            title: "Modules de Gestion Opérationnelle",
            icon: AcademicCapIcon,
            color: "text-green-500",
            items: [
                { id: 'mod_stock', label: 'Gestion de Stock' },
                { id: 'mod_clients', label: 'Fichier Clients' },
                { id: 'mod_documents', label: 'Courriers & Documents' },
                { id: 'mod_knowledge', label: 'Base de Connaissances' },
                { id: 'mod_multimedia', label: 'Module Multimédia (Preuves)' },
                { id: 'mod_appointments', label: 'Gestion des Rendez-vous' },
            ]
        },
        {
            title: "Outils Administratifs & Sécurité",
            icon: ShieldCheckIcon,
            color: "text-red-500",
            items: [
                { id: 'mod_backup', label: 'Système de Sauvegarde' },
                { id: 'mod_exports', label: 'Exports Excel/PDF' },
                { id: 'mod_legal_folder', label: 'Dossier Juridique Complet' },
                { id: 'mod_diagnostic_b', label: 'Expertise Électronique (B)' },
            ]
        }
    ];

    return (
        <div className="space-y-8 pb-20">
            {/* 1. ARCHITECTURE ET MODULARITÉ */}
            <section className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                            <ShieldCheckIcon className="w-8 h-8 text-blue-500" />
                            Architecture & Modularité du Logiciel
                        </h2>
                        <p className="text-sm text-gray-400">Mode "Super-Admin" : Activez ou désactivez chaque brique de l'application selon vos besoins actuels.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {featureGroups.map((group, gIdx) => (
                        <div key={gIdx} className="space-y-3 bg-gray-900/30 p-5 rounded-xl border border-gray-700/50">
                            <h3 className={`text-xs font-black uppercase flex items-center gap-2 mb-4 ${group.color}`}>
                                <group.icon className="w-4 h-4" />
                                {group.title}
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {group.items.map(feature => (
                                    <FeatureControlRow 
                                        key={feature.id}
                                        id={feature.id}
                                        label={feature.label}
                                        enabled={settings.features.enabled[feature.id]}
                                        session={settings.features.requireSession[feature.id]}
                                        onToggleEnabled={() => toggleFeature(feature.id, 'enabled')}
                                        onToggleSession={() => toggleFeature(feature.id, 'requireSession')}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 2. PERSONNALISATION GRAPHIQUE */}
            <section className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <SparklesIcon className="w-6 h-6 text-yellow-500" />
                    Interface & Design Visuel
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {themeOptions.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => handleThemeChange(opt.id)}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                                settings.theme === opt.id ? 'border-blue-500 bg-blue-600/10' : 'border-gray-700 bg-gray-900/40 hover:border-gray-600'
                            }`}
                        >
                            <div className="flex gap-1">
                                {opt.colors.map((c, i) => (
                                    <div key={i} className="w-4 h-4 rounded-full border border-gray-600" style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <span className="text-[10px] font-black uppercase text-center text-white">{opt.label}</span>
                        </button>
                    ))}

                    <button
                        onClick={handleAiTheme}
                        disabled={isGenerating}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 group ${
                            settings.theme === 'ia-aleatoire' ? 'border-purple-500 bg-purple-600/10' : 'border-gray-700 bg-gray-900/40 hover:border-purple-800/50'
                        }`}
                    >
                        {isGenerating ? (
                            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <SparklesIcon className="w-5 h-5 text-purple-400 group-hover:scale-125 transition-transform" />
                        )}
                        <span className="text-[10px] font-black uppercase text-center text-purple-300">Magie IA</span>
                    </button>
                </div>
            </section>

            {/* 3. RÉGLAGES MÉTIER */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="font-black text-xs text-gray-500 uppercase mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                        <DocumentDuplicateIcon className="w-4 h-4" /> Formulaires
                    </h3>
                    <div className="space-y-3">
                        <ToggleSwitch label="Afficher Emails clients" isEnabled={settings.forms.showClientEmail} onToggle={() => handleToggle('forms', 'showClientEmail')} />
                        <ToggleSwitch label="Afficher Détails machine" isEnabled={settings.forms.showMachineDetails} onToggle={() => handleToggle('forms', 'showMachineDetails')} />
                    </div>
                </div>
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="font-black text-xs text-gray-500 uppercase mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                        <AcademicCapIcon className="w-4 h-4" /> Gestion Stock
                    </h3>
                    <div className="space-y-3">
                        <ToggleSwitch label="Colonnes Références" isEnabled={settings.stock.showReference} onToggle={() => handleToggle('stock', 'showReference')} />
                        <ToggleSwitch label="Colonnes Coûts Achat" isEnabled={settings.stock.showCost} onToggle={() => handleToggle('stock', 'showCost')} />
                    </div>
                </div>
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="font-black text-xs text-gray-500 uppercase mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                        <BanknotesIcon className="w-4 h-4" /> Impression
                    </h3>
                    <div className="space-y-3">
                        <ToggleSwitch label="Notes Technicien" isEnabled={settings.print.showTechnicianNotes} onToggle={() => handleToggle('print', 'showTechnicianNotes')} />
                        <ToggleSwitch label="Rapport de diag." isEnabled={settings.print.showDiagnosticReport} onToggle={() => handleToggle('print', 'showDiagnosticReport')} />
                        <ToggleSwitch label="Diagnostic sur page 2" isEnabled={settings.print.diagnosticOnSeparatePage} onToggle={() => handleToggle('print', 'diagnosticOnSeparatePage')} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppSettingsManager;
