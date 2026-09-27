import React, { useState, useEffect } from 'react';
import { useAppSettings, AppSettings, PrinterConfig } from '../hooks/useAppSettings.ts';
import { ThemeType, FeatureId } from '../types.ts';
import { 
    Store, 
    Printer, 
    Smartphone, 
    Cpu, 
    Sliders, 
    FileText, 
    Palette, 
    Plus, 
    Trash2, 
    Edit2, 
    Check, 
    CheckCircle, 
    ShieldCheck,
    Activity,
    SlidersHorizontal,
    Sparkles,
    Briefcase,
    DollarSign,
    Lock
} from 'lucide-react';
import { generateAiTheme } from '../services/aiThemeService.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import Modal from './Modal.tsx';

const ToggleSwitch: React.FC<{ label: string; description?: string; isEnabled: boolean; onToggle: () => void; colorClass?: string }> = ({ label, description, isEnabled, onToggle, colorClass = 'bg-blue-600' }) => (
    <div className="flex items-center justify-between p-4 bg-gray-900/30 border border-gray-700/60 rounded-xl transition-all hover:border-gray-600">
        <div className="flex flex-col text-left">
            <span className="text-white text-sm font-bold">{label}</span>
            {description && <span className="text-gray-400 text-xs mt-0.5">{description}</span>}
        </div>
        <button
            type="button"
            onClick={onToggle}
            className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors duration-200 focus:outline-none ${isEnabled ? colorClass : 'bg-gray-700'}`}
        >
            <span
                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ${isEnabled ? 'translate-x-7' : 'translate-x-1'}`}
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
    <div className={`p-3.5 border rounded-xl transition-all ${enabled ? 'bg-gray-800/80 border-gray-600/80 hover:border-gray-500' : 'bg-gray-900/40 border-gray-850 opacity-60'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500'}`}></div>
                <span className="text-xs font-black text-white uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-center gap-4 self-end sm:self-auto">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-gray-500 uppercase">Actif</span>
                    <button onClick={onToggleEnabled} className={`relative inline-flex items-center h-4 rounded-full w-8 transition-colors focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-gray-700'}`}>
                        <span className={`inline-block w-2.5 h-2.5 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Session
                    </span>
                    <button onClick={onToggleSession} className={`relative inline-flex items-center h-4 rounded-full w-8 transition-colors focus:outline-none ${session ? 'bg-purple-600' : 'bg-gray-700'}`}>
                        <span className={`inline-block w-2.5 h-2.5 transform bg-white rounded-full transition-transform ${session ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const AppSettingsManager: React.FC = () => {
    const { showToast } = useToastContext();
    const { settings, updateSettings, toggleFeature } = useAppSettings();
    
    // Core state managers
    const [activeTab, setActiveTab] = useState<'biz' | 'hardware' | 'device' | 'features' | 'clauses' | 'design'>('biz');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Clauses local state
    const [clauseToDelete, setClauseToDelete] = useState<number | null>(null);
    const [clauseToEdit, setClauseToEdit] = useState<{ index: number | null, text: string } | null>(null);

    // Printers local state
    const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
    const [isAddingPrinter, setIsAddingPrinter] = useState(false);
    const [printerForm, setPrinterForm] = useState<Partial<PrinterConfig>>({
        name: '',
        type: 'thermal_80',
        connection: 'browser',
        address: '',
        marginOffset: 0,
        fontContrast: 'standard',
        isDefaultTickets: false,
        isDefaultInvoices: false
    });
    
    // Testing printing logs
    const [testPrintLogs, setTestPrintLogs] = useState<string | null>(null);

    // Live Device Detection State
    const [deviceProfile, setDeviceProfile] = useState<{ os: string; isMobile: boolean; isPhone: boolean; isTablet: boolean; browser: string }>({
        os: 'Détection...',
        isMobile: false,
        isPhone: false,
        isTablet: false,
        browser: 'Navigateur'
    });

    useEffect(() => {
        const ua = navigator.userAgent;
        let os = "Système d'exploitation Standard";
        let isMobile = false;
        let isPhone = false;
        let isTablet = false;

        if (/windows/i.test(ua)) os = "Windows PC / Workstation";
        else if (/macintosh|mac os x/i.test(ua)) os = "MacBook / Apple macOS";
        else if (/linux/i.test(ua)) os = "GNU/Linux Operating System";
        else if (/android/i.test(ua)) {
            os = "Android Device";
            isMobile = true;
            if (/mobile/i.test(ua)) isPhone = true;
            else isTablet = true;
        }
        else if (/iphone|ipad|ipod/i.test(ua)) {
            isMobile = true;
            if (/ipad/i.test(ua)) {
                os = "Apple iPad (iPadOS)";
                isTablet = true;
            } else {
                os = "Apple iPhone (iOS)";
                isPhone = true;
            }
        }

        const browser = /chrome/i.test(ua) ? "Google Chrome" 
            : /safari/i.test(ua) ? "Apple Safari" 
            : /firefox/i.test(ua) ? "Mozilla Firefox" 
            : "Navigateur Web";

        setDeviceProfile({ os, isMobile, isPhone, isTablet, browser });
    }, []);

    const handleToggle = <K extends keyof AppSettings>(category: K, key: keyof AppSettings[K]) => {
        updateSettings(category, { [key]: !settings[category][key] } as Partial<AppSettings[K]>);
    };

    const handleThemeChange = (theme: ThemeType) => {
        updateSettings('theme', theme);
        showToast(`Thème visuel '${theme}' activé`, "success");
    };

    const handleAiTheme = async () => {
        setIsGenerating(true);
        try {
            const palette = await generateAiTheme();
            updateSettings('customPalette', palette);
            updateSettings('theme', 'ia-aleatoire');
            showToast("Thème IA généré avec succès !", "success");
        } catch {
            showToast("Échec de la génération du thème IA.", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    // Workshop bindings
    const handleWorkshopChange = (key: keyof AppSettings['workshop'], val: string | number) => {
        updateSettings('workshop', { [key]: val });
    };

    // Profile quick optimizations setup
    const applyProfilePreset = (type: 'phone' | 'mac' | 'windows') => {
        if (type === 'phone') {
            updateSettings('device', {
                touchMode: true,
                keyboardShortcuts: false,
                imageCompression: true,
                lowDataMode: true,
                density: 'normal',
                autoFocusSearch: false
            });
            showToast("Mode tactile, compression d'image et économie d'énergie activés !", "success");
        } else if (type === 'mac') {
            updateSettings('device', {
                touchMode: false,
                keyboardShortcuts: true,
                forceMobileView: false,
                imageCompression: false,
                lowDataMode: false,
                density: 'condensed',
                autoFocusSearch: true
            });
            showToast("Modificateurs macOS (Command-key), haute densité et autofocus activés !", "success");
        } else {
            updateSettings('device', {
                touchMode: false,
                keyboardShortcuts: true,
                forceMobileView: false,
                imageCompression: false,
                lowDataMode: false,
                density: 'condensed',
                autoFocusSearch: true
            });
            showToast("Mode Bureau Standard + Clavier Windows activés !", "success");
        }
    };

    // Printers database actions
    const handleAddPrinterClick = () => {
        setPrinterForm({
            name: '',
            type: 'thermal_80',
            connection: 'browser',
            address: '',
            marginOffset: 0,
            fontContrast: 'standard',
            isDefaultTickets: false,
            isDefaultInvoices: false
        });
        setEditingPrinterId(null);
        setIsAddingPrinter(true);
    };

    const handleEditPrinter = (printer: PrinterConfig) => {
        setPrinterForm({ ...printer });
        setEditingPrinterId(printer.id);
        setIsAddingPrinter(true);
    };

    const handleSavePrinter = () => {
        if (!printerForm.name?.trim()) {
            showToast("Veuillez saisir un nom pour l'imprimante.", "error");
            return;
        }

        const id = editingPrinterId || `printer_${Date.now()}`;
        const newPrinterData: PrinterConfig = {
            id,
            name: printerForm.name.trim(),
            type: printerForm.type || 'thermal_80',
            connection: printerForm.connection || 'browser',
            address: printerForm.address?.trim() || '',
            marginOffset: Number(printerForm.marginOffset) || 0,
            fontContrast: printerForm.fontContrast || 'standard',
            isDefaultTickets: !!printerForm.isDefaultTickets,
            isDefaultInvoices: !!printerForm.isDefaultInvoices
        };

        let currentPrinters = [...(settings.printers || [])];

        // Clean double defaults
        if (newPrinterData.isDefaultTickets) {
            currentPrinters = currentPrinters.map(p => p.id === id ? p : { ...p, isDefaultTickets: false });
        }
        if (newPrinterData.isDefaultInvoices) {
            currentPrinters = currentPrinters.map(p => p.id === id ? p : { ...p, isDefaultInvoices: false });
        }

        const existsIdx = currentPrinters.findIndex(p => p.id === id);
        if (existsIdx > -1) {
            currentPrinters[existsIdx] = newPrinterData;
            showToast("Configuration imprimante mise à jour", "success");
        } else {
            currentPrinters.push(newPrinterData);
            showToast("Nouvelle imprimante ajoutée !", "success");
        }

        updateSettings('printers', currentPrinters);
        setIsAddingPrinter(false);
    };

    const handleDeletePrinter = (id: string) => {
        const filtered = (settings.printers || []).filter(p => p.id !== id);
        updateSettings('printers', filtered);
        showToast("Imprimante supprimée du registre", "success");
    };

    // ESC/POS Thermal simulator test printer
    const handleTestPrint = (printer: PrinterConfig) => {
        let protocol = "";

        if (printer.connection === 'browser') protocol = "Spooler d'Impression Système Windows / AirPrint HTML";
        else if (printer.connection === 'network') protocol = `Socket Raw TCP sur ${printer.address || '192.168.1.100'}:9100`;
        else if (printer.connection === 'bluetooth') protocol = `Série Bluetooth (RFCOMM) vers ${printer.address || 'XX:XX:XX:XX'}`;
        else protocol = "Liaison Directe USB / Port COM Virtuel Intel";

        const nowText = new Date().toLocaleString('fr-FR');
        let rawContent = `============ SÉRIE DE TEST ESC/POS ============\n`;
        rawContent += `IMP: ${printer.name.toUpperCase()}\n`;
        rawContent += `INTERFACE : ${printer.connection.toUpperCase()} (${protocol})\n`;
        rawContent += `FORMAT DE PAPIER : ${printer.type === 'office_a4' ? 'Page A4 Standard' : printer.type === 'thermal_58' ? 'Thermique 58mm' : 'Thermique Coquille 80mm'}\n`;
        rawContent += `CORRECTION DE MARGES : +${printer.marginOffset || 0}mm\n`;
        rawContent += `DENSITÉ D'ENCRE : ${printer.fontContrast?.toUpperCase() || 'STANDARD'}\n`;
        rawContent += `DATE ET HEURE DU TEST : ${nowText}\n`;
        rawContent += `------------------------------------------------\n`;
        rawContent += `       [LOGO APPLE CENTRÉ DANS LE PIED]\n`;
        rawContent += `    🌟 RECONNEXION MATÉRIEL RÉUSSIE ! 🌟\n`;
        rawContent += `\n`;
        rawContent += `Diagnostic MacBook  -  Fiche #12547\n`;
        rawContent += `Modèle : MacBook Pro M2 A2779 (16 pouces)\n`;
        rawContent += `Solde à régler : 45 000 ${settings.workshop.currency}\n`;
        rawContent += `------------------------------------------------\n`;
        rawContent += `    Merci pour votre confiance avec ${settings.workshop.name}!\n`;
        rawContent += `      ${settings.workshop.phone} | ${settings.workshop.email}\n`;
        rawContent += `================================================\n`;
        rawContent += `[CODE RETOUR CHARION - ESC d 3 - COUPE PAPIER]`;

        setTestPrintLogs(rawContent);
    };

    // Clauses manager dynamic handlers
    const addClause = () => {
        setClauseToEdit({ index: null, text: '' });
    };

    const removeClause = (index: number) => {
        setClauseToDelete(index);
    };

    const confirmRemoveClause = () => {
        if (clauseToDelete !== null) {
            const newClauses = [...settings.clauses];
            newClauses.splice(clauseToDelete, 1);
            updateSettings('clauses', newClauses);
            setClauseToDelete(null);
            showToast("Clause contractuelle retirée", "success");
        }
    };

    const editClause = (index: number) => {
        setClauseToEdit({ index: index, text: settings.clauses[index] });
    };

    const saveClause = () => {
        if (!clauseToEdit || !clauseToEdit.text.trim()) return;
        
        const newClauses = [...settings.clauses];
        if (clauseToEdit.index !== null) {
            newClauses[clauseToEdit.index] = clauseToEdit.text.trim();
        } else {
            newClauses.push(clauseToEdit.text.trim());
        }
        updateSettings('clauses', newClauses);
        setClauseToEdit(null);
        showToast("Clause enregistrée avec succès !", "success");
    };

    // Constants Themes
    const themeOptions: { id: ThemeType; label: string; colors: string[] }[] = [
        { id: 'vga-classic', label: 'VGA/CRT', colors: ['#0000FF', '#D4D0C8'] },
        { id: 'clair', label: 'Clair Moderne', colors: ['#007AFF', '#F5F5F7'] },
        { id: 'sombre', label: 'Sombre Épuré', colors: ['#0A84FF', '#1C1C1E'] },
        { id: 'bleu-apple', label: 'Bleu Premium', colors: ['#0056D2', '#F0F4F8'] },
        { id: 'monochrome', label: 'Monochrome Tech', colors: ['#3b82f6', '#111827'] },
        { id: 'system', label: 'Système OS', colors: ['#3b82f6', '#1f2937'] },
    ];

    const featureGroups: { title: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; color: string; items: { id: FeatureId; label: string }[] }[] = [
        {
            title: "Navigation Principale (Menus)",
            icon: SlidersHorizontal,
            color: "text-blue-500",
            items: [
                { id: 'menu_accueil', label: 'Tableau d\'Accueil' },
                { id: 'menu_technicien', label: 'Espace Technicien' },
                { id: 'menu_editeur', label: 'Console Éditeur' },
                { id: 'menu_finance', label: 'Gestion Finance' },
            ]
        },
        {
            title: "Outils d'Intelligence Artificielle",
            icon: Sparkles,
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
            icon: Briefcase,
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
            icon: ShieldCheck,
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
        <div className="space-y-6 pb-20 text-left">
            
            {/* Dynamic Dashboard Tab Navigation */}
            <div className="flex border-b border-gray-850 overflow-x-auto flex-nowrap scrollbar-none gap-1 bg-gray-900/30 p-1.5 rounded-2xl border border-gray-800">
                <button
                    onClick={() => { setActiveTab('biz'); setTestPrintLogs(null); }}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeTab === 'biz' 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                >
                    <Store className="w-4 h-4" />
                    Établissement & Facturation
                </button>
                <button
                    onClick={() => { setActiveTab('hardware'); setTestPrintLogs(null); }}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeTab === 'hardware' 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                >
                    <Printer className="w-4 h-4" />
                    Matériel & Imprimantes
                </button>
                <button
                    onClick={() => { setActiveTab('device'); setTestPrintLogs(null); }}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeTab === 'device' 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                >
                    <Smartphone className="w-4 h-4" />
                    Optimisation Système ({deviceProfile.isMobile ? 'Mobile' : 'Bureau'})
                </button>
                <button
                    onClick={() => { setActiveTab('features'); setTestPrintLogs(null); }}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeTab === 'features' 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                >
                    <Sliders className="w-4 h-4" />
                    Modularité Super-Admin
                </button>
                <button
                    onClick={() => { setActiveTab('clauses'); setTestPrintLogs(null); }}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeTab === 'clauses' 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    Mentions Légales
                </button>
                <button
                    onClick={() => { setActiveTab('design'); setTestPrintLogs(null); }}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeTab === 'design' 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                >
                    <Palette className="w-4 h-4" />
                    Thèmes & Mode Zen
                </button>
            </div>

            {/* TAB 1: BUSINESS IDENTITY & METRIC SETTINGS */}
            {activeTab === 'biz' && (
                <div className="space-y-6 animate-fade-in">
                    <section className="bg-gray-800/50 p-6 rounded-2xl shadow-xl border border-gray-700/80 space-y-5">
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2.5">
                                <Store className="w-5 h-5 text-blue-500" /> Identité Globale de l'Atelier
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">Saisissez les informations de votre entreprise. Elles apparaîtront instantanément sur toutes les fiches de dépôt, reçus, bons de sortie et dossiers juridiques.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Nom commercial de l'Atelier / En-tête</label>
                                <input 
                                    type="text" 
                                    value={settings.workshop?.name || 'TGS-CI'} 
                                    onChange={(e) => handleWorkshopChange('name', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                    placeholder="Ex: TGS - CÔTE D'IVOIRE"
                                />
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Numéro de Téléphone / Standard</label>
                                <input 
                                    type="text" 
                                    value={settings.workshop?.phone || '+225 07 57 13 35 07'} 
                                    onChange={(e) => handleWorkshopChange('phone', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    placeholder="Ex: +225 07 57 13 35 07"
                                />
                            </div>
                            <div className="space-y-1.5 text-left md:col-span-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Adresse Physique complète de l'Établissement</label>
                                <input 
                                    type="text" 
                                    value={settings.workshop?.address || 'Cocody Faya, Carrefour Coq Ivoir, Abidjan'} 
                                    onChange={(e) => handleWorkshopChange('address', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold"
                                    placeholder="Ex: Deux Plateaux, Boulevard des Martyrs, Abidjan"
                                />
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Adresse E-mail de Contact</label>
                                <input 
                                    type="email" 
                                    value={settings.workshop?.email || 'contact@tgs-ci.com'} 
                                    onChange={(e) => handleWorkshopChange('email', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    placeholder="Ex: contact@votrecommerce.com"
                                />
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Registre du Commerce / Matricule Fiscale (RCCM)</label>
                                <input 
                                    type="text" 
                                    value={settings.workshop?.register || ''} 
                                    onChange={(e) => handleWorkshopChange('register', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-xs"
                                    placeholder="Ex: RCCM CI-ABJ-03-2023-B13-05421"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-gray-800/50 p-6 rounded-2xl shadow-xl border border-gray-700/80 space-y-5">
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2.5">
                                <DollarSign className="w-5 h-5 text-emerald-500" /> Options de Facturation & Devises
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">Configurez les paramètres monétaires et taux d'imposition globaux.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Devise Monétaire Actuelle</label>
                                <input 
                                    type="text" 
                                    value={settings.workshop?.currency || 'F CFA'} 
                                    onChange={(e) => handleWorkshopChange('currency', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-extrabold text-blue-400 text-center uppercase"
                                    placeholder="F CFA, €, $, etc."
                                />
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">TVA Default (%)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={settings.workshop?.tvaRate ?? 18} 
                                        onChange={(e) => handleWorkshopChange('tvaRate', Number(e.target.value))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-right font-mono"
                                        placeholder="18"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-500 text-xs font-bold">
                                        %
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Garantie par Défaut (Mois)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={settings.workshop?.defaultWarrantyMonths ?? 3} 
                                        onChange={(e) => handleWorkshopChange('defaultWarrantyMonths', Number(e.target.value))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-center font-bold"
                                        placeholder="3"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Standard items toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-800/40 p-5 rounded-xl border border-gray-700/80 shadow-lg">
                            <h3 className="font-black text-xs text-blue-400 uppercase mb-4 border-b border-gray-700/50 pb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Formulaires
                            </h3>
                            <div className="space-y-3">
                                <ToggleSwitch label="Afficher Emails clients" isEnabled={settings.forms.showClientEmail} onToggle={() => handleToggle('forms', 'showClientEmail')} />
                                <ToggleSwitch label="Afficher Détails machine" isEnabled={settings.forms.showMachineDetails} onToggle={() => handleToggle('forms', 'showMachineDetails')} />
                                <ToggleSwitch label="Ajouter automatiquement à Google Contacts" isEnabled={settings.forms.autoCreateGoogleContact} onToggle={() => handleToggle('forms', 'autoCreateGoogleContact')} />
                            </div>
                        </div>
                        <div className="bg-gray-800/40 p-5 rounded-xl border border-gray-700/80 shadow-lg">
                            <h3 className="font-black text-xs text-emerald-400 uppercase mb-4 border-b border-gray-700/50 pb-2 flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Gestion Stock
                            </h3>
                            <div className="space-y-3">
                                <ToggleSwitch label="Colonnes Références" isEnabled={settings.stock.showReference} onToggle={() => handleToggle('stock', 'showReference')} />
                                <ToggleSwitch label="Colonnes Coûts Achat" isEnabled={settings.stock.showCost} onToggle={() => handleToggle('stock', 'showCost')} />
                            </div>
                        </div>
                        <div className="bg-gray-800/40 p-5 rounded-xl border border-gray-700/80 shadow-lg">
                            <h3 className="font-black text-xs text-amber-500 uppercase mb-4 border-b border-gray-700/50 pb-2 flex items-center gap-2">
                                <Printer className="w-4 h-4" /> Impression
                            </h3>
                            <div className="space-y-3">
                                <ToggleSwitch label="Notes Technicien" isEnabled={settings.print.showTechnicianNotes} onToggle={() => handleToggle('print', 'showTechnicianNotes')} />
                                <ToggleSwitch label="Rapport de diag." isEnabled={settings.print.showDiagnosticReport} onToggle={() => handleToggle('print', 'showDiagnosticReport')} />
                                <ToggleSwitch label="Diag. page séparée" isEnabled={settings.print.diagnosticOnSeparatePage} onToggle={() => handleToggle('print', 'diagnosticOnSeparatePage')} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PRINTER CONFIGURATION LIST */}
            {activeTab === 'hardware' && (
                <div className="space-y-6 animate-fade-in">
                    <section className="bg-gray-800/50 p-6 rounded-2xl shadow-xl border border-gray-700/80 space-y-5">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2.5">
                                    <Printer className="w-5 h-5 text-blue-500" /> Gestionnaire d'Imprimantes Multicanal
                                </h2>
                                <p className="text-xs text-gray-400 mt-1">
                                    Enregistrez toutes sortes d'imprimantes (A4 de bureau, Thermique 80mm ESC/POS, Portative 58mm mobile Bluetooth, ou Zebra d'étiquettes) pour le réseau ou l'accès local.
                                </p>
                            </div>
                            <button
                                onClick={handleAddPrinterClick}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all self-start sm:self-auto"
                            >
                                <Plus className="w-4 h-4" /> Connecter un matériel
                            </button>
                        </div>

                        {/* List of custom registered printers */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(settings.printers || []).map((p) => (
                                <div key={p.id} className="p-4 bg-gray-900/40 border border-gray-700/80 rounded-xl flex flex-col justify-between hover:border-gray-600 transition-all">
                                    <div className="space-y-2 text-left">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-black text-sm text-white flex items-center gap-2">
                                                <Printer className="w-4 h-4 text-blue-400" /> {p.name}
                                            </h3>
                                            <div className="flex gap-1.5">
                                                {p.isDefaultTickets && (
                                                    <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Reçus</span>
                                                )}
                                                {p.isDefaultInvoices && (
                                                    <span className="text-[9px] font-black uppercase text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">Factures A4</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs font-medium text-gray-400 pt-1.5 border-t border-gray-800">
                                            <div>Format : <span className="text-white font-semibold">
                                                {p.type === 'office_a4' ? 'Bureau A4' 
                                                 : p.type === 'thermal_80' ? 'Thermique 80mm' 
                                                 : p.type === 'thermal_58' ? 'Thermique 58mm'
                                                 : p.type === 'labels_zebra' ? 'Zebra Labels' 
                                                 : 'Générique'}
                                            </span></div>
                                            <div>Liaison : <span className="text-white font-semibold">
                                                {p.connection === 'browser' ? 'Navigateur standard' 
                                                 : p.connection === 'network' ? 'IP LAN Réseau' 
                                                 : p.connection === 'bluetooth' ? 'Bluetooth' 
                                                 : 'Câble USB'}
                                            </span></div>
                                            {p.address && (
                                                <div className="col-span-2 truncate">Adresse : <span className="text-blue-400 font-mono text-xs">{p.address}</span></div>
                                            )}
                                            <div className="col-span-2 text-[10px] text-gray-500">
                                                Marges : +{p.marginOffset || 0}mm • Contraste : {p.fontContrast || 'standard'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-800">
                                        <button 
                                            onClick={() => handleTestPrint(p)}
                                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                        >
                                            Impression Test
                                        </button>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => handleEditPrinter(p)}
                                                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-all"
                                                title="Modifier"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePrinter(p.id)}
                                                className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-rose-500 transition-all"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {(settings.printers || []).length === 0 && (
                                <div className="col-span-2 text-center py-10 bg-gray-900/20 border border-dashed border-gray-700/50 rounded-2xl">
                                    <p className="text-sm font-semibold text-gray-400">Aucune imprimante connectée</p>
                                    <p className="text-xs text-gray-600 mt-1">Ajoutez votre premier équipement d'impression ci-dessus.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Simulation logs of the last ESC/POS test printed result */}
                    {testPrintLogs && (
                        <div className="bg-gray-950 border border-emerald-500/30 p-5 rounded-2xl font-mono text-xs space-y-3 shadow-2xl relative animate-fade-in text-left">
                            <span className="absolute top-4 right-4 text-[9px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" /> SIMULATEUR CONNECTÉ
                            </span>
                            <h3 className="text-white font-black text-xs uppercase flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-400" /> Tampon de Commande d'Impression (ESC/POS Spool)
                            </h3>
                            <pre className="text-emerald-500/90 whitespace-pre-wrap overflow-x-auto bg-black/50 p-4 rounded-xl border border-gray-900 max-h-64 leading-relaxed font-semibold">
                                {testPrintLogs}
                            </pre>
                            <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1">
                                <span>Flux généré pour ESC/POS direct-out</span>
                                <button 
                                    onClick={() => setTestPrintLogs(null)}
                                    className="text-xs text-gray-400 hover:text-white underline font-bold"
                                >
                                    Fermer la console de test
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL / NESTED CARD FOR ADDING - EDITING PRINTER */}
                    {isAddingPrinter && (
                        <div className="p-6 bg-gray-800 rounded-2xl border border-gray-700 space-y-5 animate-fade-in text-left">
                            <h3 className="text-base font-black text-white uppercase tracking-wider pb-2 border-b border-gray-700">
                                {editingPrinterId ? "Modifier la configuration" : "Configurer un nouvel équipement"}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nom de l'Imprimante</label>
                                    <input 
                                        type="text" 
                                        value={printerForm.name || ''} 
                                        onChange={(e) => setPrinterForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white"
                                        placeholder="Ex: Epson POS Thermal Desk"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type / Format Papier</label>
                                    <select
                                        value={printerForm.type || 'thermal_80'}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrinterForm(prev => ({ ...prev, type: e.target.value as PrinterConfig['type'] }))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white"
                                    >
                                        <option value="thermal_80">Thermique 80mm (Reçus Standard)</option>
                                        <option value="thermal_58">Thermique 58mm (Format Mobile d'appoint)</option>
                                        <option value="office_a4">Imprimante de Bureau A4 Standard (Factures/Proforma)</option>
                                        <option value="labels_zebra">Étiqueteuse Zebra / Dymo (Codes-barres)</option>
                                        <option value="other">Autre / Format Personnalisé</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type d'Interface / Connexion</label>
                                    <select
                                        value={printerForm.connection || 'browser'}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrinterForm(prev => ({ ...prev, connection: e.target.value as PrinterConfig['connection'] }))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white"
                                    >
                                        <option value="browser">Navigateur Spooler (Système standard / AirPrint)</option>
                                        <option value="network">Réseau Local IP (Liaison Socket brute port 9100)</option>
                                        <option value="bluetooth">Bluetooth (Série RFCOMM)</option>
                                        <option value="usb">USB Direct (Pilote d'Émulation COM)</option>
                                    </select>
                                </div>

                                {printerForm.connection !== 'browser' && (
                                    <div className="space-y-1.5 animate-slide-in">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            {printerForm.connection === 'network' ? 'Adresse IP Réseau de l\'imprimante' : 'Adresse MAC / Port COM'}
                                        </label>
                                        <input 
                                            type="text" 
                                            value={printerForm.address || ''} 
                                            onChange={(e) => setPrinterForm(prev => ({ ...prev, address: e.target.value }))}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm font-mono text-blue-400"
                                            placeholder={printerForm.connection === 'network' ? 'Ex: 192.168.1.150' : 'Ex: 00:11:22:33:FF:EE'}
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ajustement des Marges de Securité (0 à 10mm)</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="10" 
                                            value={printerForm.marginOffset || 0} 
                                            onChange={(e) => setPrinterForm(prev => ({ ...prev, marginOffset: parseInt(e.target.value) }))}
                                            className="grow accent-blue-500 h-2 bg-gray-900 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-xs text-white font-mono font-bold w-12 text-right">+{printerForm.marginOffset || 0} mm</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500">Compense les défauts ou rognages physiques des imprimantes de tickets économiques.</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contraste de Police d'Impression</label>
                                    <select
                                        value={printerForm.fontContrast || 'standard'}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrinterForm(prev => ({ ...prev, fontContrast: e.target.value as PrinterConfig['fontContrast'] }))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white"
                                    >
                                        <option value="standard">Standard (Lisibilité équilibrée)</option>
                                        <option value="high">Haut Contraste (Caractères Gras)</option>
                                        <option value="ultra">Ultra Noir / Température maximale</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                    <label className="flex items-center gap-3 p-3 bg-gray-900/30 border border-gray-700 rounded-xl hover:border-gray-600 cursor-pointer text-left">
                                        <input 
                                            type="checkbox" 
                                            checked={!!printerForm.isDefaultTickets} 
                                            onChange={(e) => setPrinterForm(prev => ({ ...prev, isDefaultTickets: e.target.checked }))}
                                            className="w-4.5 h-4.5 text-blue-600 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white uppercase">Par défaut pour Tickets</span>
                                            <span className="text-[10px] text-gray-400">Impression automatique des fiches client</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 p-3 bg-gray-900/30 border border-gray-700 rounded-xl hover:border-gray-600 cursor-pointer text-left">
                                        <input 
                                            type="checkbox" 
                                            checked={!!printerForm.isDefaultInvoices} 
                                            onChange={(e) => setPrinterForm(prev => ({ ...prev, isDefaultInvoices: e.target.checked }))}
                                            className="w-4.5 h-4.5 text-blue-600 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white uppercase">Par défaut pour Facture A4</span>
                                            <span className="text-[10px] text-gray-400">Impression automatique en format large</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                                <button 
                                    onClick={() => setIsAddingPrinter(false)}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-650 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                                >
                                    Annuler
                                </button>
                                <button 
                                    onClick={handleSavePrinter}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                                >
                                    <Check className="w-4 h-4" /> Enregistrer l'équipement
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: SYSTEM - DEVICE TAILORED OPTIMIZATIONS */}
            {activeTab === 'device' && (
                <div className="space-y-6 animate-fade-in">
                    <section className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6 rounded-2xl shadow-xl border border-blue-800/40 space-y-5 text-left">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest bg-blue-900/50 px-3 py-1 rounded-full border border-blue-800">
                                    Dossier d'Analyse Système Temps Réel
                                </span>
                                <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2 mt-2">
                                    <Cpu className="w-5 h-5 text-purple-400" /> Profil de l'Appareil Détecté
                                </h2>
                            </div>
                            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping mt-1" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                            <div className="p-3.5 bg-gray-900/40 rounded-xl border border-gray-800 space-y-1">
                                <span className="text-[10px] uppercase font-black tracking-wider text-gray-500">Système Host</span>
                                <p className="text-xs font-bold text-white">{deviceProfile.os}</p>
                            </div>
                            <div className="p-3.5 bg-gray-900/40 rounded-xl border border-gray-800 space-y-1">
                                <span className="text-[10px] uppercase font-black tracking-wider text-gray-500">Moteur Web</span>
                                <p className="text-xs font-bold text-blue-400 font-mono">{deviceProfile.browser}</p>
                            </div>
                            <div className="p-3.5 bg-gray-900/40 rounded-xl border border-gray-800 space-y-1">
                                <span className="text-[10px] uppercase font-black tracking-wider text-gray-500">Type de Machine</span>
                                <p className="text-xs font-bold text-white uppercase">{deviceProfile.isMobile ? (deviceProfile.isTablet ? 'Tablette Tactile' : 'Smartphone / Mobile') : 'Ordinateur PC / Mac'}</p>
                            </div>
                            <div className="p-3.5 bg-gray-900/40 rounded-xl border border-gray-800 space-y-1">
                                <span className="text-[10px] uppercase font-black tracking-wider text-gray-500">Ration D'Écran (Viewport)</span>
                                <p className="text-xs font-bold text-purple-400 font-mono">{window.innerWidth} x {window.innerHeight} px</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5 pt-2">
                            <button
                                onClick={() => applyProfilePreset('phone')}
                                className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all border border-purple-500/20"
                            >
                                Preset Tactile & Mobile (iPhone/Android)
                            </button>
                            <button
                                onClick={() => applyProfilePreset('mac')}
                                className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all border border-blue-500/20"
                            >
                                Preset macOS / Apple Safari
                            </button>
                            <button
                                onClick={() => applyProfilePreset('windows')}
                                className="px-4 py-2 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all border border-gray-500/20"
                            >
                                Preset PC Windows (Haute Densité)
                            </button>
                        </div>
                    </section>

                    {/* Optimization fine knobs */}
                    <section className="bg-gray-800/50 p-6 rounded-2xl shadow-xl border border-gray-700/80 space-y-5 text-left">
                        <div>
                            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <SlidersHorizontal className="w-5 h-5 text-blue-400" /> Paramètres d'Ajustement Système
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">Personnalisez les comportements locaux selon l'appareil connecté.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ToggleSwitch 
                                label="Mode Tactile Optimisé (Grands boutons)" 
                                description="Élargit les boutons d'action (min 44px) pour éviter les fausses manipulations sur téléphone."
                                isEnabled={!!settings.device?.touchMode} 
                                onToggle={() => handleToggle('device', 'touchMode')} 
                            />
                            
                            <ToggleSwitch 
                                label="Haute Densité Graphique Spatiale (Compact)" 
                                description="Réduit les paddings globaux pour afficher plus de fiches clients et de modèles d'un seul coup d'œil."
                                isEnabled={settings.device?.density === 'condensed'} 
                                onToggle={() => {
                                    const next = settings.device?.density === 'condensed' ? 'normal' : 'condensed';
                                    updateSettings('device', { density: next });
                                }} 
                            />

                            <ToggleSwitch 
                                label="Auto-compression intelligente" 
                                description="Comprime et réduit les photos des appareils MacBook avant transfert réseau pour économiser la data."
                                isEnabled={!!settings.device?.imageCompression} 
                                onToggle={() => handleToggle('device', 'imageCompression')} 
                                colorClass="bg-purple-600"
                            />

                            <ToggleSwitch 
                                label="Mode Économie de Batterie & Data Mobile" 
                                description="Limite le polling de l'état système ou l'actualisation en arrière-plan."
                                isEnabled={!!settings.device?.lowDataMode} 
                                onToggle={() => handleToggle('device', 'lowDataMode')} 
                                colorClass="bg-purple-600"
                            />

                            <ToggleSwitch 
                                label="Raccourcis Clavier macOS" 
                                description="Assigne les raccourcis système (Enregistrer, etc.) à la touche Command (⌘) au lieu de CTRL."
                                isEnabled={!!settings.device?.keyboardShortcuts} 
                                onToggle={() => handleToggle('device', 'keyboardShortcuts')} 
                            />

                            <ToggleSwitch 
                                label="Auto-focus des Modules de recherche" 
                                description="Force la mise au point du curseur sur le scanner de code-barres / recherche à l'ouverture locale."
                                isEnabled={!!settings.device?.autoFocusSearch} 
                                onToggle={() => handleToggle('device', 'autoFocusSearch')} 
                            />

                            <ToggleSwitch 
                                label="Scan Direct & Redirection Automatique (Code QR)" 
                                description="Ouvre et redirige immédiatement vers la fiche technique lors de la détection d'un code QR via la caméra (désactivez pour afficher les boutons de confirmation de redirection d'abord)."
                                isEnabled={settings.device?.directQrScan !== false} 
                                onToggle={() => handleToggle('device', 'directQrScan')} 
                            />
                        </div>
                    </section>
                </div>
            )}

            {/* TAB 4: SUPER ADMINISTRATOR MODULAR FEAT SWITCHES */}
            {activeTab === 'features' && (
                <div className="space-y-6 animate-fade-in">
                    <section className="bg-gray-800/50 p-6 rounded-2xl shadow-xl border border-gray-700/80">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2.5">
                                    <Sliders className="w-5 h-5 text-blue-500" /> Modulaires du Système
                                </h2>
                                <p className="text-xs text-gray-400 mt-1">Super-Admin : Désactivez entièrement les briques de logiciel inutilisées pour alléger l'environnement.</p>
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
                </div>
            )}

            {/* TAB 5: DYNAMIC LEGAL TERMS & CLAUSES */}
            {activeTab === 'clauses' && (
                <div className="space-y-6 animate-fade-in">
                    <section className="bg-gray-800/50 p-6 rounded-2xl shadow-xl border border-gray-700/80">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2.5">
                                    <FileText className="w-5 h-5 text-blue-500" /> Cadre Contractuel & Clauses
                                </h2>
                                <p className="text-xs text-gray-400 mt-1">Modifiez en direct les mentions contractuelles qui s'impriment au pied des documents clients.</p>
                            </div>
                            <button onClick={addClause} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all">
                                <Plus className="w-4 h-4" /> Ajouter
                            </button>
                        </div>

                        <div className="space-y-2">
                            {settings.clauses.map((clause, index) => (
                                <div key={index} className="flex items-center gap-3 p-3.5 bg-gray-900/40 border border-gray-700/50 rounded-xl group hover:border-gray-600 transition-all">
                                    <div className="flex-grow text-sm text-gray-300 font-medium text-left">
                                        <span className="text-blue-500 font-black mr-2">{index + 1}.</span>
                                        {clause}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => editClause(index)} className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => removeClause(index)} className="p-2 hover:bg-red-600/10 rounded-lg text-gray-500 hover:text-red-500 transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {settings.clauses.length === 0 && (
                                <p className="text-center py-6 text-gray-500 italic text-sm">Aucune clause personnalisée enregistrée.</p>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {/* TAB 6: ZEN DESIGN & INTERFACE PALETTE */}
            {activeTab === 'design' && (
                <div className="space-y-6 animate-fade-in">
                    <section className="bg-gray-800/50 p-6 rounded-2xl shadow-xl border border-gray-700/80">
                        <h2 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2.5">
                            <Palette className="w-5 h-5 text-yellow-500" /> Thèmes Graphiques Prédéfinis
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
                                    <Sparkles className="w-5 h-5 text-purple-400 group-hover:scale-125 transition-transform" />
                                )}
                                <span className="text-[10px] font-black uppercase text-center text-purple-300">Magie IA</span>
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <ConfirmationModal
                isOpen={clauseToDelete !== null}
                onClose={() => setClauseToDelete(null)}
                onConfirm={confirmRemoveClause}
                title="Supprimer la clause ?"
                message="Êtes-vous sûr de vouloir supprimer cette clause contractuelle ? Elle n'apparaîtra plus sur les futurs documents."
                confirmText="Oui, Supprimer"
            />

            <Modal isOpen={!!clauseToEdit} onClose={() => setClauseToEdit(null)}>
                <div className="p-6 text-white text-left">
                    <h3 className="text-xl font-bold mb-4">{clauseToEdit?.index !== null ? 'Modifier la clause' : 'Ajouter une clause'}</h3>
                    <textarea 
                        autoFocus
                        value={clauseToEdit?.text || ''}
                        onChange={(e) => setClauseToEdit(prev => prev ? { ...prev, text: e.target.value } : null)}
                        className="w-full h-32 p-3 bg-gray-700 rounded border border-gray-600 outline-none focus:ring-2 focus:ring-blue-500 mb-6 text-sm"
                        placeholder="Ex: Le matériel non récupéré après 3 mois sera considéré comme abandonné..."
                    />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setClauseToEdit(null)} className="px-4 py-2 bg-gray-600 rounded">Annuler</button>
                        <button onClick={saveClause} className="px-6 py-2 bg-blue-600 rounded font-bold">Enregistrer</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AppSettingsManager;
