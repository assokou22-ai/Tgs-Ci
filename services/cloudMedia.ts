// Stockage des photos / fichiers hors des fiches Firestore.
//
// Localement (IndexedDB) rien ne change : les fiches gardent leurs images en base64,
// donc l'affichage, l'impression et les PDF fonctionnent hors ligne comme avant.
// Dans le Cloud, chaque image est envoyée UNE fois dans la collection `media`
// (découpée en morceaux si besoin) et la fiche ne contient plus qu'une référence
// légère "tgsmedia:<empreinte>". Résultat : fiches légères, plus de limite de 1 Mo,
// plus de photos dégradées, synchronisation instantanée.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { openDB, IDBPDatabase } from 'idb';
import { db, auth, isQuotaCooldownActive, isQuotaExceededError, reportQuotaExceeded } from './firebase.ts';

export const MEDIA_PREFIX = 'tgsmedia:';
const MIN_INLINE_SIZE = 4096;      // en dessous : on laisse en ligne (icônes, petites signatures)
const CHUNK_SIZE = 900_000;        // caractères par document (limite Firestore : 1 Mio)
const MEDIA_COLLECTION = 'media';

// ---------- Cache local des médias ----------
let cachePromise: Promise<IDBPDatabase> | null = null;
const getCache = () => {
    if (!cachePromise) {
        cachePromise = openDB('TGSMediaCache', 1, {
            upgrade(d) {
                if (!d.objectStoreNames.contains('media')) d.createObjectStore('media');
                if (!d.objectStoreNames.contains('uploaded')) d.createObjectStore('uploaded');
            },
        }).catch((e) => { cachePromise = null; throw e; });
    }
    return cachePromise;
};
const memCache = new Map<string, string>();

const cacheGet = async (hash: string): Promise<string | undefined> => {
    if (memCache.has(hash)) return memCache.get(hash);
    try {
        const v = await (await getCache()).get('media', hash);
        if (typeof v === 'string') { memCache.set(hash, v); return v; }
    } catch { /* ignore */ }
    return undefined;
};
const cachePut = async (hash: string, data: string) => {
    memCache.set(hash, data);
    try { await (await getCache()).put('media', data, hash); } catch { /* ignore */ }
};
const isUploaded = async (hash: string) => {
    try { return Boolean(await (await getCache()).get('uploaded', hash)); } catch { return false; }
};
const markUploaded = async (hash: string) => {
    try { await (await getCache()).put('uploaded', Date.now(), hash); } catch { /* ignore */ }
};

// ---------- Empreinte ----------
const hashString = async (s: string): Promise<string> => {
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
        }
    } catch { /* fallback */ }
    // Repli (cyrb53 double)
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
        h3 = Math.imul(h3 ^ c, 2246822507); h4 = Math.imul(h4 ^ c, 3266489909);
    }
    return [h1, h2, h3, h4].map(h => (h >>> 0).toString(16).padStart(8, '0')).join('') + s.length.toString(16);
};

export const isMediaRef = (v: unknown): v is string => typeof v === 'string' && v.startsWith(MEDIA_PREFIX);
const isHeavyDataUrl = (v: unknown): v is string => typeof v === 'string' && v.length >= MIN_INLINE_SIZE && v.startsWith('data:');

const missingMediaUntil = new Map<string, number>();
const MISSING_MEDIA_TTL_MS = 15 * 60_000;

// ---------- Envoi ----------
const uploadMedia = async (hash: string, data: string) => {
    if (await isUploaded(hash)) return;
    if (isQuotaCooldownActive()) {
        throw new Error('Quota Cloud temporairement atteint');
    }
    const metaRef = doc(db, MEDIA_COLLECTION, hash);
    try {
        const existing = await getDoc(metaRef);
        if (existing.exists() && existing.get('complete') === true) { await markUploaded(hash); return; }
    } catch { /* on tente l'écriture */ }

    const mime = data.slice(5, data.indexOf(';') > 0 ? data.indexOf(';') : 30);
    const parts = Math.ceil(data.length / CHUNK_SIZE);
    // Les morceaux d'abord, puis la fiche "meta" marquée complète : un autre appareil
    // ne lira jamais un média à moitié envoyé.
    for (let i = 1; i < parts; i++) {
        await setDoc(doc(db, MEDIA_COLLECTION, `${hash}.p${i}`), { id: `${hash}.p${i}`, d: data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) });
    }
    await setDoc(metaRef, {
        id: hash,
        mime,
        length: data.length,
        parts,
        d: data.slice(0, CHUNK_SIZE),
        complete: true,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || '',
    });
    await markUploaded(hash);
};

