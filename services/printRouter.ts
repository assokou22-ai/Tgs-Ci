// Routage des impressions vers l'imprimante par défaut.
// Imprimante prioritaire : HP LaserJet P1566 branchée en USB sur un PC Windows et partagée
// sur le réseau. Un petit « relais d'impression » installé sur ce PC reçoit les documents
// (téléphones Android, iPad, autres PC) et les imprime directement, sans boîte de dialogue.
// Si le relais est injoignable, l'impression classique du système prend le relais.

type PrintMode = 'auto' | 'relay' | 'system';

interface StoredPrinter {
    id: string;
    name: string;
    connection: string;
    address?: string;
    windowsName?: string;
    isDefaultInvoices?: boolean;
    isDefaultTickets?: boolean;
}

const HP_DEFAULT: StoredPrinter = { id: 'hp_p1566', name: 'HP LaserJet P1566 (partagée via le PC)', connection: 'pc_relay', windowsName: 'HP LaserJet P1566', isDefaultInvoices: true, isDefaultTickets: true };

export const PRINT_MODE_KEY = 'rm_print_mode';
export const PRINT_RELAY_URL_KEY = 'rm_print_relay_url';
const SETTINGS_LS_KEY = 'mac-repair-app-appSettings';

const bridge = typeof window !== 'undefined' ? window.AndroidBridge : undefined;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const getDefaultPrinter = (): StoredPrinter | null => {
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_LS_KEY) || '{}');
        const list: StoredPrinter[] = Array.isArray(s.printers) ? s.printers : [];
        return list.find(p => p.isDefaultInvoices) || list.find(p => p.isDefaultTickets) || list.find(p => p.id === 'hp_p1566') || list[0] || HP_DEFAULT;
    } catch {
        return HP_DEFAULT;
    }
};

export const getPrintMode = (): PrintMode => (localStorage.getItem(PRINT_MODE_KEY) as PrintMode) || 'auto';

