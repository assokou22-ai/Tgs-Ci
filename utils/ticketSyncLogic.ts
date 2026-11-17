import type { HistoryEntry, RepairTicket } from '../types.ts';
import { mergeUpdates } from './merge.ts';

export type TicketLike = Partial<RepairTicket> & Record<string, unknown>;

export interface ProvisionalResolution {
    action: 'merge' | 'renumber' | 'keep';
    ticket: RepairTicket & Record<string, unknown>;
}

export interface UnsyncedTicketSummary {
    id: string;
    clientName: string;
    macModel: string;
    isProvisional: boolean;
    missingFromCloud: boolean;
    createdAt?: string;
}

const cleanClone = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? {}));

export const normalizeClientName = (raw?: string | null): string => {
    if (!raw || typeof raw !== 'string') return '';
    return raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
};

export const toCreatedAtSecond = (raw?: unknown): number | null => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return Math.floor(raw / 1000);
    }
    if (typeof raw === 'string') {
        const ms = Date.parse(raw);
        if (!Number.isFinite(ms) || ms <= 0) return null;
        return Math.floor(ms / 1000);
    }
    if (raw instanceof Date) {
        const ms = raw.getTime();
        if (!Number.isFinite(ms) || ms <= 0) return null;
        return Math.floor(ms / 1000);
    }
    if (typeof raw === 'object' && 'seconds' in (raw as Record<string, unknown>)) {
        const sec = Number((raw as Record<string, unknown>).seconds);
        return Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : null;
    }
    return null;
};

const EMPTY_SERIALS = new Set(['', 'N/A', 'NA', 'NEANT', 'NÉANT', '-', 'INCONNU', 'NONE']);

export const normalizeSerial = (raw?: unknown): string => {
    if (!raw || typeof raw !== 'string') return '';
    const norm = raw.trim().toUpperCase().replace(/\s+/g, '');
    return EMPTY_SERIALS.has(norm) ? '' : norm;
};

export const normalizeModel = (raw?: unknown): string => {
    if (!raw || typeof raw !== 'string') return '';
    return raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
};

const extractClientName = (t: TicketLike | null | undefined): string => {
    if (!t) return '';
    const clientObj = t.client as Record<string, unknown> | undefined;
    const raw =
        (clientObj && typeof clientObj.name === 'string' ? clientObj.name : undefined) ??
        (typeof t.clientName === 'string' ? t.clientName : undefined) ??
        (typeof t.customerName === 'string' ? t.customerName : undefined);
    return raw || '';
};

/**
 * Détermine si une fiche locale provisoire et une fiche Cloud portant le même numéro
 * représentent en réalité le MÊME dossier (ex: envoyé mais réponse réseau coupée avant acquittement).
 *
 * Critères :
 * - même `createdAt` à la seconde près
 * - ET même nom de client normalisé (trim, minuscules, sans accents)
 * - ET (même numéro de série OU même modèle), sans contradiction de numéro de série non vide.
 */
export const isSameTicket = (local: TicketLike | null | undefined, cloud: TicketLike | null | undefined): boolean => {
    if (!local || !cloud) return false;

    const localSec = toCreatedAtSecond(local.createdAt);
    const cloudSec = toCreatedAtSecond(cloud.createdAt);
    if (localSec === null || cloudSec === null || localSec !== cloudSec) {
        return false;
    }

    const localName = normalizeClientName(extractClientName(local));
    const cloudName = normalizeClientName(extractClientName(cloud));
    if (!localName || !cloudName || localName !== cloudName) {
        return false;
    }

    const localSerial = normalizeSerial(local.serialNumber);
    const cloudSerial = normalizeSerial(cloud.serialNumber);
    const hasSerialConflict = Boolean(localSerial && cloudSerial && localSerial !== cloudSerial);
    if (hasSerialConflict) {
        return false;
    }

    const sameSerial = Boolean(localSerial && cloudSerial && localSerial === cloudSerial);
    const localModel = normalizeModel(local.macModel);
    const cloudModel = normalizeModel(cloud.macModel);
    const sameModel = Boolean(localModel && cloudModel && localModel === cloudModel);

    return sameSerial || sameModel;
};

