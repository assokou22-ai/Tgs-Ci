// Fusion champ par champ des modifications entre appareils.
//
// Chaque écriture locale note, pour chaque champ modifié, l'heure (serveur) de la modification
// dans `_fieldTs`. Lors d'une fusion, chaque champ prend la valeur la plus récente : le statut
// modifié à l'accueil et les notes modifiées à l'atelier ne s'écrasent plus mutuellement.
// Les listes identifiées (paiements, pièces jointes) sont fusionnées élément par élément avec
// gestion des suppressions (`_tombstones`). L'historique est fusionné sans perte.
import { serverNow, getDeviceId } from '../services/syncClock.ts';

export const META_KEYS = new Set(['_fieldTs', '_fieldTsBase', '_tombstones', 'updatedByDevice', 'updatedBy', '_provisionalNumber', '_rev']);
const ID_ARRAY_FIELDS = new Set(['payments', 'paymentsList', 'attachments', 'services', 'ligneVentes']);
const HISTORY_FIELDS = new Set(['history']);
const NESTED_FIELDS = new Set(['client', 'diagnosticSheetB', 'customFields', 'device', 'pricing', 'costs']);

type Rec = Record<string, unknown>;

export const stableStringify = (obj: unknown): string => {
    if (obj === undefined) return 'undefined';
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
    const o = obj as Rec;
    return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
};
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const isPlainObject = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

const docTs = (x: Rec): number => {
    const raw = (x.updatedAt || x.date || x.uploadDate || x.createdAt || 0) as string | number;
    const t = typeof raw === 'number' ? raw : Date.parse(String(raw));
    return Number.isFinite(t) ? t : 0;
};

export const hasFieldStamps = (x: unknown): boolean => isPlainObject(x) && isPlainObject(x._fieldTs);

const itemKey = (item: unknown, idx: number): string => {
    if (isPlainObject(item)) {
        const id = item.id ?? item.timestamp ?? item.date;
        if (id !== undefined && id !== null) return String(id);
    }
    return `#${idx}:${stableStringify(item)}`;
};

/**
 * À appeler avant chaque écriture locale (création/modification par l'utilisateur).
 * Compare avec la version précédente et horodate les champs modifiés.
 */
