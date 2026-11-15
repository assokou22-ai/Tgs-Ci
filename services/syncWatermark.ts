// Gestion des jalons (watermarks) par collection pour limiter les lectures Firestore
// aux seuls documents modifiés depuis la dernière synchronisation réussie.

const WM_PREFIX = 'tgs_col_wm_';

export const WATERMARK_COLLECTIONS = new Set<string>([
    'tickets',
    'factures',
    'proformas',
    'commandes',
    'appointments',
    'stock',
    'services',
    'simpleDocuments',
    'storedDocuments',
    'stockUsage',
    'externalPurchases',
    'engagementsSav',
    'mouvementsStock',
]);

const extractTimestampMs = (rec: unknown): number => {
    if (!rec || typeof rec !== 'object') return 0;
    const obj = rec as Record<string, unknown>;
    const raw = obj.updatedAt || obj.date || obj.uploadDate || obj.createdAt;
    if (!raw) return 0;
    const ms = typeof raw === 'number' ? raw : Date.parse(String(raw));
    return Number.isFinite(ms) ? ms : 0;
};

export const getCollectionWatermark = (collectionName: string): string | null => {
    if (typeof localStorage === 'undefined') return null;
    if (!WATERMARK_COLLECTIONS.has(collectionName)) return null;
    try {
        const val = localStorage.getItem(`${WM_PREFIX}${collectionName}`);
        if (!val) return null;
        const parsed = Date.parse(val);
        return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
    } catch {
        return null;
    }
};

export const setCollectionWatermark = (collectionName: string, isoTimestamp: string): void => {
    if (typeof localStorage === 'undefined') return;
    if (!WATERMARK_COLLECTIONS.has(collectionName)) return;
    const parsed = Date.parse(isoTimestamp);
    if (!Number.isFinite(parsed)) return;
    const clampedMs = Math.min(parsed, Date.now() + 60_000);
    try {
        const prev = getCollectionWatermark(collectionName);
        if (prev && Date.parse(prev) >= clampedMs) return;
        localStorage.setItem(`${WM_PREFIX}${collectionName}`, new Date(clampedMs).toISOString());
    } catch {
        /* ignore quota localStorage */
    }
};

export const clearCollectionWatermark = (collectionName?: string): void => {
    if (typeof localStorage === 'undefined') return;
    try {
        if (collectionName) {
            localStorage.removeItem(`${WM_PREFIX}${collectionName}`);
            return;
        }
        WATERMARK_COLLECTIONS.forEach((col) => {
            localStorage.removeItem(`${WM_PREFIX}${col}`);
        });
    } catch {
        /* ignore */
    }
};

/**
 * Avance le jalon d'une collection à partir des documents reçus du serveur
 * (ou à `fallbackIso` si la requête serveur est vide mais bien complétée).
 */
export const advanceCollectionWatermark = (
    collectionName: string,
    records: unknown[],
    fallbackIso?: string
): void => {
    if (!WATERMARK_COLLECTIONS.has(collectionName)) return;
    let maxMs = 0;
    for (const r of records) {
        const t = extractTimestampMs(r);
        if (t > maxMs) maxMs = t;
    }
    if (maxMs > 0) {
        setCollectionWatermark(collectionName, new Date(maxMs).toISOString());
    } else if (fallbackIso) {
        const prev = getCollectionWatermark(collectionName);
        const prevMs = prev ? Date.parse(prev) : 0;
        const fallbackMs = Date.parse(fallbackIso);
        // Évite de faire varier le filtre `where('updatedAt', '>', since)` à chaque rechargement quand rien n'a changé :
        // on n'avance sur instantané vide que s'il n'y a aucun jalon ou s'il date de plus de 6 heures.
        if (!prevMs || (Number.isFinite(fallbackMs) && fallbackMs - prevMs > 6 * 3600_000)) {
            const hourRounded = Number.isFinite(fallbackMs)
                ? new Date(Math.floor(fallbackMs / 3600_000) * 3600_000).toISOString()
                : fallbackIso;
            setCollectionWatermark(collectionName, hourRounded);
        }
    }
};

/**
 * Si un appareil déjà peuplé (ex. >= 30 fiches locales et historique de synchro existant)
 * passe sur cette version sans jalon enregistré, initialise un jalon sûr (max local - 48h)
 * pour éviter de relire des milliers d'archives au premier redémarrage.
 * Sur un appareil neuf (< 30 fiches), retourne `null` afin de télécharger tout l'historique.
 */
export const resolveIncrementalSince = (
    collectionName: string,
    localItems: unknown[],
    overlapMs = 2 * 3600_000
): string | null => {
    if (!WATERMARK_COLLECTIONS.has(collectionName)) return null;
    if (localItems.length === 0) return null;

    let wm = getCollectionWatermark(collectionName);
    if (!wm) {
        const hadPriorSync =
            typeof localStorage !== 'undefined' &&
            Boolean(localStorage.getItem('tgs_requeue_recent_v1'));
        if (!hadPriorSync || localItems.length < 30) {
            return null;
        }
        let maxLocalMs = 0;
        for (const item of localItems) {
            const t = extractTimestampMs(item);
            if (t > maxLocalMs) maxLocalMs = t;
        }
        if (maxLocalMs <= 0) return null;
        const safeSeedIso = new Date(maxLocalMs - 48 * 3600_000).toISOString();
        setCollectionWatermark(collectionName, safeSeedIso);
        wm = safeSeedIso;
    }

    const wmMs = Date.parse(wm);
    if (!Number.isFinite(wmMs)) return null;
    return new Date(Math.max(0, wmMs - overlapMs)).toISOString();
};