const mergeUniqueStrings = (...lists: Array<unknown>): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            if (typeof item !== 'string' || !item) continue;
            if (!seen.has(item)) {
                seen.add(item);
                out.push(item);
            }
        }
    }
    return out;
};

const mergeHistoryUnique = (a: unknown, b: unknown): HistoryEntry[] => {
    const map = new Map<string, HistoryEntry>();
    for (const arr of [a, b]) {
        if (!Array.isArray(arr)) continue;
        for (const entry of arr) {
            if (!entry || typeof entry !== 'object') continue;
            const h = entry as HistoryEntry;
            const key = `${h.timestamp || ''}|${h.action || ''}`;
            map.set(key, h);
        }
    }
    return Array.from(map.values()).sort(
        (x, y) => Date.parse(String(x.timestamp || 0)) - Date.parse(String(y.timestamp || 0))
    );
};

/**
 * Résout une fiche marquée `_provisionalNumber` face à une éventuelle fiche Cloud du même numéro :
 * - Si aucune fiche Cloud n'existe pour ce numéro -> `action: 'keep'` (on garde le numéro et retire `_provisionalNumber`).
 * - Si c'est la même fiche (`isSameTicket`) -> `action: 'merge'` (fusion champ par champ sans renumérotation, sans perte de photos/notes/historique).
 * - Si c'est une autre fiche (vrai conflit multi-postes) -> `action: 'renumber'` (attribution d'un nouveau numéro via `reserveTicketNumber`).
 */
export const resolveProvisionalAgainstCloud = (
    local: TicketLike,
    cloud: TicketLike | null | undefined,
): ProvisionalResolution => {
    const localClean = cleanClone(local) as RepairTicket & Record<string, unknown>;

    if (!cloud) {
        delete localClean._provisionalNumber;
        return {
            action: 'keep',
            ticket: localClean,
        };
    }

    if (isSameTicket(localClean, cloud)) {
        const cloudClean = cleanClone(cloud) as RepairTicket & Record<string, unknown>;
        const merged = cleanClone(mergeUpdates('ticket', cloudClean, localClean)) as RepairTicket & Record<string, unknown>;
        merged.id = String(cloudClean.id || localClean.id);
        delete merged._provisionalNumber;

        // Préservation absolue des photos, historique et notes des deux côtés
        const intakeImages = mergeUniqueStrings(cloudClean.intakeImages, localClean.intakeImages);
        if (intakeImages.length > 0 || cloudClean.intakeImages || localClean.intakeImages) {
            merged.intakeImages = intakeImages;
        }
        const diagnosticImages = mergeUniqueStrings(cloudClean.diagnosticImages, localClean.diagnosticImages);
        if (diagnosticImages.length > 0 || cloudClean.diagnosticImages || localClean.diagnosticImages) {
            merged.diagnosticImages = diagnosticImages;
        }
        const restitutionPhotos = mergeUniqueStrings(cloudClean.restitutionPhotos, localClean.restitutionPhotos);
        if (restitutionPhotos.length > 0 || cloudClean.restitutionPhotos || localClean.restitutionPhotos) {
            merged.restitutionPhotos = restitutionPhotos;
        }

        if (merged.diagnosticSheetB || cloudClean.diagnosticSheetB || localClean.diagnosticSheetB) {
            const sheetImages = mergeUniqueStrings(
                cloudClean.diagnosticSheetB?.images,
                localClean.diagnosticSheetB?.images,
                merged.diagnosticSheetB?.images,
            );
            if (merged.diagnosticSheetB && sheetImages.length > 0) {
                merged.diagnosticSheetB = {
                    ...merged.diagnosticSheetB,
                    images: sheetImages,
                };
            }
        }

        merged.history = mergeHistoryUnique(cloudClean.history, localClean.history);

        const localNotes = String(localClean.technicianNotes || '').trim();
        const cloudNotes = String(cloudClean.technicianNotes || '').trim();
        if (localNotes && cloudNotes && localNotes !== cloudNotes) {
            if (!localNotes.includes(cloudNotes) && !cloudNotes.includes(localNotes)) {
                merged.technicianNotes = `[Dépôt local]:\n${localNotes}\n\n[Import distant]:\n${cloudNotes}`;
            } else {
                merged.technicianNotes = localNotes.length >= cloudNotes.length ? localNotes : cloudNotes;
            }
        } else if (localNotes || cloudNotes) {
            merged.technicianNotes = localNotes || cloudNotes;
        }

        return {
            action: 'merge',
            ticket: merged,
        };
    }

    return {
        action: 'renumber',
        ticket: localClean,
    };
};

