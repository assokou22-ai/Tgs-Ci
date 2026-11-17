// Écriture fiable d'une entité vers Firestore :
//  - la version la plus récente de l'appareil est envoyée (pas un instantané périmé de la file) ;
//  - les photos/fichiers lourds partent dans la collection `media` (la fiche reste < 1 Mo) ;
//  - un numéro provisoire ne bloque JAMAIS l'envoi (repli atomique sur `tickets` seule si `counters` échoue) ;
//  - aucune donnée locale ni entrée de file d'attente n'est supprimée avant confirmation du serveur ;
//  - la copie locale garde les photos en pleine qualité.
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db, auth, isQuotaCooldownActive } from './firebase.ts';
import { dbGet, dbPutDirect, dbDeleteDirect, dbQueuePut, getDB } from './dbService.ts';
import { dehydrateForCloud, hydrateFromCloudBestEffort, mergeUnresolvedMediaFallback, warmMediaCacheFromRecord } from './cloudMedia.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { stableStringify } from '../utils/fieldMerge.ts';
import { optimizeTicketForFirestore } from '../utils/imageCompression.ts';
import {
    reserveTicketNumberWithFallback,
    cloudMaxForPrefix,
    seriesPrefix,
    formatTicketSequence,
    canUseCloudCounter,
} from './ticketCounter.ts';
import {
    isSameTicket,
    resolveProvisionalAgainstCloud,
} from '../utils/ticketSyncLogic.ts';
import { extractTicketSequenceNumber } from '../utils/idGenerator.ts';
import { serverNowIso } from './syncClock.ts';
import { addSyncLog } from '../utils/syncLogHelper.ts';
import type { EntityType, RepairTicket } from '../types.ts';

export { isSameTicket, resolveProvisionalAgainstCloud };

export const STORE_BY_ENTITY: Partial<Record<EntityType, string>> = {
    ticket: 'tickets', stock: 'stock', service: 'services',
    facture: 'factures', proforma: 'proformas', commande: 'commandes',
    appointment: 'appointments', deviceSession: 'deviceSessions',
    simpleDocument: 'simpleDocuments', storedDocument: 'knowledge_files',
    suggestions: 'suggestions', stockUsage: 'stockUsage',
    externalPurchase: 'externalPurchases', engagementSav: 'engagementsSav',
    mouvementStock: 'mouvementsStock',
};

const REFERENCE_STORES: Array<[string, EntityType]> = [
    ['factures', 'facture'], ['proformas', 'proforma'], ['commandes', 'commande'],
    ['appointments', 'appointment'], ['stockUsage', 'stockUsage'],
    ['engagementsSav', 'engagementSav'], ['mouvementsStock', 'mouvementStock'],
    ['externalPurchases', 'externalPurchase'], ['simpleDocuments', 'simpleDocument'],
];

const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? {}));

const replaceValueDeep = (val: unknown, oldId: string, newId: string): { value: unknown; changed: boolean } => {
    if (val === oldId) return { value: newId, changed: true };
    if (Array.isArray(val)) {
        let changed = false;
        const nextArr = val.map((item) => {
            const res = replaceValueDeep(item, oldId, newId);
            if (res.changed) changed = true;
            return res.value;
        });
        return { value: changed ? nextArr : val, changed };
    }
    if (val && typeof val === 'object') {
        let changed = false;
        const nextObj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            const res = replaceValueDeep(v, oldId, newId);
            if (res.changed) changed = true;
            nextObj[k] = res.value;
        }
        return { value: changed ? nextObj : val, changed };
    }
    return { value: val, changed: false };
};