/**
 * Remplace toutes les données lourdes (data:...) par des références légères,
 * après les avoir envoyées dans la collection `media`. Lève une erreur si l'envoi échoue.
 */
export const dehydrateForCloud = async <T>(value: T): Promise<T> => {
    const walk = async (v: unknown): Promise<unknown> => {
        if (isHeavyDataUrl(v)) {
            const hash = await hashString(v);
            await cachePut(hash, v);
            await uploadMedia(hash, v);
            return MEDIA_PREFIX + hash;
        }
        if (Array.isArray(v)) {
            const out = [];
            for (const x of v) out.push(await walk(x));
            return out;
        }
        if (v && typeof v === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = await walk(x);
            return out;
        }
        return v;
    };
    return (await walk(value)) as T;
};

/** Variante sans réseau : remplace par les références sans rien envoyer (pour comparer). */
export const toRefsOffline = async <T>(value: T): Promise<T> => {
    const walk = async (v: unknown): Promise<unknown> => {
        if (isHeavyDataUrl(v)) return MEDIA_PREFIX + (await hashString(v));
        if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await walk(x)); return out; }
        if (v && typeof v === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = await walk(x);
            return out;
        }
        return v;
    };
    return (await walk(value)) as T;
};

export const hasMediaRefs = (v: unknown): boolean => {
    if (isMediaRef(v)) return true;
    if (Array.isArray(v)) return v.some(hasMediaRefs);
    if (v && typeof v === 'object') {
        return Object.values(v as Record<string, unknown>).some(hasMediaRefs);
    }
    return false;
};

/**
 * Réchauffe le cache TGSMediaCache à partir d'une fiche locale existante
 * pour éviter toute lecture Firestore `media` sur les photos déjà présentes sur l'appareil.
 */
export const warmMediaCacheFromRecord = async (localRecord: unknown): Promise<void> => {
    if (!localRecord || typeof localRecord !== 'object') return;
    const walk = async (v: unknown): Promise<void> => {
        if (isHeavyDataUrl(v)) {
            const hash = await hashString(v);
            if (!memCache.has(hash)) {
                const existing = await cacheGet(hash);
                if (!existing) {
                    await cachePut(hash, v);
                }
            }
            return;
        }
        if (Array.isArray(v)) {
            for (const x of v) await walk(x);
            return;
        }
        if (v && typeof v === 'object') {
            for (const x of Object.values(v as Record<string, unknown>)) await walk(x);
        }
    };
    await walk(localRecord);
};

const fetchMedia = async (hash: string): Promise<string> => {
    const cached = await cacheGet(hash);
    if (cached) return cached;
    const blockedUntil = missingMediaUntil.get(hash) || 0;
    if (Date.now() < blockedUntil) {
        throw new Error(`Média ${hash} en attente de réessai`);
    }
    if (isQuotaCooldownActive()) {
        throw new Error('Quota Cloud temporairement atteint');
    }
    const meta = await getDoc(doc(db, MEDIA_COLLECTION, hash));
    if (!meta.exists() || meta.get('complete') !== true) {
        missingMediaUntil.set(hash, Date.now() + MISSING_MEDIA_TTL_MS);
        throw new Error(`Média ${hash} introuvable dans le Cloud`);
    }
    missingMediaUntil.delete(hash);
    const parts = Number(meta.get('parts') || 1);
    let data = String(meta.get('d') || '');
    for (let i = 1; i < parts; i++) {
        const p = await getDoc(doc(db, MEDIA_COLLECTION, `${hash}.p${i}`));
        if (!p.exists()) throw new Error(`Morceau ${i} du média ${hash} manquant`);
        data += String(p.get('d') || '');
    }
    await cachePut(hash, data);
    await markUploaded(hash);
    return data;
};

