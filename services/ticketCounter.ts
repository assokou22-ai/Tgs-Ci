// Compteur central des numéros de dossier (26-RM-XXXX / 26-ENT-XXXX).
//
// En ligne : le numéro est réservé de façon atomique dans Firestore (transaction) —
// deux appareils qui créent un dossier à la même seconde obtiennent forcément deux
// numéros différents.
// Hors ligne : un numéro provisoire est calculé localement et marqué `_provisionalNumber`.
// Au retour du réseau, il est confirmé s'il est libre, sinon le dossier est renuméroté
// automatiquement (et les documents qui le référencent sont mis à jour).
import {
    doc, runTransaction, collection, query, where, orderBy, limit, getDocs, documentId,
} from 'firebase/firestore';
import { db, auth, isQuotaCooldownActive, isQuotaExceededError, reportQuotaExceeded } from './firebase.ts';
import { extractTicketSequenceNumber, generateNextTicketSequence } from '../utils/idGenerator.ts';
import type { RepairTicket } from '../types.ts';

export const seriesPrefix = (isEnterprise: boolean, year?: number | string) => {
    const yy = (year ? String(year) : String(new Date().getFullYear())).slice(-2);
    return `${yy}-${isEnterprise ? 'ENT' : 'RM'}-`;
};
const counterId = (prefix: string) => prefix.replace(/-$/, '');
const format = (prefix: string, n: number) => `${prefix}${String(n).padStart(4, '0')}`;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** Plus grand numéro déjà présent dans le Cloud pour une série (lecture légère). */
const cloudMaxForPrefix = async (prefix: string, isEnterprise: boolean, year?: number | string): Promise<number> => {
    if (isQuotaCooldownActive()) return 0;
    let max = 0;
    try {
        const q = query(
            collection(db, 'tickets'),
            where(documentId(), '>=', prefix),
            where(documentId(), '<', prefix + '\uf8ff'),
            orderBy(documentId(), 'desc'),
            limit(25),
        );
        const snap = await getDocs(q);
        snap.forEach(d => {
            const n = extractTicketSequenceNumber(d.id, isEnterprise, year);
            if (n && n > max) max = n;
        });
    } catch (e) {
        if (isQuotaExceededError(e)) {
            reportQuotaExceeded(e);
        } else {
            console.warn('[Compteur] Lecture du maximum Cloud impossible:', e);
        }
    }
    return max;
};

export const canUseCloudCounter = () =>
    typeof navigator !== 'undefined' && navigator.onLine && !!auth.currentUser && !isQuotaCooldownActive();

/**
 * Réserve le prochain numéro officiel. `preferredId` (numéro provisoire ou proposé)
 * est conservé s'il est libre et supérieur au compteur.
 */
export const reserveTicketNumber = async (
    localTickets: RepairTicket[],
    isEnterprise: boolean,
    year?: number | string,
    preferredId?: string,
): Promise<string> => {
    if (isQuotaCooldownActive()) {
        throw new Error('Quota Cloud atteint');
    }
    const prefix = seriesPrefix(isEnterprise, year);
    const localMax = (localTickets || []).reduce((m, t) => {
        const n = extractTicketSequenceNumber(t?.id, isEnterprise, year);
        return n && n > m ? n : m;
    }, 0);
    const cloudMax = await withTimeout(cloudMaxForPrefix(prefix, isEnterprise, year), 4000).catch(() => 0);
    const floor = Math.max(localMax, cloudMax);
    const preferredNum = preferredId ? extractTicketSequenceNumber(preferredId, isEnterprise, year) : null;

    return withTimeout(runTransaction(db, async (tx) => {
        const cRef = doc(db, 'counters', counterId(prefix));
        const cSnap = await tx.get(cRef);
        const last = cSnap.exists() ? Number(cSnap.get('last') || 0) : 0;
        // Un numéro est pris s'il existe déjà une fiche OU une réservation (fiche en cours d'envoi)
        const isTaken = async (candidate: string) => {
            const [t, r] = await Promise.all([
                tx.get(doc(db, 'tickets', candidate)),
                tx.get(doc(db, 'counters', `res_${candidate}`)),
            ]);
            return t.exists() || r.exists();
        };
        const reserve = (candidate: string) => tx.set(doc(db, 'counters', `res_${candidate}`), {
            id: `res_${candidate}`, ticketId: candidate, at: new Date().toISOString(), by: auth.currentUser?.email || '',
        });

        // 1) Garder le numéro proposé s'il est libre
        if (preferredNum) {
            const candidate = format(prefix, preferredNum);
            if (!(await isTaken(candidate))) {
                reserve(candidate);
                tx.set(cRef, { id: counterId(prefix), last: Math.max(preferredNum, last), updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.email || '' }, { merge: true });
                return candidate;
            }
        }

        // 2) Sinon, numéro suivant libre
        let next = Math.max(last, floor) + 1;
        for (let guard = 0; guard < 20; guard++) {
            const candidate = format(prefix, next);
            if (!(localTickets || []).some(t => t?.id === candidate) && !(await isTaken(candidate))) {
                reserve(candidate);
                tx.set(cRef, { id: counterId(prefix), last: next, updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.email || '' }, { merge: true });
                return candidate;
            }
            next++;
        }
        throw new Error('Impossible de réserver un numéro libre');
    }), 8000);
};

/** Numéro pour un nouveau dossier : Cloud si possible, sinon provisoire local. */
export const allocateTicketNumber = async (
    localTickets: RepairTicket[],
    isEnterprise: boolean,
    year?: number | string,
): Promise<{ id: string; provisional: boolean }> => {
    if (canUseCloudCounter()) {
        try {
            return { id: await reserveTicketNumber(localTickets, isEnterprise, year), provisional: false };
        } catch { /* repli local */ }
    }
    return { id: generateNextTicketSequence(localTickets, isEnterprise, year), provisional: true };
};
