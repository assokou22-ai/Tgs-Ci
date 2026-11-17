// Compteur central des numéros de dossier (26-RM-XXXX / 26-ENT-XXXX).
//
// En ligne : le numéro est réservé de façon atomique dans Firestore (transaction `counters`),
// avec repli robuste sur la collection `tickets` seule si `counters` échoue (permission refusée,
// délai dépassé, quota). Une fiche en attente n'est jamais bloquée.
// Hors ligne : un numéro provisoire est calculé localement et marqué `_provisionalNumber`.
// Au retour du réseau, il est confirmé s'il est libre, sinon le dossier est renuméroté
// automatiquement (et les documents qui le référencent sont mis à jour).
import {
    doc, runTransaction, collection, query, where, orderBy, limit, getDocs, documentId,
} from 'firebase/firestore';
import { db, auth, isQuotaCooldownActive, isQuotaExceededError, reportQuotaExceeded } from './firebase.ts';
import { extractTicketSequenceNumber, generateNextTicketSequence } from '../utils/idGenerator.ts';
import { addSyncLog } from '../utils/syncLogHelper.ts';
import { isSameTicket, resolveProvisionalAgainstCloud, type TicketLike } from '../utils/ticketSyncLogic.ts';
import type { RepairTicket } from '../types.ts';

export { isSameTicket, resolveProvisionalAgainstCloud };

export const seriesPrefix = (isEnterprise: boolean, year?: number | string) => {
    const yy = (year ? String(year) : String(new Date().getFullYear())).slice(-2);
    return `${yy}-${isEnterprise ? 'ENT' : 'RM'}-`;
};
const counterId = (prefix: string) => prefix.replace(/-$/, '');
export const formatTicketSequence = (prefix: string, n: number) => `${prefix}${String(n).padStart(4, '0')}`;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export interface TicketNumberReservationResult {
    id: string;
    usedTicketsOnlyFallback: boolean;
    provisional: boolean;
    matchedExistingCloud?: boolean;
    counterError?: string;
}

export interface TicketsOnlyCounterDeps {
    getCloudMaxForPrefix?: (prefix: string, isEnterprise: boolean, year?: number | string) => Promise<number>;
    ticketExistsInTx?: (candidate: string) => Promise<boolean>;
    getCloudTicketInTx?: (candidate: string) => Promise<TicketLike | null>;
    runTicketsTx?: <T>(fn: (exists: (candidate: string) => Promise<boolean>, getTicket?: (candidate: string) => Promise<TicketLike | null>) => Promise<T>) => Promise<T>;
}