/**
 * Remplace les références "tgsmedia:..." par les vraies données (cache local puis Cloud).
 * Lève une erreur si un média est introuvable : l'appelant ignore alors la mise à jour
 * et la réessaiera au prochain rattrapage (aucune image cassée enregistrée localement).
 */
export const hydrateFromCloud = async <T>(value: T): Promise<T> => {
    const walk = async (v: unknown): Promise<unknown> => {
        if (isMediaRef(v)) return fetchMedia(v.slice(MEDIA_PREFIX.length));
        if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await walk(x)); return out; }
        if (v && typeof v === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = await walk(x);
            return out;
        }
        return v;
    };
    return (await walk(value)) as T;
};

/**
 * Remplace les références "tgsmedia:..." par les vraies données (cache local puis Cloud)
 * en mode tolérant : si un média échoue (quota ou envoi incomplet), la fiche elle-même
 * n'est JAMAIS jetée — la référence est conservée et comptée dans `unresolvedRefs`.
 */
export const hydrateFromCloudBestEffort = async <T>(
    value: T,
    allowRemoteFetch = true
): Promise<{ data: T; unresolvedRefs: number; quotaHit: boolean }> => {
    let unresolvedRefs = 0;
    let quotaHit = false;

    const walk = async (v: unknown): Promise<unknown> => {
        if (isMediaRef(v)) {
            const hash = v.slice(MEDIA_PREFIX.length);
            const cached = await cacheGet(hash);
            if (cached) return cached;
            if (!allowRemoteFetch || quotaHit || isQuotaCooldownActive()) {
                unresolvedRefs++;
                return v;
            }
            try {
                return await fetchMedia(hash);
            } catch (err) {
                if (isQuotaExceededError(err)) {
                    reportQuotaExceeded(err);
                    quotaHit = true;
                }
                unresolvedRefs++;
                return v;
            }
        }
        if (Array.isArray(v)) {
            const out = [];
            for (const x of v) out.push(await walk(x));
            return out;
        }
        if (v && typeof v === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = await walk(x);
            return out;
        }
        return v;
    };

    const data = (await walk(value)) as T;
    return { data, unresolvedRefs, quotaHit };
};

/**
 * Empêche qu'une référence non résolue ("tgsmedia:...") reçue du Cloud n'écrase
 * une vraie photo/signature ("data:...") déjà présente localement.
 */
export const mergeUnresolvedMediaFallback = <T>(localValue: unknown, remoteValue: T): T => {
    if (localValue === undefined || localValue === null) return remoteValue;
    if (isMediaRef(remoteValue) && typeof localValue === 'string' && localValue.startsWith('data:')) {
        return localValue as unknown as T;
    }
    if (Array.isArray(remoteValue) && Array.isArray(localValue)) {
        return remoteValue.map((item, idx) =>
            mergeUnresolvedMediaFallback(localValue[idx], item)
        ) as unknown as T;
    }
    if (
        remoteValue &&
        typeof remoteValue === 'object' &&
        !Array.isArray(remoteValue) &&
        typeof localValue === 'object' &&
        !Array.isArray(localValue)
    ) {
        const localObj = localValue as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(remoteValue as Record<string, unknown>)) {
            out[k] = k in localObj ? mergeUnresolvedMediaFallback(localObj[k], val) : val;
        }
        return out as T;
    }
    return remoteValue;
};

/** Indique si un objet contient encore des images lourdes en ligne. */
export const hasInlineHeavyData = (value: unknown): boolean => {
    if (isHeavyDataUrl(value)) return true;
    if (Array.isArray(value)) return value.some(hasInlineHeavyData);
    if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasInlineHeavyData);
    return false;
};

/** Écrit un gros texte (ex. sauvegarde quotidienne) sous forme de média découpé. */
export const storeLargeText = async (text: string): Promise<string> => {
    const asDataUrl = 'data:application/json;utf8,' + text;
    const hash = await hashString(asDataUrl);
    await uploadMedia(hash, asDataUrl);
    return MEDIA_PREFIX + hash;
};