/**
 * Compare la liste locale de fiches avec l'ensemble des IDs présents dans le Cloud.
 * Retourne toute fiche absente du Cloud OU toujours marquée `_provisionalNumber`.
 */
export const computeUnsyncedTickets = (
    localTickets: TicketLike[],
    cloudIds: Set<string> | Iterable<string>,
): UnsyncedTicketSummary[] => {
    const normalizedCloudIds = new Set<string>();
    for (const id of cloudIds || []) {
        if (typeof id === 'string' && id.trim()) {
            normalizedCloudIds.add(id.trim().toUpperCase());
        }
    }

    const result: UnsyncedTicketSummary[] = [];
    for (const t of localTickets || []) {
        if (!t || !t.id) continue;
        const rawId = String(t.id);
        const normId = rawId.trim().toUpperCase();
        const missingFromCloud = !normalizedCloudIds.has(normId);
        const isProvisional = Boolean(t._provisionalNumber);

        if (missingFromCloud || isProvisional) {
            const clientName = extractClientName(t) || 'Client inconnu';
            const macModel = typeof t.macModel === 'string' && t.macModel.trim()
                ? t.macModel.trim()
                : (typeof t.model === 'string' && t.model.trim() ? t.model.trim() : 'Modèle non renseigné');
            result.push({
                id: rawId,
                clientName,
                macModel,
                isProvisional,
                missingFromCloud,
                createdAt: typeof t.createdAt === 'string' ? t.createdAt : undefined,
            });
        }
    }

    return result.sort((a, b) => Date.parse(a.createdAt || '') - Date.parse(b.createdAt || ''));
};

export interface SyncHeadlineInput {
    isOnline: boolean;
    isQuotaExceeded?: boolean;
    unsyncedTicketsCount: number;
    pendingChanges: number;
    lastPushSucceeded: boolean;
    lastError?: string | null;
    authMissing?: boolean;
    needsInitialSync?: boolean;
}

export const getSyncHeadlineStatus = (input: SyncHeadlineInput): {
    headline: string;
    severity: 'ok' | 'orange' | 'red';
} => {
    const effectiveUnsentCount = Math.max(input.unsyncedTicketsCount, input.pendingChanges);
    if (effectiveUnsentCount > 0) {
        const hasError = Boolean(input.lastError) || !input.lastPushSucceeded || !input.isOnline || Boolean(input.isQuotaExceeded);
        return {
            headline: `${effectiveUnsentCount} fiche(s) non envoyée(s)`,
            severity: hasError ? 'red' : 'orange',
        };
    }
    if (!input.isOnline) {
        return { headline: 'Mode Hors Ligne Actif', severity: 'red' };
    }
    if (input.isQuotaExceeded) {
        return { headline: 'Quota Cloud Journalier Atteint', severity: 'red' };
    }
    if (!input.lastPushSucceeded || input.lastError) {
        return { headline: "Échec d'envoi vers le Cloud", severity: 'red' };
    }
    if (input.authMissing) {
        return { headline: 'Connexion Google Requise', severity: 'orange' };
    }
    if (input.needsInitialSync) {
        return { headline: 'Synchronisation Initiale Requise', severity: 'orange' };
    }
    return { headline: 'Instance Parfaitement à Jour', severity: 'ok' };
};