export const stampLocalWrite = <T>(prev: T | null | undefined, next: T, userEmail?: string | null): T => {
    if (!isPlainObject(next)) return next;
    const p = (isPlainObject(prev) ? prev : null) as Rec | null;
    const n = { ...(next as Rec) };
    const now = serverNow();

    const ts: Record<string, number> = {};
    const mergeTs = (src: unknown) => {
        if (!isPlainObject(src)) return;
        for (const [k, v] of Object.entries(src)) if (typeof v === 'number') ts[k] = Math.max(ts[k] || 0, v);
    };
    mergeTs(p?._fieldTs);
    mergeTs(n._fieldTs);

    const tomb: Record<string, string[]> = {};
    const mergeTomb = (src: unknown) => {
        if (!isPlainObject(src)) return;
        for (const [k, v] of Object.entries(src)) if (Array.isArray(v)) tomb[k] = Array.from(new Set([...(tomb[k] || []), ...v.map(String)]));
    };
    mergeTomb(p?._tombstones);
    mergeTomb(n._tombstones);

    // Protection contre les écrans « périmés » : si l'objet enregistré par l'interface a été
    // chargé AVANT qu'une modification d'un autre appareil n'arrive pour un champ, on conserve
    // la valeur reçue au lieu de l'écraser avec l'ancienne valeur affichée.
    const seenTs = isPlainObject(n._fieldTs) ? (n._fieldTs as Record<string, number>) : null;
    const seenBase = typeof n._fieldTsBase === 'number' ? n._fieldTsBase : null;
    const prevTs = isPlainObject(p?._fieldTs) ? (p!._fieldTs as Record<string, number>) : null;
    const isStale = (path: string, parent?: string) => {
        if (!seenTs || !prevTs) return false;
        const pt = prevTs[path] ?? (parent ? prevTs[parent] : undefined);
        if (typeof pt !== 'number') return false;
        const st = seenTs[path] ?? (parent ? seenTs[parent] : undefined) ?? seenBase ?? 0;
        return pt > st;
    };

    const keys = new Set([...Object.keys(p || {}), ...Object.keys(n)]);
    for (const k of keys) {
        if (META_KEYS.has(k)) continue;
        const a = p ? p[k] : undefined;
        const b = n[k];
        if (p && same(a, b)) continue;
        if (NESTED_FIELDS.has(k) && (isPlainObject(a) || isPlainObject(b)) && !(a !== undefined && b === undefined)) {
            const ao = isPlainObject(a) ? a : {};
            const bo = { ...(isPlainObject(b) ? b : {}) };
            for (const sk of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
                if (p && same(ao[sk], bo[sk])) continue;
                if (p && isStale(`${k}.${sk}`, k)) {
                    if (ao[sk] === undefined) delete bo[sk]; else bo[sk] = ao[sk];
                    continue;
                }
                ts[`${k}.${sk}`] = now;
            }
            n[k] = bo;
            continue;
        }
        if (p && k !== 'updatedAt' && isStale(k) && ID_ARRAY_FIELDS.has(k) && Array.isArray(a)) {
            // Liste modifiée ailleurs depuis l'ouverture de l'écran : on ajoute sans rien supprimer
            const nextArr = Array.isArray(b) ? b : [];
            const nextIds = new Set(nextArr.map(itemKey));
            n[k] = [...nextArr, ...a.filter((it, i) => !nextIds.has(itemKey(it, i)))];
            ts[k] = now;
            continue;
        }
        if (p && k !== 'updatedAt' && isStale(k) && !HISTORY_FIELDS.has(k) && !ID_ARRAY_FIELDS.has(k)) {
            if (a === undefined) delete n[k]; else n[k] = a;
            continue;
        }
        ts[k] = now;
        if (p && ID_ARRAY_FIELDS.has(k) && Array.isArray(a)) {
            const nextIds = new Set((Array.isArray(b) ? b : []).map(itemKey));
            const removed = a.map(itemKey).filter(id => !nextIds.has(id) && !id.startsWith('#'));
            if (removed.length) tomb[k] = Array.from(new Set([...(tomb[k] || []), ...removed])).slice(-500);
        }
    }

    n._fieldTs = ts;
    if (Object.keys(tomb).length) n._tombstones = tomb;
    if (n._fieldTsBase === undefined) n._fieldTsBase = p ? (typeof p._fieldTsBase === 'number' ? p._fieldTsBase : docTs(p)) : now;
    n.updatedByDevice = getDeviceId();
    if (userEmail) n.updatedBy = userEmail;
    // Garantit la présence d'un champ ISO `updatedAt` pour les requêtes incrémentales Firestore
    const isSuggestion = typeof n.category === 'string' && n.id === undefined;
    if (!isSuggestion) {
        const nowIso = new Date(now).toISOString();
        const prevUpdatedAt = p ? p.updatedAt : undefined;
        const hadCallerBump = typeof n.updatedAt === 'string' && n.updatedAt !== prevUpdatedAt;
        if (!n.updatedAt || typeof n.updatedAt !== 'string' || (!hadCallerBump && p && Object.keys(ts).some(k => ts[k] === now))) {
            n.updatedAt = nowIso;
        }
    }
    return n as T;
};

const tsOf = (x: Rec, path: string, parent?: string): number => {
    const f = x._fieldTs as Record<string, number> | undefined;
    if (f) {
        if (typeof f[path] === 'number') return f[path];
        if (parent && typeof f[parent] === 'number') return f[parent];
        return typeof x._fieldTsBase === 'number' ? x._fieldTsBase : 0;
    }
    return docTs(x);
};

/** Choix déterministe et symétrique : même résultat quel que soit l'appareil qui fusionne. */
const pick = (L: Rec, R: Rec, lv: unknown, rv: unknown, tl: number, tr: number): unknown => {
    if (tr > tl) return rv;
    if (tl > tr) return lv;
    const dl = docTs(L), dr = docTs(R);
    if (dr > dl) return rv;
    if (dl > dr) return lv;
    return stableStringify(rv) >= stableStringify(lv) ? rv : lv;
};