export const normalizeRelayUrl = (raw: string): string => {
    let u = (raw || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    try {
        const parsed = new URL(u);
        if (!parsed.port) parsed.port = '8631';
        return parsed.origin;
    } catch {
        return '';
    }
};

export const getRelayUrl = (): string => {
    const local = localStorage.getItem(PRINT_RELAY_URL_KEY);
    return normalizeRelayUrl(local || getDefaultPrinter()?.address || '');
};

/** Doit-on envoyer au relais du PC sur cet appareil ? */
export const shouldUseRelay = (): boolean => {
    const mode = getPrintMode();
    if (mode === 'system') return false;
    const url = getRelayUrl();
    if (!url) return false;
    if (mode === 'relay') return true;
    const printer = getDefaultPrinter();
    if (printer?.connection !== 'pc_relay') return false;
    // Automatique : téléphones Android et iPad passent par le relais ; un ordinateur
    // utilise sa propre fenêtre d'impression (l'imprimante partagée y est déjà installée).
    return !!bridge || isIOS();
};

// ---------- Petit message à l'écran (indépendant de React) ----------
const notify = (msg: string, kind: 'ok' | 'err' | 'info' = 'info') => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.setAttribute('role', 'status');
    el.style.cssText = `position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 88px);transform:translateX(-50%);z-index:99999;
      max-width:92vw;padding:10px 16px;border-radius:12px;font:600 13px/1.35 system-ui,sans-serif;color:#fff;
      background:${kind === 'ok' ? '#15803d' : kind === 'err' ? '#b91c1c' : '#1f2937'};box-shadow:0 8px 24px rgba(0,0,0,.35)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3500);
};

// ---------- Requêtes vers le relais ----------
type NativeCb = (status: number, body: string) => void;
const nativeCallbacks = new Map<string, NativeCb>();
(window as unknown as { __tgsNativeHttpCb?: (id: string, status: number, body: string) => void }).__tgsNativeHttpCb = (id, status, body) => {
    const cb = nativeCallbacks.get(id);
    nativeCallbacks.delete(id);
    cb?.(status, body);
};

const nativeRequest = (method: string, url: string, body = '', contentType = 'application/json; charset=utf-8') =>
    new Promise<{ status: number; body: string }>((resolve) => {
        const id = 'r' + Date.now() + Math.random().toString(36).slice(2, 7);
        nativeCallbacks.set(id, (status, b) => resolve({ status, body: b }));
        (bridge as unknown as { httpRequest: (m: string, u: string, b: string, c: string, i: string) => void }).httpRequest(method, url, body, contentType, id);
    });

const hasNativeHttp = () => !!bridge && typeof (bridge as unknown as { httpRequest?: unknown }).httpRequest === 'function';

/** Test de l'imprimante (Paramètres) : renvoie l'état du relais ou une erreur lisible. */
export const testRelay = async (url = getRelayUrl()): Promise<{ ok: boolean; message: string }> => {
    if (!url) return { ok: false, message: "Adresse du PC d'impression non renseignée." };
    try {
        let text = '';
        if (hasNativeHttp()) {
            const r = await nativeRequest('GET', url + '/health');
            if (r.status !== 200) return { ok: false, message: JSON.parse(r.body || '{}').error || `Relais injoignable (${url}).` };
            text = r.body;
        } else if (location.protocol === 'http:' || url.startsWith('https:')) {
            const r = await fetch(url + '/health', { cache: 'no-store' });
            text = await r.text();
        } else {
            // Page sécurisée (https) dans un navigateur : ouverture directe de la page d'état du relais.
            window.open(url + '/health?page=1', '_blank');
            return { ok: true, message: "Page d'état du relais ouverte dans un nouvel onglet." };
        }
        const j = JSON.parse(text || '{}');
        return { ok: j.status === 'ok', message: j.status === 'ok' ? `Relais OK – imprimante : ${j.printer}${j.printerReady === false ? ' (introuvable sur le PC)' : ''}` : 'Réponse inattendue du relais.' };
    } catch {
        return { ok: false, message: `Relais injoignable (${url}). Vérifiez que le PC est allumé et sur le même Wi-Fi.` };
    }
};

// ---------- Préparation du document (images et styles intégrés) ----------
const blobToDataUrl = (blob: Blob) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(blob);
});

const needsInlining = (src: string) => {
    if (!src || src.startsWith('data:')) return false;
    if (src.startsWith('blob:')) return true;
    try {
        const u = new URL(src, location.href);
        return u.origin === location.origin; // ressources locales de l'application (inaccessibles au PC)
    } catch {
        return false;
    }
};

async function inlineDocument(html: string): Promise<string> {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script, noscript').forEach(n => n.remove());
    // Styles locaux (fichiers CSS de l'application)
    await Promise.all(Array.from(parsed.querySelectorAll('link[rel="stylesheet"]')).map(async (link) => {
        const href = link.getAttribute('href') || '';
        if (!needsInlining(href)) return;
        try {
            const css = await (await fetch(new URL(href, location.href).href)).text();
            const style = parsed.createElement('style');
            style.textContent = css;
            link.replaceWith(style);
        } catch { link.remove(); }
    }));
    // Images locales / blob → data URL
    await Promise.all(Array.from(parsed.querySelectorAll('img')).map(async (img) => {
        const src = img.getAttribute('src') || '';
        if (!needsInlining(src)) return;
        try {
            const blob = await (await fetch(new URL(src, location.href).href)).blob();
            img.setAttribute('src', await blobToDataUrl(blob));
        } catch { /* image ignorée */ }
    }));
    // Champs de formulaire : valeurs saisies
    if (!parsed.querySelector('meta[charset]')) {
        const meta = parsed.createElement('meta');
        meta.setAttribute('charset', 'UTF-8');
        parsed.head.prepend(meta);
    }
    return '<!DOCTYPE html>\n' + parsed.documentElement.outerHTML;
}

const snapshotCurrentPage = (): string => {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    // Recopie des valeurs saisies (inputs / textarea / select)
    const src = document.querySelectorAll('input, textarea, select');
    const dst = clone.querySelectorAll('input, textarea, select');
    src.forEach((el, i) => {
        const d = dst[i] as HTMLInputElement | undefined;
        if (!d) return;
        if (el instanceof HTMLTextAreaElement) d.textContent = el.value;
        else if (el instanceof HTMLSelectElement) {
            Array.from((d as unknown as HTMLSelectElement).options).forEach((o, k) => { if (k === el.selectedIndex) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
        } else if (el instanceof HTMLInputElement) {
            if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) d.setAttribute('checked', ''); else d.removeAttribute('checked'); }
            else d.setAttribute('value', el.value);
        }
    });
    // Canvas (signatures) → images
    const canvases = document.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((c, i) => {
        try {
            const img = document.createElement('img');
            img.src = (canvases[i] as HTMLCanvasElement).toDataURL('image/png');
            img.style.cssText = (c as HTMLElement).style.cssText;
            img.className = (c as HTMLElement).className;
            c.replaceWith(img);
        } catch { /* canvas protégé */ }
    });
    return '<!DOCTYPE html>\n' + clone.outerHTML;
};

/** Envoie un document HTML complet au relais d'impression du PC. */
export async function sendHtmlToRelay(html: string, title: string): Promise<boolean> {
    const url = getRelayUrl();
    if (!url) return false;
    const printer = getDefaultPrinter();
    notify(`Envoi à ${printer?.name || "l'imprimante"}…`);
    const prepared = await inlineDocument(html);
    const payload = { title: title || 'TGS-CI Document', html: prepared, printer: printer?.windowsName || '', copies: 1 };
    try {
        if (hasNativeHttp()) {
            const r = await nativeRequest('POST', url + '/print', JSON.stringify(payload));
            if (r.status === 200) { notify('Document envoyé à l\'imprimante.', 'ok'); return true; }
            let msg = '';
            try { msg = JSON.parse(r.body).error; } catch { /* */ }
            notify(`Impression impossible : ${msg || 'relais injoignable'}. Ouverture de l'impression classique.`, 'err');
            return false;
        }
        if (location.protocol === 'http:' || url.startsWith('https:')) {
            const r = await fetch(url + '/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (r.ok) { notify('Document envoyé à l\'imprimante.', 'ok'); return true; }
            notify('Le relais a refusé le document. Ouverture de l\'impression classique.', 'err');
            return false;
        }
        // Navigateur sur page https (iPad, PC) : envoi par formulaire dans un nouvel onglet,
        // seul moyen autorisé vers un appareil http du réseau local.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = url + '/print-form';
        form.target = '_blank';
        form.acceptCharset = 'UTF-8';
        form.style.display = 'none';
        for (const [k, v] of Object.entries(payload)) {
            const input = document.createElement('textarea');
            input.name = k;
            input.value = String(v);
            form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        setTimeout(() => form.remove(), 1000);
        notify('Document transmis au PC d\'impression.', 'ok');
        return true;
    } catch (e) {
        console.error('[printRouter]', e);
        notify('Relais d\'impression injoignable. Ouverture de l\'impression classique.', 'err');
        return false;
    }
}

