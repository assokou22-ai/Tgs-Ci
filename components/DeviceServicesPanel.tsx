import React, { useEffect, useState } from 'react';
import { Printer, Server, CheckCircle2, AlertTriangle, Loader2, Smartphone } from 'lucide-react';
import { useAppSettings, PrinterConfig } from '../hooks/useAppSettings.ts';
import { MANUAL_KEY, AUTO_KEY, getConfiguredApiBase, resolveApiBase, testApiServer } from '../services/apiBase.ts';
import { PRINT_MODE_KEY, PRINT_RELAY_URL_KEY, normalizeRelayUrl, printTestPage, testRelay } from '../services/printRouter.ts';
import { APP_VERSION, APP_BUILD_DATE } from '../version.ts';

const isAndroid = typeof window !== 'undefined' && !!window.AndroidBridge;

type Status = { kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string };

const StatusLine: React.FC<{ s: Status }> = ({ s }) => {
    if (s.kind === 'idle') return null;
    const Icon = s.kind === 'busy' ? Loader2 : s.kind === 'ok' ? CheckCircle2 : AlertTriangle;
    const color = s.kind === 'ok' ? 'text-emerald-400' : s.kind === 'err' ? 'text-red-400' : 'text-gray-300';
    return (
        <p className={`flex items-start gap-2 text-xs font-semibold ${color}`}>
            <Icon className={`w-4 h-4 shrink-0 ${s.kind === 'busy' ? 'animate-spin' : ''}`} /> <span>{s.msg}</span>
        </p>
    );
};

