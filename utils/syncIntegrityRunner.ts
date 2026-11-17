import type { RepairTicket } from '../types.ts';
import { RepairStatus } from '../types.ts';
import {
    computeUnsyncedTickets,
    getSyncHeadlineStatus,
    isSameTicket,
    resolveProvisionalAgainstCloud,
    type TicketLike,
} from './ticketSyncLogic.ts';
import { reserveTicketNumberOnTicketsOnly } from '../services/ticketCounter.ts';
import { mergeDatabaseFromFile } from '../services/backupService.ts';

export interface SyncSelfTestCaseResult {
    id: 'a' | 'b' | 'c' | 'd';
    title: string;
    passed: boolean;
    details: string;
}

export interface SyncSelfTestSuiteResult {
    allPassed: boolean;
    executedAt: string;
    results: SyncSelfTestCaseResult[];
}

const makeTicket = (overrides: Partial<RepairTicket> & Record<string, unknown>): RepairTicket & Record<string, unknown> => {
    const base: RepairTicket & Record<string, unknown> = {
        id: '26-RM-0895',
        createdAt: '2026-11-16T10:15:30.120Z',
        updatedAt: '2026-11-16T10:15:30.120Z',
        client: {
            id: 'cli-test-1',
            name: 'Kouamé Jean',
            phone: '0700000001',
            email: '',
            createdAt: '2026-11-16T10:15:30.120Z',
            updatedAt: '2026-11-16T10:15:30.120Z',
        },
        macModel: 'MacBook Pro M2 14"',
        serialNumber: 'C02TEST12345',
        problemDescription: 'Ne démarre plus',
        status: RepairStatus.DIAGNOSTIC,
        history: [
            {
                timestamp: '2026-11-16T10:15:30.120Z',
                status: RepairStatus.DIAGNOSTIC,
                user: 'Accueil',
                action: 'Création fiche',
            },
        ],
        technicianNotes: 'Note initiale',
        services: [],
        costs: { diagnostic: 0, repair: 0, total: 0, advance: 0 },
        diagnosticSheetB: { images: [] },
    };
    return { ...base, ...overrides };
};

/**
 * Exécute les 4 tests d'intégrité de synchronisation strictement en mémoire
 * (zéro lecture ni écriture vers Firestore Cloud ou Google Drive réel).
 */