/** Met à jour les références internes d'un ticket lors d'une renumérotation (lignes de vente, paiements, historique). */
export const applyRenumberingToTicket = <T extends Record<string, unknown>>(
    ticket: T,
    oldId: string,
    newId: string,
    actorEmail?: string | null,
): T => {
    const next: Record<string, unknown> = { ...ticket, id: newId };
    delete next._provisionalNumber;

    if (Array.isArray(next.ligneVentes)) {
        next.ligneVentes = next.ligneVentes.map((lv) => {
            if (!lv || typeof lv !== 'object') return lv;
            const rec = lv as Record<string, unknown>;
            return rec.fiche_id === oldId ? { ...rec, fiche_id: newId } : rec;
        });
    }

    if (Array.isArray(next.paymentsList)) {
        next.paymentsList = next.paymentsList.map((p) => {
            if (!p || typeof p !== 'object') return p;
            const rec = p as Record<string, unknown>;
            return rec.ticketId === oldId ? { ...rec, ticketId: newId } : rec;
        });
    }

    if (newId !== oldId) {
        const existingHistory = Array.isArray(next.history) ? next.history : [];
        next.history = [
            ...existingHistory,
            {
                timestamp: serverNowIso(),
                user: actorEmail || 'Système',
                action: `Renumérotation automatique : le numéro provisoire #${oldId} (créé hors ligne ou sans compteur) était déjà utilisé sur un autre appareil. Nouveau numéro officiel : #${newId}.`,
            },
        ];
        next.updatedAt = serverNowIso();
    }

    return next as T;
};

/** Remplace l'ancien numéro par le nouveau dans tous les documents liés (rendez-vous, factures, proformas, paiements, commandes, stock, SAV…). */
export const replaceTicketReferences = async (oldId: string, newId: string) => {
    if (!oldId || !newId || oldId === newId) return;
    const idb = await getDB();
    for (const [store, entity] of REFERENCE_STORES) {
        let all: Array<Record<string, unknown>> = [];
        try { all = await idb.getAll(store); } catch { continue; }
        for (const rec of all) {
            let changed = false;
            const next: Record<string, unknown> = { ...rec };
            for (const [k, v] of Object.entries(rec)) {
                if (k === 'id') continue;
                const res = replaceValueDeep(v, oldId, newId);
                if (res.changed) {
                    next[k] = res.value;
                    changed = true;
                }
            }
            if (changed && next.id !== undefined) {
                next.updatedAt = serverNowIso();
                await dbPutDirect(store, next);
                await dbQueuePut(entity, String(next.id), next);
            }
        }
    }
};

export interface PushEntityDetailedResult {
    finalId: string;
    renumberedFrom?: string;
    usedTicketsOnlyFallback?: boolean;
    mergedDuplicateAvoided?: boolean;
}

/**
 * Confirme un numéro provisoire :
 * - Lit d'abord la fiche Cloud portant le même numéro.
 * - Si c'est la même fiche (`isSameTicket`), fusionne sans renuméroter et retire `_provisionalNumber`.
 * - Sinon réserve un nouveau numéro officiel sans supprimer `oldId` avant la confirmation serveur.
 */
export const finalizeProvisionalTicket = async (ticket: RepairTicket & Record<string, unknown>): Promise<RepairTicket & Record<string, unknown>> => {
    if (!ticket?._provisionalNumber || !canUseCloudCounter()) return ticket;
    const oldId = ticket.id;

    try {
        const existingSnap = await getDoc(doc(db, 'tickets', oldId));
        if (existingSnap.exists()) {
            const cloudDoc = { id: existingSnap.id, ...(existingSnap.data() as Record<string, unknown>) };
            const resolution = resolveProvisionalAgainstCloud(ticket, cloudDoc);
            if (resolution.action === 'merge') {
                return resolution.ticket;
            }
        }
    } catch { /* repli sur la réservation */ }

    const idb = await getDB();
    const localTickets = (await idb.getAll('tickets')).filter((t: RepairTicket) => t.id !== oldId) as RepairTicket[];
    const year = ticket.createdAt ? new Date(ticket.createdAt).getFullYear() : undefined;
    const res = await reserveTicketNumberWithFallback(localTickets, Boolean(ticket.client?.isEnterprise), year, oldId, ticket);
    const finalId = res.id;

    return applyRenumberingToTicket(ticket, oldId, finalId, auth.currentUser?.email);
};