/** Paramètres propres à cet appareil : serveur IA, imprimante par défaut, version. */
const DeviceServicesPanel: React.FC = () => {
    const { settings, updateSettings } = useAppSettings();
    const printers = settings.printers || [];
    const defaultPrinter = printers.find(p => p.isDefaultInvoices) || printers[0];
    const hp = printers.find(p => p.id === 'hp_p1566');

    // ---- Serveur IA ----
    const [apiUrl, setApiUrl] = useState(() => localStorage.getItem(MANUAL_KEY) || '');
    const [apiStatus, setApiStatus] = useState<Status>({ kind: 'idle' });
    const detected = getConfiguredApiBase();

    const testApi = async () => {
        setApiStatus({ kind: 'busy', msg: 'Test du serveur…' });
        const clean = apiUrl.trim().replace(/\/$/, '');
        if (clean) localStorage.setItem(MANUAL_KEY, clean); else localStorage.removeItem(MANUAL_KEY);
        const base = isAndroid ? (clean || await resolveApiBase(true)) : (clean || '');
        if (isAndroid && !base) {
            setApiStatus({ kind: 'err', msg: "Aucun serveur trouvé. Ouvrez une fois l'application web publiée avec votre compte, ou collez son adresse ci-dessus." });
            return;
        }
        const r = await testApiServer(base);
        if (!r.ok) setApiStatus({ kind: 'err', msg: `Serveur injoignable${base ? ` (${base})` : ''}.` });
        else if (!r.ai) setApiStatus({ kind: 'err', msg: 'Serveur joignable mais clé Gemini absente (secret GEMINI_API_KEY à ajouter dans AI Studio).' });
        else setApiStatus({ kind: 'ok', msg: `IA opérationnelle${r.version ? ` – serveur v${r.version}` : ''}.` });
    };

    // ---- Imprimante ----
    const [mode, setMode] = useState(() => localStorage.getItem(PRINT_MODE_KEY) || 'auto');
    const [relayIp, setRelayIp] = useState(() => localStorage.getItem(PRINT_RELAY_URL_KEY) || hp?.address || '');
    const [printStatus, setPrintStatus] = useState<Status>({ kind: 'idle' });

    useEffect(() => { localStorage.setItem(PRINT_MODE_KEY, mode); }, [mode]);

    const saveRelay = () => {
        const url = normalizeRelayUrl(relayIp);
        if (url) localStorage.setItem(PRINT_RELAY_URL_KEY, url); else localStorage.removeItem(PRINT_RELAY_URL_KEY);
        // L'adresse est partagée avec tous les appareils de l'équipe (paramètres synchronisés)
        if (hp && hp.address !== url) {
            updateSettings('printers', printers.map(p => p.id === 'hp_p1566' ? { ...p, address: url } : p) as PrinterConfig[]);
        }
        return url;
    };

    const setDefault = (id: string) => {
        updateSettings('printers', printers.map(p => ({ ...p, isDefaultInvoices: p.id === id, isDefaultTickets: p.id === id })) as PrinterConfig[]);
    };

    const runTest = async () => {
        const url = saveRelay();
        setPrintStatus({ kind: 'busy', msg: 'Connexion au PC d\'impression…' });
        const r = await testRelay(url);
        setPrintStatus({ kind: r.ok ? 'ok' : 'err', msg: r.message });
    };

    const runTestPage = async () => {
        saveRelay();
        setPrintStatus({ kind: 'busy', msg: 'Envoi de la page de test…' });
        const ok = await printTestPage();
        setPrintStatus({ kind: ok ? 'ok' : 'err', msg: ok ? 'Page de test envoyée.' : 'Échec de l\'envoi.' });
    };

    const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono';
    const btn = 'px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all';

    return (
        <div className="space-y-5">
            <section className="bg-gray-800/50 p-4 sm:p-6 rounded-2xl border border-gray-700/80 space-y-4">
                <div>
                    <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        <Printer className="w-5 h-5 text-blue-500" /> Imprimante par défaut
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        Toutes les impressions (fiches, factures, reçus) partent vers l'imprimante choisie. La HP LaserJet P1566 branchée en USB sur le PC est reçue directement par le relais d'impression installé sur ce PC.
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Imprimante par défaut (toute l'équipe)</label>
                    <select value={defaultPrinter?.id || ''} onChange={e => setDefault(e.target.value)} className={inputCls + ' font-sans'}>
                        {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adresse IP du PC de l'imprimante</label>
                        <input value={relayIp} onChange={e => setRelayIp(e.target.value)} onBlur={saveRelay} placeholder="Ex : 192.168.1.20" inputMode="url" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sur cet appareil</label>
                        <select value={mode} onChange={e => setMode(e.target.value)} className={inputCls + ' font-sans'}>
                            <option value="auto">Automatique (téléphone/iPad → PC, ordinateur → fenêtre d'impression)</option>
                            <option value="relay">Toujours envoyer directement au PC</option>
                            <option value="system">Toujours ouvrir la fenêtre d'impression</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button onClick={runTest} className={`${btn} bg-gray-700 hover:bg-gray-600 text-white`}>Tester la connexion</button>
                    <button onClick={runTestPage} className={`${btn} bg-blue-600 hover:bg-blue-500 text-white`}>Imprimer une page de test</button>
                </div>
                <StatusLine s={printStatus} />
            </section>

            <section className="bg-gray-800/50 p-4 sm:p-6 rounded-2xl border border-gray-700/80 space-y-4">
                <div>
                    <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        <Server className="w-5 h-5 text-violet-400" /> Serveur IA
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        {isAndroid
                            ? "L'APK utilise le serveur de l'application web publiée. Il est trouvé automatiquement après une connexion sur la version web ; vous pouvez aussi coller son adresse."
                            : "Sur ordinateur et iPad, l'IA passe par le serveur qui affiche cette page. Aucun réglage nécessaire."}
                    </p>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adresse de l'application publiée (facultatif)</label>
                    <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="https://…run.app" inputMode="url" className={inputCls} />
                    {isAndroid && detected && !apiUrl && <p className="text-[11px] text-gray-500">Détecté : {detected}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={testApi} className={`${btn} bg-violet-600 hover:bg-violet-500 text-white`}>Tester l'IA</button>
                    {isAndroid && <button onClick={() => { localStorage.removeItem(AUTO_KEY); localStorage.removeItem(MANUAL_KEY); setApiUrl(''); testApi(); }} className={`${btn} bg-gray-700 hover:bg-gray-600 text-white`}>Redétecter</button>}
                </div>
                <StatusLine s={apiStatus} />
            </section>

            <p className="flex items-center gap-2 text-[11px] text-gray-500 px-1">
                <Smartphone className="w-4 h-4" /> RM TGS CI Repair v{APP_VERSION} ({APP_BUILD_DATE}) – {isAndroid ? 'Application Android' : 'Application web'}
            </p>
        </div>
    );
};

export default DeviceServicesPanel;