export const runSyncIntegritySelfTests = async (): Promise<SyncSelfTestSuiteResult> => {
    const results: SyncSelfTestCaseResult[] = [];

    // (a) Fiche provisoire identique à une fiche Cloud -> fusion sans doublon, même numéro conservé
    try {
        const localProvisional = makeTicket({
            id: '26-RM-0895',
            _provisionalNumber: true,
            createdAt: '2026-11-16T10:15:30.150Z',
            updatedAt: '2026-11-16T10:25:00.000Z',
            client: {
                id: 'cli-local',
                name: '  kouamé   jean ',
                phone: '0700000001',
                createdAt: '2026-11-16T10:15:30.150Z',
                updatedAt: '2026-11-16T10:15:30.150Z',
            },
            macModel: 'MacBook Pro M2 14"',
            serialNumber: 'C02TEST12345',
            intakeImages: ['data:image/jpeg;base64,LOCAL_INTAKE_1'],
            technicianNotes: 'Observation locale atelier',
        });

        const cloudExisting = makeTicket({
            id: '26-RM-0895',
            createdAt: '2026-11-16T10:15:30.890Z',
            updatedAt: '2026-11-16T10:20:00.000Z',
            client: {
                id: 'cli-cloud',
                name: 'Kouame Jean',
                phone: '0700000001',
                createdAt: '2026-11-16T10:15:30.890Z',
                updatedAt: '2026-11-16T10:20:00.000Z',
            },
            macModel: 'MacBook Pro M2 14"',
            serialNumber: 'C02TEST12345',
            diagnosticImages: ['data:image/jpeg;base64,CLOUD_DIAG_1'],
            history: [
                {
                    timestamp: '2026-11-16T10:15:30.120Z',
                    status: RepairStatus.DIAGNOSTIC,
                    user: 'Accueil',
                    action: 'Création fiche',
                },
                {
                    timestamp: '2026-11-16T10:20:00.000Z',
                    status: RepairStatus.DIAGNOSTIC_OK,
                    user: 'Tech',
                    action: 'Diagnostic terminé',
                },
            ],
            technicianNotes: 'Note Cloud complémentaire',
        });

        const same = isSameTicket(localProvisional, cloudExisting);
        const resolution = resolveProvisionalAgainstCloud(localProvisional, cloudExisting);

        // Vérifier également que le compteur de repli garde le numéro au lieu d'incrémenter à 0896
        const cloudStore: Record<string, TicketLike> = {
            '26-RM-0895': cloudExisting,
        };
        const reservedId = await reserveTicketNumberOnTicketsOnly(
            [localProvisional as RepairTicket],
            false,
            2026,
            '26-RM-0895',
            {
                getCloudMaxForPrefix: async () => 895,
                getCloudTicketInTx: async (candidate) => cloudStore[candidate] || null,
            },
            localProvisional,
        );

        const hasBothPhotos =
            Array.isArray(resolution.ticket.intakeImages) &&
            resolution.ticket.intakeImages.includes('data:image/jpeg;base64,LOCAL_INTAKE_1') &&
            Array.isArray(resolution.ticket.diagnosticImages) &&
            resolution.ticket.diagnosticImages.includes('data:image/jpeg;base64,CLOUD_DIAG_1');
        const historyList = resolution.ticket.history || [];
        const hasHistoryMerged =
            historyList.length === 2 &&
            historyList.some(h => h.action === 'Création fiche') &&
            historyList.some(h => h.action === 'Diagnostic terminé');
        const hasBothNotes =
            String(resolution.ticket.technicianNotes || '').includes('Observation locale atelier') &&
            String(resolution.ticket.technicianNotes || '').includes('Note Cloud complémentaire');
        const passed =
            same === true &&
            resolution.action === 'merge' &&
            resolution.ticket.id === '26-RM-0895' &&
            resolution.ticket._provisionalNumber === undefined &&
            reservedId === '26-RM-0895' &&
            hasBothPhotos &&
            hasHistoryMerged &&
            hasBothNotes;

        results.push({
            id: 'a',
            title: 'Anti-doublon (fiche provisoire identique au Cloud)',
            passed,
            details: passed
                ? 'isSameTicket=true, action=merge, numéro conservé (26-RM-0895), _provisionalNumber retiré, photos + historique + notes préservés.'
                : `Échec attendu: same=${same}, action=${resolution.action}, id=${resolution.ticket.id}, reservedId=${reservedId}, photos=${hasBothPhotos}, history=${historyList.length}, notes=${hasBothNotes}`,
        });
    } catch (err) {
        results.push({
            id: 'a',
            title: 'Anti-doublon (fiche provisoire identique au Cloud)',
            passed: false,
            details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
        });
    }

    // (b) Vrai conflit (même numéro, client/date différents) -> renumérotation obligatoire
    try {
        const localConflict = makeTicket({
            id: '26-RM-0895',
            _provisionalNumber: true,
            createdAt: '2026-11-16T14:20:00.000Z',
            client: {
                id: 'cli-b',
                name: 'Traoré Moussa',
                phone: '0500000002',
                createdAt: '2026-11-16T14:20:00.000Z',
                updatedAt: '2026-11-16T14:20:00.000Z',
            },
            macModel: 'MacBook Air M1',
            serialNumber: 'C02CONFLICT99',
        });

        const cloudDifferent = makeTicket({
            id: '26-RM-0895',
            createdAt: '2026-11-16T09:10:00.000Z',
            client: {
                id: 'cli-a',
                name: 'Kouamé Jean',
                phone: '0700000001',
                createdAt: '2026-11-16T09:10:00.000Z',
                updatedAt: '2026-11-16T09:10:00.000Z',
            },
            macModel: 'MacBook Pro M2 14"',
            serialNumber: 'C02TEST12345',
        });

        const same = isSameTicket(localConflict, cloudDifferent);
        const resolution = resolveProvisionalAgainstCloud(localConflict, cloudDifferent);

        const cloudStore: Record<string, TicketLike> = {
            '26-RM-0895': cloudDifferent,
        };
        const newNumber = await reserveTicketNumberOnTicketsOnly(
            [localConflict as RepairTicket],
            false,
            2026,
            '26-RM-0895',
            {
                getCloudMaxForPrefix: async () => 895,
                getCloudTicketInTx: async (candidate) => cloudStore[candidate] || null,
            },
            localConflict,
        );

        const passed =
            same === false &&
            resolution.action === 'renumber' &&
            newNumber !== '26-RM-0895' &&
            newNumber === '26-RM-0896';

        results.push({
            id: 'b',
            title: 'Vrai conflit multi-postes -> renumérotation sûre',
            passed,
            details: passed
                ? `isSameTicket=false, action=renumber, nouveau numéro alloué: ${newNumber} (aucun écrasement de 26-RM-0895).`
                : `Échec attendu: same=${same}, action=${resolution.action}, newNumber=${newNumber}`,
        });
    } catch (err) {
        results.push({
            id: 'b',
            title: 'Vrai conflit multi-postes -> renumérotation sûre',
            passed: false,
            details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
        });
    }

    // (c) Statut honnête -> détecte fiche non envoyée ou provisoire, n'affiche JAMAIS "Instance Parfaitement à Jour"
    try {
        const localTickets = [
            makeTicket({ id: '26-RM-0895', client: { id: 'c1', name: 'Client 1', phone: '01', createdAt: '', updatedAt: '' } }),
            makeTicket({ id: '26-RM-0896', client: { id: 'c2', name: 'Diallo Fatou', phone: '02', createdAt: '', updatedAt: '' }, macModel: 'MacBook Air M3' }),
            makeTicket({ id: '26-RM-0897', _provisionalNumber: true, client: { id: 'c3', name: 'Bamba Ali', phone: '03', createdAt: '', updatedAt: '' }, macModel: 'iMac 24"' }),
        ];
        const cloudIds = new Set(['26-RM-0895', '26-RM-0897']);
        const unsynced = computeUnsyncedTickets(localTickets, cloudIds);
        const status = getSyncHeadlineStatus({
            isOnline: true,
            isQuotaExceeded: false,
            unsyncedTicketsCount: unsynced.length,
            pendingChanges: unsynced.length,
            lastPushSucceeded: true,
            lastError: null,
        });

        const forbiddenPhrases = [
            'Instance Parfaitement à Jour',
            'Instance parfaitement à jour',
            'Aucune en attente',
            'SYNC CLOUD OK',
            'Base locale à jour',
            'Drive : Synchronisé',
        ];
        const usesForbidden = forbiddenPhrases.some(p => status.headline.toLowerCase().includes(p.toLowerCase()));
        const passed =
            unsynced.length === 2 &&
            unsynced.some(u => u.id === '26-RM-0896' && u.missingFromCloud) &&
            unsynced.some(u => u.id === '26-RM-0897' && u.isProvisional) &&
            status.severity === 'orange' &&
            status.headline === '2 fiche(s) non envoyée(s)' &&
            !usesForbidden;

        results.push({
            id: 'c',
            title: 'Statut honnête (détection locale vs Cloud)',
            passed,
            details: passed
                ? `Détecté ${unsynced.length} fiche(s) (26-RM-0896 absente Cloud, 26-RM-0897 provisoire) -> statut orange "${status.headline}".`
                : `Échec attendu: unsynced=${unsynced.length}, severity=${status.severity}, headline="${status.headline}"`,
        });
    } catch (err) {
        results.push({
            id: 'c',
            title: 'Statut honnête (détection locale vs Cloud)',
            passed: false,
            details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
        });
    }

    // (d) Import de backup -> déclenche automatiquement la fonction d'envoi Cloud avec les fiches importées
    try {
        const memoryStores = new Map<string, Map<string, unknown>>();
        let pushHookCalledCount = 0;
        let pushedTicketsFromHook: RepairTicket[] = [];

        const backupPayload = {
            tickets: [
                makeTicket({ id: '26-RM-0890', updatedAt: '2026-11-15T09:00:00.000Z' }),
                makeTicket({ id: '26-RM-0891', updatedAt: '2026-11-16T11:30:00.000Z' }),
            ],
        };

        await mergeDatabaseFromFile(backupPayload, undefined, {
            dbGet: async (storeName, id) => memoryStores.get(storeName)?.get(id) ?? null,
            dbPutDirect: async (storeName, item) => {
                if (!memoryStores.has(storeName)) memoryStores.set(storeName, new Map());
                const rec = item as Record<string, unknown>;
                const id = String(rec.id || rec.category || '');
                if (id) memoryStores.get(storeName)!.set(id, item);
            },
            onAfterImportTickets: async (tickets) => {
                pushHookCalledCount++;
                pushedTicketsFromHook = tickets;
            },
        });

        const storedTicketCount = memoryStores.get('tickets')?.size ?? 0;
        const pushedIds = pushedTicketsFromHook.map(t => t.id).sort();
        const passed =
            storedTicketCount === 2 &&
            pushHookCalledCount === 1 &&
            pushedIds.length === 2 &&
            pushedIds[0] === '26-RM-0890' &&
            pushedIds[1] === '26-RM-0891';

        results.push({
            id: 'd',
            title: 'Import backup JSON -> déclenchement automatique envoi Cloud',
            passed,
            details: passed
                ? `2 fiches fusionnées en mémoire et hook d'envoi Cloud déclenché automatiquement (${pushedIds.join(', ')}).`
                : `Échec attendu: stored=${storedTicketCount}, pushCalls=${pushHookCalledCount}, ids=${pushedIds.join(',')}`,
        });
    } catch (err) {
        results.push({
            id: 'd',
            title: 'Import backup JSON -> déclenchement automatique envoi Cloud',
            passed: false,
            details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
        });
    }

    return {
        allPassed: results.every(r => r.passed),
        executedAt: new Date().toISOString(),
        results,
    };
};