/** Imprime une page de test depuis cet appareil. */
export async function printTestPage(): Promise<boolean> {
    const now = new Date().toLocaleString('fr-FR');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Test impression TGS CI</title>
<style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#111}h1{font-size:22px;margin:0 0 6px}p{font-size:13px}
.box{border:2px solid #111;border-radius:8px;padding:14px;margin-top:16px}</style></head><body>
<h1>RM TGS CI Repair – page de test</h1><p>Imprimée le ${now}</p>
<div class="box"><p><b>Appareil :</b> ${bridge ? 'Application Android' : isIOS() ? 'iPad / iPhone' : 'Ordinateur'}</p>
<p><b>Imprimante :</b> ${getDefaultPrinter()?.name || '—'}</p><p><b>Relais :</b> ${getRelayUrl() || '—'}</p></div>
<p style="margin-top:24px">Si cette page sort correctement, l'impression par défaut est opérationnelle.</p></body></html>`;
    if (shouldUseRelay() || getRelayUrl()) return sendHtmlToRelay(html, 'Test impression TGS CI');
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
    return true;
}

// ---------- Interception des impressions de l'application ----------
function buildRelayCaptureWindow(fallback: (html: string, title: string) => void): Window {
    let html = '';
    let sent = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
        if (sent || !html.trim()) return;
        sent = true;
        const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || 'TGS-CI Document').trim();
        sendHtmlToRelay(html, title).then(ok => { if (!ok) fallback(html, title); });
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(flush, 600); };
    const fakeDoc = {
        write: (s: string) => { html += s; schedule(); },
        writeln: (s: string) => { html += s + '\n'; schedule(); },
        open: () => { html = ''; },
        close: () => { if (timer) clearTimeout(timer); flush(); },
        title: '', body: null, head: null, readyState: 'complete',
    };
    return {
        document: fakeDoc, print: flush, focus: () => {}, close: () => {}, closed: false,
        onafterprint: null, addEventListener: () => {}, removeEventListener: () => {},
        location: { href: 'about:blank' },
    } as unknown as Window;
}

const prevOpen = window.open.bind(window);
const prevPrint = window.print.bind(window);

const systemPrintHtml = (html: string, title: string) => {
    if (bridge) { bridge.printHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ''), title); return; }
    const w = prevOpen('', '_blank', 'height=900,width=850');
    if (w) { w.document.write(html); w.document.close(); }
};

window.open = ((url?: string | URL, target?: string, features?: string) => {
    const u = url ? String(url) : '';
    if ((!u || u === 'about:blank') && shouldUseRelay()) return buildRelayCaptureWindow(systemPrintHtml);
    return prevOpen(u, target, features);
}) as typeof window.open;

window.print = () => {
    if (!shouldUseRelay()) return prevPrint();
    sendHtmlToRelay(snapshotCurrentPage(), document.title || 'TGS-CI Document').then(ok => { if (!ok) prevPrint(); });
};

export {};