export const fieldMerge = (local: unknown, remote: unknown): unknown => {
    if (!isPlainObject(local)) return remote;
    if (!isPlainObject(remote)) return local;
    const L = local, R = remote;
    const out: Rec = {};

    const tomb: Record<string, string[]> = {};
    for (const src of [L._tombstones, R._tombstones]) {
        if (!isPlainObject(src)) continue;
        for (const [k, v] of Object.entries(src)) if (Array.isArray(v)) tomb[k] = Array.from(new Set([...(tomb[k] || []), ...v.map(String)])).slice(-500);
    }

    const keys = new Set([...Object.keys(L), ...Object.keys(R)]);
    for (const k of keys) {
        if (META_KEYS.has(k)) continue;
        const lv = L[k], rv = R[k];
        if (same(lv, rv)) { if (lv !== undefined) out[k] = lv; continue; }

        if (HISTORY_FIELDS.has(k) && (Array.isArray(lv) || Array.isArray(rv))) {
            const map = new Map<string, unknown>();
            for (const arr of [lv, rv]) if (Array.isArray(arr)) arr.forEach((it, i) => {
                const key = isPlainObject(it) ? `${it.timestamp}|${it.action}` : itemKey(it, i);
                map.set(key, it);
            });
            out[k] = Array.from(map.values()).sort((a, b) =>
                Date.parse(String((a as Rec)?.timestamp || 0)) - Date.parse(String((b as Rec)?.timestamp || 0)));
            continue;
        }

        if (ID_ARRAY_FIELDS.has(k) && (Array.isArray(lv) || Array.isArray(rv))) {
            const dead = new Set(tomb[k] || []);
            const winnerFirst = (tsOf(R, k) >= tsOf(L, k)) ? [rv, lv] : [lv, rv];
            const map = new Map<string, unknown>();
            for (const arr of winnerFirst) if (Array.isArray(arr)) arr.forEach((it, i) => {
                const id = itemKey(it, i);
                if (dead.has(id) || map.has(id)) return;
                map.set(id, it);
            });
            out[k] = Array.from(map.values());
            continue;
        }

        if (NESTED_FIELDS.has(k) && isPlainObject(lv) && isPlainObject(rv)) {
            const sub: Rec = {};
            for (const sk of new Set([...Object.keys(lv), ...Object.keys(rv)])) {
                const a = lv[sk], b = rv[sk];
                const v = same(a, b) ? a : pick(L, R, a, b, tsOf(L, `${k}.${sk}`, k), tsOf(R, `${k}.${sk}`, k));
                if (v !== undefined) sub[sk] = v;
            }
            out[k] = sub;
            continue;
        }

        const v = pick(L, R, lv, rv, tsOf(L, k), tsOf(R, k));
        if (v !== undefined) out[k] = v;
    }

    // Métadonnées
    const ts: Record<string, number> = {};
    for (const src of [L._fieldTs, R._fieldTs]) {
        if (!isPlainObject(src)) continue;
        for (const [k, v] of Object.entries(src)) if (typeof v === 'number') ts[k] = Math.max(ts[k] || 0, v);
    }
    out._fieldTs = ts;
    const bases = [L, R].map(x => typeof x._fieldTsBase === 'number' ? x._fieldTsBase : docTs(x));
    out._fieldTsBase = Math.min(...bases);
    if (Object.keys(tomb).length) out._tombstones = tomb;
    const newer = docTs(R) >= docTs(L) ? R : L;
    if (newer.updatedByDevice !== undefined) out.updatedByDevice = newer.updatedByDevice;
    if (newer.updatedBy !== undefined) out.updatedBy = newer.updatedBy;
    const la = String(L.updatedAt || ''), ra = String(R.updatedAt || '');
    if (la || ra) out.updatedAt = la > ra ? la : ra;
    // Un numéro provisoire n'est conservé que si les deux côtés sont provisoires
    if (L._provisionalNumber && R._provisionalNumber) out._provisionalNumber = true;
    return out;
};