/** Plus grand numéro déjà présent dans le Cloud pour une série (lecture légère). */
export const cloudMaxForPrefix = async (prefix: string, isEnterprise: boolean, year?: number | string): Promise<number> => {
    if (isQuotaCooldownActive()) return 0;
    let max = 0;
    try {
        const q = query(
            collection(db, 'tickets'),
            where(documentId(), '>=', prefix),
            where(documentId(), '<', prefix + '\uf8ff'),
            orderBy(documentId(), 'desc'),
            limit(1),
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
 * Repli robuste sur la collection `tickets` seule (sans toucher `counters`).
 * - Avant de renuméroter `preferredId`, lit la fiche Cloud du même numéro :
 *   si `isSameTicket(preferredTicket, cloudTicket)` est vrai, on CONSERVE le même numéro sans doublon.
 * - S'il n'existe pas dans `tickets`, on le conserve.
 * - S'il existe pour une AUTRE fiche, on prend le prochain numéro libre (>= max Cloud + 1, max local + 1).
 */
export const reserveTicketNumberOnTicketsOnly = async (
    localTickets: RepairTicket[],
    isEnterprise: boolean,
    year?: number | string,
    preferredId?: string,
    deps?: TicketsOnlyCounterDeps,
    preferredTicket?: TicketLike,
): Promise<string> => {
    const prefix = seriesPrefix(isEnterprise, year);
    const localMax = (localTickets || []).reduce((m, t) => {
        const n = extractTicketSequenceNumber(t?.id, isEnterprise, year);
        return n && n > m ? n : m;
    }, 0);
    const cloudMax = deps?.getCloudMaxForPrefix
        ? await deps.getCloudMaxForPrefix(prefix, isEnterprise, year)
        : await withTimeout(cloudMaxForPrefix(prefix, isEnterprise, year), 5000).catch(() => 0);

    const floor = Math.max(localMax, cloudMax);
    const preferredNum = preferredId ? extractTicketSequenceNumber(preferredId, isEnterprise, year) : null;

    const executeTx = async (
        existsFn: (candidate: string) => Promise<boolean>,
        getTicketFn?: (candidate: string) => Promise<TicketLike | null>,
    ): Promise<string> => {
        // 1) Vérifier la fiche existante avant toute renumérotation
        if (preferredNum) {
            const candidate = formatTicketSequence(prefix, preferredNum);
            if (getTicketFn) {
                const cloudDoc = await getTicketFn(candidate);
                if (!cloudDoc) {
                    return candidate;
                }
                if (preferredTicket && isSameTicket(preferredTicket, cloudDoc)) {
                    return candidate;
                }
            } else if (!(await existsFn(candidate))) {
                return candidate;
            }
        }

        // 2) Sinon prendre le prochain numéro libre après max(Cloud, local)
        let next = Math.max(floor, preferredNum || 0) + 1;
        for (let guard = 0; guard < 35; guard++) {
            const candidate = formatTicketSequence(prefix, next);
            if (!(localTickets || []).some(t => t?.id === candidate) && !(await existsFn(candidate))) {
                return candidate;
            }
            next++;
        }
        throw new Error('Impossible de trouver un numéro libre dans la collection tickets');
    };

    if (deps?.runTicketsTx) {
        return deps.runTicketsTx(executeTx);
    }
    if (deps?.ticketExistsInTx || deps?.getCloudTicketInTx) {
        const existsFn = deps.ticketExistsInTx
            ? deps.ticketExistsInTx
            : async (candidate: string) => Boolean(await deps.getCloudTicketInTx?.(candidate));
        return executeTx(existsFn, deps.getCloudTicketInTx);
    }

    return withTimeout(
        runTransaction(db, async (tx) => {
            const getTicketFn = async (candidate: string): Promise<TicketLike | null> => {
                const snap = await tx.get(doc(db, 'tickets', candidate));
                if (!snap.exists()) return null;
                return { id: snap.id, ...(snap.data() as Record<string, unknown>) };
            };
            const existsFn = async (candidate: string) => Boolean(await getTicketFn(candidate));
            return executeTx(existsFn, getTicketFn);
        }),
        8000,
    );
};

/**
 * Réserve le prochain numéro officiel avec repli automatique sur `tickets` seule si `counters` échoue
 * (permission refusée, délai dépassé, quota sur `counters`).
 * Avant toute renumérotation d'un numéro provisoire, compare avec la fiche Cloud éventuelle via `isSameTicket`.
 */
export const reserveTicketNumberWithFallback = async (
    localTickets: RepairTicket[],
    isEnterprise: boolean,
    year?: number | string,
    preferredId?: string,
    preferredTicket?: TicketLike,
): Promise<TicketNumberReservationResult> => {
    const prefix = seriesPrefix(isEnterprise, year);
    const localMax = (localTickets || []).reduce((m, t) => {
        const n = extractTicketSequenceNumber(t?.id, isEnterprise, year);
        return n && n > m ? n : m;
    }, 0);
    const cloudMax = isQuotaCooldownActive()
        ? 0
        : await withTimeout(cloudMaxForPrefix(prefix, isEnterprise, year), 4000).catch(() => 0);
    const floor = Math.max(localMax, cloudMax);
    const preferredNum = preferredId ? extractTicketSequenceNumber(preferredId, isEnterprise, year) : null;

    if (!isQuotaCooldownActive()) {
        try {
            const txRes = await withTimeout(runTransaction(db, async (tx) => {
                const cRef = doc(db, 'counters', counterId(prefix));
                const cSnap = await tx.get(cRef);
                const last = cSnap.exists() ? Number(cSnap.get('last') || 0) : 0;
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

                // 1) Vérifier si le numéro proposé correspond déjà à la même fiche dans le Cloud (anti-doublon)
                if (preferredNum) {
                    const candidate = formatTicketSequence(prefix, preferredNum);
                    const [tSnap, rSnap] = await Promise.all([
                        tx.get(doc(db, 'tickets', candidate)),
                        tx.get(doc(db, 'counters', `res_${candidate}`)),
                    ]);

                    if (tSnap.exists()) {
                        const cloudData = { id: tSnap.id, ...(tSnap.data() as Record<string, unknown>) };
                        if (preferredTicket && isSameTicket(preferredTicket, cloudData)) {
                            if (!rSnap.exists()) reserve(candidate);
                            tx.set(cRef, {
                                id: counterId(prefix),
                                last: Math.max(preferredNum, last),
                                updatedAt: new Date().toISOString(),
                                updatedBy: auth.currentUser?.email || '',
                            }, { merge: true });
                            return { id: candidate, matchedExistingCloud: true };
                        }
                    } else if (!rSnap.exists()) {
                        reserve(candidate);
                        tx.set(cRef, {
                            id: counterId(prefix),
                            last: Math.max(preferredNum, last),
                            updatedAt: new Date().toISOString(),
                            updatedBy: auth.currentUser?.email || '',
                        }, { merge: true });
                        return { id: candidate, matchedExistingCloud: false };
                    }
                }

                // 2) Sinon, numéro suivant libre (vrai conflit multi-appareils)
                let next = Math.max(last, floor) + 1;
                for (let guard = 0; guard < 25; guard++) {
                    const candidate = formatTicketSequence(prefix, next);
                    if (!(localTickets || []).some(t => t?.id === candidate) && !(await isTaken(candidate))) {
                        reserve(candidate);
                        tx.set(cRef, {
                            id: counterId(prefix),
                            last: next,
                            updatedAt: new Date().toISOString(),
                            updatedBy: auth.currentUser?.email || '',
                        }, { merge: true });
                        return { id: candidate, matchedExistingCloud: false };
                    }
                    next++;
                }
                throw new Error('Impossible de réserver un numéro libre dans counters');
            }), 8000);

            return {
                id: txRes.id,
                usedTicketsOnlyFallback: false,
                provisional: false,
                matchedExistingCloud: txRes.matchedExistingCloud,
            };
        } catch (counterErr) {
            const rawErr = counterErr instanceof Error ? counterErr.message : String(counterErr);
            const reason = /permission|insufficient/i.test(rawErr)
                ? `permission refusée sur counters (${rawErr})`
                : rawErr;
            console.warn(`[Compteur] Transaction counters échouée (${reason}) — repli sur la collection tickets seule.`);
            addSyncLog(
                'Cloud Realtime',
                'Flux Temps Réel',
                'error',
                auth.currentUser?.email || 'Système',
                `Compteur counters indisponible (${reason}) : repli automatique sur la collection tickets seule.`
            );

            // Repli robuste : transaction sur la collection `tickets` seule
            const fallbackId = await reserveTicketNumberOnTicketsOnly(
                localTickets,
                isEnterprise,
                year,
                preferredId,
                undefined,
                preferredTicket,
            );
            return {
                id: fallbackId,
                usedTicketsOnlyFallback: true,
                provisional: true, // Garder le contrôle d'unicité atomique au moment du push
                counterError: reason,
            };
        }
    }

    // Même si un cooldown lecture récent existe, on tente une transaction directe sur `tickets`
    const fallbackId = await reserveTicketNumberOnTicketsOnly(
        localTickets,
        isEnterprise,
        year,
        preferredId,
        undefined,
        preferredTicket,
    );
    return {
        id: fallbackId,
        usedTicketsOnlyFallback: true,
        provisional: true,
        counterError: 'Quota lecture temporaire sur counters',
    };
};

/**
 * Réserve le prochain numéro officiel (rétrocompatible : ne bloque jamais si `counters` échoue).
 */
export const reserveTicketNumber = async (
    localTickets: RepairTicket[],
    isEnterprise: boolean,
    year?: number | string,
    preferredId?: string,
    preferredTicket?: TicketLike,
): Promise<string> => {
    const res = await reserveTicketNumberWithFallback(localTickets, isEnterprise, year, preferredId, preferredTicket);
    return res.id;
};

/** Numéro pour un nouveau dossier : Cloud si possible (avec repli tickets), sinon provisoire local. */
export const allocateTicketNumber = async (
    localTickets: RepairTicket[],
    isEnterprise: boolean,
    year?: number | string,
): Promise<{ id: string; provisional: boolean }> => {
    if (canUseCloudCounter()) {
        try {
            const res = await reserveTicketNumberWithFallback(localTickets, isEnterprise, year);
            return { id: res.id, provisional: res.provisional };
        } catch { /* repli local hors ligne */ }
    }
    return { id: generateNextTicketSequence(localTickets, isEnterprise, year), provisional: true };
};
