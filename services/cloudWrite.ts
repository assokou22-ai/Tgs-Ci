// Écriture fiable d'une entité vers Firestore :
//  - la version la plus récente de l'appareil est envoyée (pas un instantané périmé de la file) ;
//  - les photos/fichiers lourds partent dans la collection `media` (la fiche reste < 1 Mo) ;
//  - la fusion avec la version du serveur se fait dans une transaction (aucune écriture perdue) ;
//  - la copie locale garde les photos en pleine qualité.
import { doc, runTransaction, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase.ts';
import { dbGet, dbPutDirect, dbDeleteDirect, dbQueuePut, getDB } from './dbService.ts';
import { dehydrateForCloud, hydrateFromCloud } from './cloudMedia.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { stableStringify } from '../utils/fieldMerge.ts';
import { optimizeTicketForFirestore } from '../utils/imageCompression.ts';
import { reserveTicketNumber, canUseCloudCounter } from './ticketCounter.ts';
import { serverNowIso } from './syncClock.ts';
import { addSyncLog } from '../utils/syncLogHelper.ts';
import type { EntityType, RepairTicket } from '../types.ts';

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
    ['externalPurchases', 'externalPurchase'],
];

const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? {}));

/** Remplace l'ancien numéro par le nouveau dans les documents liés (factures, RDV, stock…). */
const replaceTicketReferences = async (oldId: string, newId: string) => {
    const idb = await getDB();
    for (const [store, entity] of REFERENCE_STORES) {
        let all: Array<Record<string, unknown>> = [];
        try { all = await idb.getAll(store); } catch { continue; }
        for (const rec of all) {
            let changed = false;
            const next: Record<string, unknown> = { ...rec };
            for (const [k, v] of Object.entries(rec)) {
                if (k === 'id') continue;
                if (v === oldId) { next[k] = newId; changed = true; }
                else if (Array.isArray(v) && v.includes(oldId)) { next[k] = v.map(x => (x === oldId ? newId : x)); changed = true; }
            }
            if (changed && next.id !== undefined) {
                next.updatedAt = serverNowIso();
                await dbPutDirect(store, next);
                await dbQueuePut(entity, String(next.id), next);
            }
        }
    }
};

/**
 * Confirme un numéro provisoire (créé hors ligne). Retourne l'identifiant définitif.
 * Si le numéro a été pris entre-temps par un autre appareil, la fiche est renumérotée.
 */
export const finalizeProvisionalTicket = async (ticket: RepairTicket & Record<string, unknown>): Promise<RepairTicket & Record<string, unknown>> => {
    if (!ticket?._provisionalNumber || !canUseCloudCounter()) return ticket;
    const oldId = ticket.id;
    const idb = await getDB();
    const localTickets = (await idb.getAll('tickets')).filter((t: RepairTicket) => t.id !== oldId) as RepairTicket[];
    const year = ticket.createdAt ? new Date(ticket.createdAt).getFullYear() : undefined;
    const finalId = await reserveTicketNumber(localTickets, Boolean(ticket.client?.isEnterprise), year, oldId);

    const finalTicket: RepairTicket & Record<string, unknown> = { ...ticket, id: finalId };
    delete finalTicket._provisionalNumber;

    if (finalId !== oldId) {
        finalTicket.history = [
            ...(ticket.history || []),
            ({
                timestamp: serverNowIso(),
                user: auth.currentUser?.email || 'Système',
                action: `Renumérotation automatique : le numéro provisoire #${oldId} (créé hors ligne) était déjà utilisé sur un autre appareil. Nouveau numéro officiel : #${finalId}.`,
            } as unknown as RepairTicket['history'][number]),
        ];
        finalTicket.updatedAt = serverNowIso();
        await dbPutDirect('tickets', finalTicket);
        await dbDeleteDirect('tickets', oldId);
        await replaceTicketReferences(oldId, finalId);
        addSyncLog('Cloud Realtime', 'Flux Temps Réel', 'success', auth.currentUser?.email || 'Opérateur Local',
            `Dossier hors ligne #${oldId} renuméroté en #${finalId} (numéro déjà attribué ailleurs).`);
        window.dispatchEvent(new CustomEvent('ticketrenumbered', { detail: { oldId, newId: finalId } }));
        window.dispatchEvent(new CustomEvent('datareceived'));
    } else {
        await dbPutDirect('tickets', finalTicket);
    }
    return finalTicket;
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
    const storeName = STORE_BY_ENTITY[entity];
    // 1) Version la plus récente présente sur l'appareil
    let current: Record<string, unknown> | null = null;
    if (storeName && entity !== 'suggestions') {
        try { current = await dbGet(storeName, entityId); } catch { current = null; }
    }
    if (!current && entity === 'ticket' && (queuedPayload as Record<string, unknown>)?._provisionalNumber) {
        // Fiche provisoire déjà renumérotée lors d'un envoi précédent : rien à faire
        return entityId;
    }
    let payload = clean((current || queuedPayload || {}) as Record<string, unknown>);
    if (payload.id !== undefined && payload.id !== null) payload.id = String(payload.id);
    if (payload.ticketId !== undefined && payload.ticketId !== null) payload.ticketId = String(payload.ticketId);
    if (entity !== 'suggestions' && (!payload.updatedAt || typeof payload.updatedAt !== 'string')) {
        payload.updatedAt = serverNowIso();
    }

    // 2) Numéro provisoire → numéro officiel
    let targetId = entityId;
    if (entity === 'ticket' && payload._provisionalNumber) {
        payload = clean(await finalizeProvisionalTicket(payload as RepairTicket & Record<string, unknown>));
        targetId = String(payload.id);
    }

    // 3) Photos et fichiers lourds hors de la fiche
    let cloudPayload: Record<string, unknown>;
    try {
        cloudPayload = clean(await dehydrateForCloud(payload));
    } catch (mediaErr) {
        // Repli (ex. règles `media` non encore déployées) : copie compressée UNIQUEMENT pour le Cloud
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
            const hydrated = await hydrateFromCloud(merged);
            const latestLocal = await dbGet(storeName, targetId);
            const finalLocal = latestLocal ? mergeUpdates(entity, latestLocal, hydrated) : hydrated;
            await dbPutDirect(storeName, finalLocal);
            window.dispatchEvent(new CustomEvent('datareceived', { detail: [{ entity, id: targetId }] }));
        } catch (e) {
            console.warn('[cloudWrite] Mise à jour locale après fusion différée :', e);
        }
    }
    return targetId;
};
