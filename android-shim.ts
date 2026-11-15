// Adaptations pour l'APK Android (Capacitor). Sans effet dans un navigateur classique.
declare global {
  interface Window {
    AndroidBridge?: {
      isAvailable(): boolean;
      printPage(jobName: string): void;
      printHtml(html: string, jobName: string): void;
      saveFile(base64: string, fileName: string, mimeType: string): string;
      openExternal(url: string): void;
      saveFileBegin?(): string;
      saveFileAppend?(id: string, base64: string): boolean;
      saveFileEnd?(id: string, fileName: string, mimeType: string): string;
      httpRequest?(method: string, url: string, body: string, contentType: string, callbackId: string): void;
    };
    __IS_ANDROID_APP__?: boolean;
  }
}

const bridge = typeof window !== 'undefined' ? window.AndroidBridge : undefined;

const guessMime = (name: string, fallback = 'application/octet-stream') => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    json: 'application/json',
    zip: 'application/zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    html: 'text/html',
    txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] || fallback;
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

async function saveHref(href: string, fileName: string) {
  const res = await fetch(href);
  const blob = await res.blob();
  const name = fileName || `export_${Date.now()}`;
  const mime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : guessMime(name);
  const CHUNK = 1536 * 1024; // multiple de 3 → morceaux base64 indépendants
  if (blob.size > CHUNK && bridge!.saveFileBegin && bridge!.saveFileAppend && bridge!.saveFileEnd) {
    // Gros fichier (sauvegarde avec photos) : envoi par morceaux pour ne pas saturer la mémoire
    const id = bridge!.saveFileBegin();
    for (let off = 0; off < blob.size; off += CHUNK) {
      const part = await blobToBase64(blob.slice(off, off + CHUNK));
      if (!bridge!.saveFileAppend(id, part)) throw new Error('Écriture interrompue');
    }
    bridge!.saveFileEnd(id, name, mime);
    return;
  }
  const b64 = await blobToBase64(blob);
  bridge!.saveFile(b64, name, mime);
}

const isExternalUrl = (url: string) => /^(https?:|mailto:|tel:|whatsapp:|sms:|geo:|intent:)/i.test(url) &&
  !/^https?:\/\/localhost(\/|$)/i.test(url);

function handleAnchor(a: HTMLAnchorElement): boolean {
  const href = a.href || a.getAttribute('href') || '';
  if (!href) return false;
  if (a.hasAttribute('download') && /^(blob:|data:)/i.test(href)) {
    saveHref(href, a.getAttribute('download') || '').catch((e) => console.error('[Android] save failed', e));
    return true;
  }
  if (isExternalUrl(href) && (a.target === '_blank' || /^(mailto:|tel:|whatsapp:|sms:)/i.test(href) || !/^https?:\/\/localhost/i.test(href))) {
    bridge!.openExternal(href);
    return true;
  }
  return false;
}

function buildPrintWindow(): Window {
  // Faux objet "fenêtre" : collecte le HTML écrit puis l'envoie au service d'impression Android.
  let html = '';
  let sent = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (sent || !html.trim()) return;
    sent = true;
    const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    const title = (clean.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || 'TGS-CI Document').trim();
    bridge!.printHtml(clean, title);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 600);
  };
  const fakeDoc = {
    write: (s: string) => { html += s; schedule(); },
    writeln: (s: string) => { html += s + '\n'; schedule(); },
    open: () => { html = ''; },
    close: () => { if (timer) clearTimeout(timer); flush(); },
    title: '',
    body: null,
    head: null,
    readyState: 'complete',
  };
  const fake = {
    document: fakeDoc,
    print: flush,
    focus: () => {},
    close: () => {},
    closed: false,
    onafterprint: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: 'about:blank' },
  };
  return fake as unknown as Window;
}

if (bridge) {
  window.__IS_ANDROID_APP__ = true;

  // Les exports libèrent souvent leur fichier temporaire juste après le « clic » de
  // téléchargement ; sur Android l'enregistrement est asynchrone → libération différée.
  const origRevoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = (u: string) => { setTimeout(() => origRevoke(u), 120000); };
  document.documentElement.classList.add('android-app');

  // Impression directe de la page
  window.print = () => bridge.printPage(document.title || 'TGS-CI Document');

  // window.open : impression (fenêtre vide) ou liens externes (WhatsApp, etc.)
  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const u = url ? String(url) : '';
    if (!u || u === 'about:blank') return buildPrintWindow();
    if (/^(blob:|data:)/i.test(u)) {
      saveHref(u, `document_${Date.now()}.pdf`).catch(console.error);
      return null;
    }
    if (isExternalUrl(u)) {
      bridge.openExternal(u);
      return null;
    }
    return originalOpen(u, target, features);
  }) as typeof window.open;

  // Téléchargements (jsPDF, XLSX, sauvegardes, exports ZIP…)
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (handleAnchor(this)) return;
    return origClick.call(this);
  };
  const origDispatch = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function (this: HTMLAnchorElement, ev: Event) {
    if (ev.type === 'click' && handleAnchor(this)) return false;
    return origDispatch.call(this, ev);
  };
  // Routes serveur /api (IA Gemini) : redirigées vers un serveur hébergé si configuré,
  // sinon réponse d'erreur propre au lieu d'un plantage.
  const origFetch = window.fetch.bind(window);
  const androidFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const m = url.match(/^(?:https?:\/\/localhost)?(\/api\/.*)$/i);
    if (m) {
      const base = (localStorage.getItem('rm_api_base_url') || localStorage.getItem('rm_api_base_auto') || (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
      if (base) return origFetch(base + m[1], init);
      return new Response(JSON.stringify({ error: "Serveur IA non trouvé. Ouvrez une fois l'application web publiée avec votre compte, ou saisissez son adresse dans Paramètres > Serveur IA." }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return origFetch(input as RequestInfo, init);
  }) as typeof window.fetch;

  try {
    Object.defineProperty(window, 'fetch', {
      value: androidFetch,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch {
    try {
      Object.defineProperty(Window.prototype, 'fetch', {
        value: androidFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch {
      // Ignorer si non modifiable
    }
  }

  // Clics réels de l'utilisateur sur des liens
  document.addEventListener('click', (ev) => {
    const a = (ev.target as Element | null)?.closest?.('a') as HTMLAnchorElement | null;
    if (a && handleAnchor(a)) ev.preventDefault();
  }, true);
}

export {};