/**
 * Envoie une entité vers Firestore avec fusion transactionnelle et rapport détaillé.
 * Ne supprime jamais l'ancien enregistrement local tant que le serveur n'a pas confirmé l'écriture.
 */
export const pushEntityToCloudDetailed = async (
    entity: EntityType,
    collectionName: string,
    entityId: string,
    queuedPayload: unknown,
): Promise<PushEntityDetailedResult> => {
    const storeName = STORE_BY_ENTITY[entity];
    // 1) Version la plus récente présente sur l'appareil
    let current: Record<string, unknown> | null = null;
    if (storeName && entity !== 'suggestions') {
        try { current = await dbGet(storeName, entityId); } catch { current = null; }
    }

    const payload = clean((current || queuedPayload || {}) as Record<string, unknown>);
    if (payload.id !== undefined && payload.id !== null) payload.id = String(payload.id);
    if (payload.ticketId !== undefined && payload.ticketId !== null) payload.ticketId = String(payload.ticketId);
    if (!payload.id) payload.id = entityId;
    if (entity !== 'suggestions' && (!payload.updatedAt || typeof payload.updatedAt !== 'string')) {
        payload.updatedAt = serverNowIso();
    }

    // 2) Cas particulier : fiche de réparation avec numéro provisoire
    if (entity === 'ticket' && payload._provisionalNumber) {
        const oldId = String(payload.id || entityId);
        const idb = await getDB();
        const localTickets = (await idb.getAll('tickets')).filter((t: RepairTicket) => t.id !== oldId) as RepairTicket[];
        const isEnterprise = Boolean((payload.client as Record<string, unknown> | undefined)?.isEnterprise);
        const year = typeof payload.createdAt === 'string' ? new Date(payload.createdAt).getFullYear() : undefined;
        const prefix = seriesPrefix(isEnterprise, year);

        // Pré-lecture anti-doublon AVANT toute renumérotation : vérifier si `oldId` existe déjà dans le Cloud
        let sameTicketMatchOnCloud = false;
        try {
            const existingSnap = await getDoc(doc(db, collectionName, oldId));
            if (existingSnap.exists()) {
                const existingCloud = { id: existingSnap.id, ...(existingSnap.data() as Record<string, unknown>) };
                if (isSameTicket(payload, existingCloud)) {
                    sameTicketMatchOnCloud = true;
                }
            }
        } catch { /* on vérifiera dans la transaction */ }

        let candidateId = oldId;
        let usedTicketsOnlyFallback = false;

        if (!sameTicketMatchOnCloud) {
            try {
                const reservation = await reserveTicketNumberWithFallback(localTickets, isEnterprise, year, oldId, payload);
                candidateId = reservation.id;
                usedTicketsOnlyFallback = reservation.usedTicketsOnlyFallback;
            } catch (err) {
                // Repli ultime si même la pré-lecture a échoué : on laisse la transaction `tickets` décider
                usedTicketsOnlyFallback = true;
                candidateId = oldId;
                console.warn('[cloudWrite] Pré-réservation compteur échouée, transaction directe sur tickets :', err);
            }
        }

        // Pré-déshydratation des médias avant la transaction (les empreintes média sont indépendantes du n° de fiche)
        let baseCloudPayload: Record<string, unknown>;
        try {
            baseCloudPayload = clean(await dehydrateForCloud(payload));
        } catch (mediaErr) {
            console.warn('[cloudWrite] Envoi des médias impossible, repli compressé :', mediaErr);
            baseCloudPayload = clean(await optimizeTicketForFirestore(payload as unknown as RepairTicket)) as unknown as Record<string, unknown>;
        }

        const cloudMax = usedTicketsOnlyFallback
            ? await cloudMaxForPrefix(prefix, isEnterprise, year).catch(() => 0)
            : 0;
        const localMax = localTickets.reduce((m, t) => {
            const n = extractTicketSequenceNumber(t?.id, isEnterprise, year);
            return n && n > m ? n : m;
        }, 0);

        const txResult = await runTransaction(db, async (tx) => {
            const initialRef = doc(db, collectionName, candidateId);
            const initialSnap = await tx.get(initialRef);

            if (!initialSnap.exists()) {
                const cloudReady = applyRenumberingToTicket(baseCloudPayload, oldId, candidateId, auth.currentUser?.email);
                tx.set(initialRef, cloudReady);
                return { committedId: candidateId, merged: cloudReady, mergedDuplicateAvoided: false };
            }

            // Anti-doublon prioritaire : comparer la fiche locale avec la fiche Cloud portant ce numéro
            const existingCloud = { id: initialSnap.id, ...(initialSnap.data() as Record<string, unknown>) };
            const resolution = resolveProvisionalAgainstCloud(baseCloudPayload, existingCloud);

            if (resolution.action === 'merge') {
                const mergedOut = clean(resolution.ticket) as Record<string, unknown>;
                delete mergedOut._provisionalNumber;
                tx.set(initialRef, mergedOut);
                return { committedId: candidateId, merged: mergedOut, mergedDuplicateAvoided: true };
            }

            // Sinon, vraie collision avec une AUTRE fiche : trouver le prochain numéro libre sans jamais écraser
            const candidateSeq = extractTicketSequenceNumber(candidateId, isEnterprise, year) || 0;
            let nextSeq = Math.max(localMax, cloudMax, candidateSeq) + 1;
            for (let guard = 0; guard < 35; guard++) {
                const nextId = formatTicketSequence(prefix, nextSeq);
                if (!localTickets.some(t => t?.id === nextId)) {
                    const nextRef = doc(db, collectionName, nextId);
                    const nextSnap = await tx.get(nextRef);
                    if (!nextSnap.exists()) {
                        const cloudReady = applyRenumberingToTicket(baseCloudPayload, oldId, nextId, auth.currentUser?.email);
                        tx.set(nextRef, cloudReady);
                        return { committedId: nextId, merged: cloudReady, mergedDuplicateAvoided: false };
                    }
                }
                nextSeq++;
            }
            throw new Error(`Aucun numéro libre disponible dans ${prefix} pour renuméroter #${oldId}`);
        });

        // Confirmation serveur acquise : mise à jour locale sûre
        const finalId = txResult.committedId;
        const finalLocalTicket = applyRenumberingToTicket(payload, oldId, finalId, auth.currentUser?.email);

        if (txResult.mergedDuplicateAvoided) {
            const resolvedLocal = resolveProvisionalAgainstCloud(payload, finalLocalTicket);
            delete resolvedLocal.ticket._provisionalNumber;
            await dbPutDirect('tickets', resolvedLocal.ticket);
            addSyncLog(
                'Cloud Realtime',
                'Flux Temps Réel',
                'success',
                auth.currentUser?.email || 'Opérateur Local',
                `Dossier #${finalId} confirmé sans doublon : fusion champ par champ effectuée avec la copie Cloud.`
            );
        } else {
            await dbPutDirect('tickets', finalLocalTicket);
        }

        if (finalId !== oldId) {
            await dbDeleteDirect('tickets', oldId);
            await replaceTicketReferences(oldId, finalId);
            addSyncLog(
                'Cloud Realtime',
                'Flux Temps Réel',
                'success',
                auth.currentUser?.email || 'Opérateur Local',
                `Dossier #${oldId} envoyé et renuméroté en #${finalId}${usedTicketsOnlyFallback ? ' (via repli collection tickets)' : ''}.`
            );
            window.dispatchEvent(new CustomEvent('ticketrenumbered', { detail: { oldId, newId: finalId } }));
            window.dispatchEvent(new CustomEvent('datareceived'));
            window.dispatchEvent(new CustomEvent('tickets-updated'));
        }

        // Répercuter localement d'éventuels ajouts serveur
        if (txResult.mergedDuplicateAvoided || stableStringify(txResult.merged) !== stableStringify(applyRenumberingToTicket(baseCloudPayload, oldId, finalId, auth.currentUser?.email))) {
            try {
                await warmMediaCacheFromRecord(finalLocalTicket);
                const hydrated = await hydrateFromCloudBestEffort(txResult.merged, !isQuotaCooldownActive());
                const latestLocal = await dbGet('tickets', finalId);
                const safeHydrated = latestLocal && hydrated.unresolvedRefs > 0
                    ? mergeUnresolvedMediaFallback(latestLocal, hydrated.data)
                    : hydrated.data;
                const finalMergedLocal = latestLocal
                    ? (mergeUpdates('ticket', latestLocal, safeHydrated) as Record<string, unknown>)
                    : safeHydrated;
                delete (finalMergedLocal as Record<string, unknown>)._provisionalNumber;
                await dbPutDirect('tickets', finalMergedLocal);
                window.dispatchEvent(new CustomEvent('datareceived', { detail: [{ entity: 'ticket', id: finalId }] }));
            } catch (e) {
                console.warn('[cloudWrite] Mise à jour locale après fusion différée :', e);
            }
        }

        return {
            finalId,
            renumberedFrom: finalId !== oldId ? oldId : undefined,
            usedTicketsOnlyFallback,
            mergedDuplicateAvoided: txResult.mergedDuplicateAvoided,
        };
    }

    // 3) Cas standard (nouvelle fiche déjà numérotée ou modification / autre entité)
    const targetId = String(payload.id || entityId);
    let cloudPayload: Record<string, unknown>;
    try {
        cloudPayload = clean(await dehydrateForCloud(payload));
    } catch (mediaErr) {
        console.warn('[cloudWrite] Envoi des médias impossible, repli compressé :', mediaErr);
        cloudPayload = entity === 'ticket'
            ? clean(await optimizeTicketForFirestore(payload as unknown as RepairTicket)) as unknown as Record<string, unknown>
            : payload;
    }

    // 4) Fusion transactionnelle avec la version serveur (sauf journaux de session en écriture directe)
    const docRef = doc(db, collectionName, targetId);
    let merged: Record<string, unknown>;
    if (entity === 'deviceSession') {
        await setDoc(docRef, cloudPayload, { merge: true });
        merged = cloudPayload;
    } else {
        merged = await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);
            let out: Record<string, unknown> = cloudPayload;
            if (snap.exists()) out = clean(mergeUpdates(entity, snap.data(), cloudPayload) as Record<string, unknown>);
            tx.set(docRef, out);
            return out;
        });
    }

    // 5) Répercuter localement ce que d'autres appareils avaient ajouté
    if (storeName && stableStringify(merged) !== stableStringify(cloudPayload)) {
        try {
            await warmMediaCacheFromRecord(payload);
            const hydrated = await hydrateFromCloudBestEffort(merged, !isQuotaCooldownActive());
            const latestLocal = await dbGet(storeName, targetId);
            const safeHydrated = latestLocal && hydrated.unresolvedRefs > 0
                ? mergeUnresolvedMediaFallback(latestLocal, hydrated.data)
                : hydrated.data;
            const finalLocal = latestLocal ? mergeUpdates(entity, latestLocal, safeHydrated) : safeHydrated;
            await dbPutDirect(storeName, finalLocal);
            window.dispatchEvent(new CustomEvent('datareceived', { detail: [{ entity, id: targetId }] }));
        } catch (e) {
            console.warn('[cloudWrite] Mise à jour locale après fusion différée :', e);
        }
    }

    return { finalId: targetId };
};

/**
 * Envoie une entité vers Firestore avec fusion transactionnelle.
 * Retourne l'identifiant effectivement écrit (peut changer pour un numéro provisoire).
 */
export const pushEntityToCloud = async (
    entity: EntityType,
    collectionName: string,
    entityId: string,
    queuedPayload: unknown,
): Promise<string> => {
    const res = await pushEntityToCloudDetailed(entity, collectionName, entityId, queuedPayload);
    return res.finalId;
};
