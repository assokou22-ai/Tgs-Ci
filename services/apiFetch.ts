// Toutes les requêtes vers /api partent avec le jeton Google de l'utilisateur
// (le serveur réserve l'IA à l'équipe autorisée). Sur Android, l'adresse du serveur
// publié est résolue avant l'envoi.
import { auth } from './firebase.ts';
import { resolveApiBase } from './apiBase.ts';

const origFetch = window.fetch.bind(window);

const isApiUrl = (url: string) => {
    if (url.startsWith('/api/')) return true;
    try {
        const u = new URL(url, window.location.href);
        return u.origin === window.location.origin && u.pathname.startsWith('/api/');
    } catch {
        return false;
    }
};

const customFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!isApiUrl(url)) return origFetch(input as RequestInfo, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    try {
        const user = auth.currentUser;
        if (user && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
    } catch { /* hors ligne : le serveur répondra 401 */ }
    headers.set('X-TGS-Client', (window as unknown as { AndroidBridge?: unknown }).AndroidBridge ? 'android' : 'web');
    await resolveApiBase().catch(() => '');
    return origFetch(input as RequestInfo, { ...init, headers });
}) as typeof window.fetch;

if (typeof window !== 'undefined') {
    try {
        Object.defineProperty(window, 'fetch', {
            value: customFetch,
            writable: true,
            configurable: true,
            enumerable: true
        });
    } catch {
        try {
            Object.defineProperty(Window.prototype, 'fetch', {
                value: customFetch,
                writable: true,
                configurable: true,
                enumerable: true
            });
        } catch {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).fetch = customFetch;
            } catch (err) {
                console.warn('[apiFetch] Impossible d\'intercepter window.fetch globalement:', err);
            }
        }
    }
}

export {};
