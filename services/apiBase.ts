// Adresse du serveur de l'application (routes /api : IA Gemini, etc.).
// - Navigateur (PC, iPad) : le serveur est celui qui sert la page → adresses relatives.
// - APK Android : l'adresse du serveur publié est découverte automatiquement (le web publié
//   s'enregistre dans Firestore `settings/apiServers`) ou saisie dans les paramètres.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase.ts';

export const MANUAL_KEY = 'rm_api_base_url';
export const AUTO_KEY = 'rm_api_base_auto';
const isAndroidApp = () => typeof window !== 'undefined' && !!(window as unknown as { AndroidBridge?: unknown }).AndroidBridge;

export const getConfiguredApiBase = (): string =>
    (localStorage.getItem(MANUAL_KEY) || localStorage.getItem(AUTO_KEY) || '').replace(/\/$/, '');

const withTimeout = <T>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** Teste une adresse de serveur : renvoie true si /api/health répond et que l'IA est configurée. */
export const testApiServer = async (base: string): Promise<{ ok: boolean; ai: boolean; version?: string }> => {
    try {
        const r = await withTimeout(fetch(base.replace(/\/$/, '') + '/api/health', { cache: 'no-store' }), 5000);
        if (!r.ok) return { ok: false, ai: false };
        const j = await r.json();
        return { ok: j?.status === 'ok', ai: !!j?.ai, version: j?.version };
    } catch {
        return { ok: false, ai: false };
    }
};

let resolving: Promise<string> | null = null;

/** Sur Android : trouve l'adresse du serveur publié (une fois, puis mise en cache). */
export const resolveApiBase = async (force = false): Promise<string> => {
    if (!isAndroidApp()) return '';
    const manual = localStorage.getItem(MANUAL_KEY);
    if (manual) return manual.replace(/\/$/, '');
    const cached = localStorage.getItem(AUTO_KEY);
    if (cached && !force) return cached;
    if (resolving) return resolving;
    resolving = (async () => {
        try {
            if (!auth.currentUser) return cached || '';
            const snap = await getDoc(doc(db, 'settings', 'apiServers'));
            const list = ((snap.exists() ? snap.get('candidates') : []) || []) as Array<{ origin: string; seenAt: string; ai?: boolean }>;
            list.sort((a, b) => String(b.seenAt).localeCompare(String(a.seenAt)));
            for (const c of list) {
                const t = await testApiServer(c.origin);
                if (t.ok) {
                    localStorage.setItem(AUTO_KEY, c.origin);
                    return c.origin;
                }
            }
            return cached || '';
        } catch {
            return cached || '';
        } finally {
            setTimeout(() => { resolving = null; }, 0);
        }
    })();
    return resolving;
};

/** Sur le web publié : enregistre sa propre adresse pour que les téléphones la trouvent seuls. */
export const registerWebServerOrigin = async () => {
    if (isAndroidApp() || !auth.currentUser) return;
    const origin = window.location.origin;
    if (!/^https:\/\//.test(origin) || /localhost|127\.0\.0\.1/.test(origin)) return;
    const health = await testApiServer('');
    if (!health.ok) return;
    const key = 'rm_api_registered_' + origin;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) === today) return;
    try {
        const ref = doc(db, 'settings', 'apiServers');
        const snap = await getDoc(ref);
        const list = ((snap.exists() ? snap.get('candidates') : []) || []) as Array<{ origin: string; seenAt: string; ai?: boolean }>;
        const others = list.filter(c => c.origin !== origin).slice(0, 4);
        await setDoc(ref, {
            id: 'apiServers',
            candidates: [{ origin, seenAt: new Date().toISOString(), ai: health.ai, version: health.version || '' }, ...others],
        });
        localStorage.setItem(key, today);
    } catch (e) {
        console.warn('[apiBase] Enregistrement de l\'adresse serveur impossible :', e);
    }
};
