import { RepairTicket, Appointment, EngagementSav, DailyActionItem, DailyActionStatus, RepairStatus } from '../types.ts';

// Helper to format Date to YYYY-MM-DD
export const formatDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Helper to format time into "09 h 00" style
export const formatTimeDisplay = (timeStr?: string, defaultHour: string = '08 h 00'): string => {
    if (!timeStr) return defaultHour;
    const clean = timeStr.trim();
    if (clean.includes('h') || clean.includes('H')) return clean;
    if (clean.includes(':')) {
        const [h, m] = clean.split(':');
        return `${h.padStart(2, '0')} h ${m.padStart(2, '0')}`;
    }
    return `${clean.padStart(2, '0')} h 00`;
};

// Helper to subtract days from date string YYYY-MM-DD
export const addDaysToDateStr = (dateStr: string, days: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return formatDateKey(date);
};

// Convert stored completions in localStorage / cache
const STORAGE_COMPLETED_KEY = 'tgs_daily_actions_completed';

export const getCompletedActionIds = (): Record<string, string> => {
    try {
        const raw = localStorage.getItem(STORAGE_COMPLETED_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

export const markActionStatusInStorage = (actionId: string, isDone: boolean): Record<string, string> => {
    const current = getCompletedActionIds();
    if (isDone) {
        current[actionId] = new Date().toISOString();
    } else {
        delete current[actionId];
    }
    try {
        localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(current));
    } catch (e) {
        console.error("Failed to save completed action state", e);
    }
    window.dispatchEvent(new CustomEvent('dailyactionschanged'));
    return current;
};

// Helper to generate the exact French wording for waiting status
export const generateWaitingStatusPhrase = (
    motif: string, 
    dateStr: string, 
    timeStr: string = '10:00',
    type: 'devis' | 'piece' | 'autre' = 'autre'
): string => {
    if (!dateStr) return "En attente (date à planifier)";
    
    // Parse date for French display
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dateFormatted = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const timeFormatted = formatTimeDisplay(timeStr, '10 h 00');

    if (type === 'devis' || motif.toLowerCase().includes('devis')) {
        return `En attente de validation du devis — relancer le ${dateFormatted} à ${timeFormatted}`;
    }
    if (type === 'piece' || motif.toLowerCase().includes('pièce') || motif.toLowerCase().includes('piece')) {
        return `En attente de pièce — arrivée prévue le ${dateFormatted}, point à faire à ${timeFormatted}`;
    }
    return `En attente (${motif}) — point prévu le ${dateFormatted} à ${timeFormatted}`;
};

export interface DailyActionsResult {
    selectedDate: string;
    actions: DailyActionItem[];
    overdueActions: DailyActionItem[];
    allFutureActions: DailyActionItem[];
    stats: {
        totalToday: number;
        todoCount: number;
        doneCount: number;
        overdueCount: number;
        overdueSummaryText: string;
        overdueDevisCount: number;
        overdueRelancesCount: number;
        overdueRdvConfirmCount: number;
    };
}

/**
 * Main function that inspects all tickets, appointments, and engagements
 * and builds the complete 3-stage reminders (J-3, J-1, J-0 at 8h/heure fixée)
 * + calculates overdue actions.
 */
export const calculateAllReminders = (
    tickets: RepairTicket[],
    appointments: Appointment[],
    engagements: EngagementSav[],
    targetDateStr: string = formatDateKey(new Date()),
    completedIds: Record<string, string> = getCompletedActionIds()
): DailyActionsResult => {
    const rawActions: DailyActionItem[] = [];
    const todayStr = formatDateKey(new Date());

    // 1. Process Tickets
    tickets.forEach(ticket => {
        // Only active / non-archived or pending tickets
        const isClosed = ticket.status === RepairStatus.TERMINE || ticket.status === RepairStatus.RENDU || ticket.status === RepairStatus.ANNULE;
        const clientName = ticket.client?.name || 'Client Inconnu';
        const clientPhone = ticket.client?.phone || '';
        const appareil = `${ticket.macBrand || 'Mac'} ${ticket.macModel || ''}`.trim() || 'Appareil Mac';

        // A) RDV de récupération ou date de RDV fixée
        if (ticket.rendezVousDate) {
            const rdvDate = ticket.rendezVousDate;
            const rdvTime = ticket.rendezVousTime || '10:00';
            
            // J-3 : Préparer ou relancer le client
            const j3Date = addDaysToDateStr(rdvDate, -3);
            rawActions.push({
                id: `ticket-${ticket.id}-rdv-j3`,
                heure: '09 h 00',
                clientName,
                clientPhone,
                appareil,
                action: 'Préparer le dossier & relancer le client (J-3)',
                statut: completedIds[`ticket-${ticket.id}-rdv-j3`] ? 'FAIT' : 'A_FAIRE',
                ticketId: ticket.id,
                dateCible: j3Date,
                typeRappel: 'RAPPEL_J3',
                details: `Dossier ${ticket.id} - RDV prévu le ${rdvDate} à ${formatTimeDisplay(rdvTime)}`,
                createdAt: ticket.createdAt
            });

            // J-1 : Confirmer le rendez-vous ou l’avancement
            const j1Date = addDaysToDateStr(rdvDate, -1);
            rawActions.push({
                id: `ticket-${ticket.id}-rdv-j1`,
                heure: '10 h 00',
                clientName,
                clientPhone,
                appareil,
                action: 'Confirmer le rendez-vous',
                statut: completedIds[`ticket-${ticket.id}-rdv-j1`] ? 'FAIT' : 'A_FAIRE',
                ticketId: ticket.id,
                dateCible: j1Date,
                typeRappel: 'CONFIRMATION_J1',
                details: `Dossier ${ticket.id} - Confirmation avant venue prévue le ${rdvDate}`,
                createdAt: ticket.createdAt
            });

            // J-0 : Le jour prévu à 8 h : notification “rendez-vous aujourd’hui”
            rawActions.push({
                id: `ticket-${ticket.id}-rdv-j0-8h`,
                heure: '08 h 00',
                clientName,
                clientPhone,
                appareil,
                action: `Rendez-vous aujourd'hui (${formatTimeDisplay(rdvTime)})`,
                statut: completedIds[`ticket-${ticket.id}-rdv-j0-8h`] ? 'FAIT' : 'A_FAIRE',
                ticketId: ticket.id,
                dateCible: rdvDate,
                typeRappel: 'JOUR_J0_8H',
                details: `Client attendu à l'atelier à ${formatTimeDisplay(rdvTime)} pour récupération`,
                createdAt: ticket.createdAt
            });

            // Action à l'heure du RDV
            if (rdvTime && rdvTime !== '08:00' && rdvTime !== '08 h 00') {
                rawActions.push({
                    id: `ticket-${ticket.id}-rdv-exact`,
                    heure: formatTimeDisplay(rdvTime),
                    clientName,
                    clientPhone,
                    appareil,
                    action: `Accueil Client : Récupération ${appareil}`,
                    statut: completedIds[`ticket-${ticket.id}-rdv-exact`] ? 'FAIT' : 'A_FAIRE',
                    ticketId: ticket.id,
                    dateCible: rdvDate,
                    typeRappel: 'RDV_CLIENT',
                    details: `Restitution de la machine réparée (Fiche ${ticket.id})`,
                    createdAt: ticket.createdAt
                });
            }
        }

        // B) Fiche en attente de validation devis ou relance programmée
        if (ticket.status === RepairStatus.DEVIS_A_VALIDER || ticket.waitingFollowUpDate || (ticket.status === RepairStatus.EN_ATTENTE_DE_PIECES)) {
            // Target date for waiting relance: either explicit waitingFollowUpDate or calculated 2-3 days from creation/update
            let followUpDate = ticket.waitingFollowUpDate;
            if (!followUpDate && !isClosed) {
                // If not set, default to 2 days after creation/update
                const base = ticket.updatedAt || ticket.createdAt;
                const baseDate = base ? new Date(base) : new Date();
                baseDate.setDate(baseDate.getDate() + 2);
                followUpDate = formatDateKey(baseDate);
            }

            if (followUpDate) {
                const time = ticket.waitingFollowUpTime || '11:00';
                const isDevis = ticket.status === RepairStatus.DEVIS_A_VALIDER || (ticket.waitingReason && ticket.waitingReason.toLowerCase().includes('devis'));
                const actionLabel = isDevis ? 'Relancer pour le devis' : 'Point arrivée pièce & relance';

                // J-3
                const j3 = addDaysToDateStr(followUpDate, -3);
                rawActions.push({
                    id: `ticket-${ticket.id}-wait-j3`,
                    heure: '09 h 00',
                    clientName,
                    clientPhone,
                    appareil,
                    action: isDevis ? 'Préparer relance devis (J-3)' : 'Contrôle approvisionnement (J-3)',
                    statut: completedIds[`ticket-${ticket.id}-wait-j3`] ? 'FAIT' : 'A_FAIRE',
                    ticketId: ticket.id,
                    dateCible: j3,
                    typeRappel: 'RAPPEL_J3',
                    details: ticket.waitingStatusLabel || `Dossier ${ticket.id} - ${actionLabel}`,
                    createdAt: ticket.createdAt
                });

                // J-1
                const j1 = addDaysToDateStr(followUpDate, -1);
                rawActions.push({
                    id: `ticket-${ticket.id}-wait-j1`,
                    heure: '10 h 00',
                    clientName,
                    clientPhone,
                    appareil,
                    action: isDevis ? 'Pré-relance devis client' : 'Confirmer date de réception pièce',
                    statut: completedIds[`ticket-${ticket.id}-wait-j1`] ? 'FAIT' : 'A_FAIRE',
                    ticketId: ticket.id,
                    dateCible: j1,
                    typeRappel: 'CONFIRMATION_J1',
                    details: ticket.waitingStatusLabel || `Dossier ${ticket.id}`,
                    createdAt: ticket.createdAt
                });

                // J-0 à 8h
                rawActions.push({
                    id: `ticket-${ticket.id}-wait-j0-8h`,
                    heure: '08 h 00',
                    clientName,
                    clientPhone,
                    appareil,
                    action: actionLabel,
                    statut: completedIds[`ticket-${ticket.id}-wait-j0-8h`] ? 'FAIT' : 'A_FAIRE',
                    ticketId: ticket.id,
                    dateCible: followUpDate,
                    typeRappel: isDevis ? 'RELANCE_DEVIS' : 'ATTENTE_PIECE',
                    details: ticket.waitingStatusLabel || `${actionLabel} (Fiche ${ticket.id})`,
                    createdAt: ticket.createdAt
                });

                // J-0 à l'heure précise (ex: 11 h 00)
                if (time && time !== '08:00' && time !== '08 h 00') {
                    rawActions.push({
                        id: `ticket-${ticket.id}-wait-exact`,
                        heure: formatTimeDisplay(time),
                        clientName,
                        clientPhone,
                        appareil,
                        action: actionLabel,
                        statut: completedIds[`ticket-${ticket.id}-wait-exact`] ? 'FAIT' : 'A_FAIRE',
                        ticketId: ticket.id,
                        dateCible: followUpDate,
                        typeRappel: isDevis ? 'RELANCE_DEVIS' : 'ATTENTE_PIECE',
                        details: ticket.waitingStatusLabel || `Point téléphonique client à effectuer à ${formatTimeDisplay(time)}`,
                        createdAt: ticket.createdAt
                    });
                }
            }
        }

        // C) Postponed tickets
        if (ticket.status === RepairStatus.REPORTE && ticket.postponedUntil) {
            const postDate = ticket.postponedUntil;
            // J-1
            rawActions.push({
                id: `ticket-${ticket.id}-postpone-j1`,
                heure: '10 h 00',
                clientName,
                clientPhone,
                appareil,
                action: 'Préparer fin de report',
                statut: completedIds[`ticket-${ticket.id}-postpone-j1`] ? 'FAIT' : 'A_FAIRE',
                ticketId: ticket.id,
                dateCible: addDaysToDateStr(postDate, -1),
                typeRappel: 'CONFIRMATION_J1',
                details: `Dossier ${ticket.id} en report jusqu'au ${postDate}`,
                createdAt: ticket.createdAt
            });
            // J-0
            rawActions.push({
                id: `ticket-${ticket.id}-postpone-j0`,
                heure: '09 h 00',
                clientName,
                clientPhone,
                appareil,
                action: 'Reprise dossier reporté / Relance client',
                statut: completedIds[`ticket-${ticket.id}-postpone-j0`] ? 'FAIT' : 'A_FAIRE',
                ticketId: ticket.id,
                dateCible: postDate,
                typeRappel: 'JOUR_J0_8H',
                details: `Dossier ${ticket.id} - Date de report échue`,
                createdAt: ticket.createdAt
            });
        }
    });

    // 2. Process Appointments
    appointments.forEach(apt => {
        if (!apt.date) return;
        const aptDate = apt.date;
        const aptTime = apt.time || '10:00';
        const clientName = apt.clientName || 'Client';
        const clientPhone = apt.clientPhone || '';
        const appareil = apt.notes || 'Rendez-vous atelier';

        // J-3
        rawActions.push({
            id: `apt-${apt.id}-j3`,
            heure: '09 h 00',
            clientName,
            clientPhone,
            appareil,
            action: `Préparation RDV (${apt.reason}) (J-3)`,
            statut: completedIds[`apt-${apt.id}-j3`] ? 'FAIT' : 'A_FAIRE',
            appointmentId: apt.id,
            ticketId: apt.ticketId,
            dateCible: addDaysToDateStr(aptDate, -3),
            typeRappel: 'RAPPEL_J3',
            details: `Rendez-vous atelier prévu le ${aptDate} à ${formatTimeDisplay(aptTime)}`,
            createdAt: apt.createdAt || aptDate
        });

        // J-1
        rawActions.push({
            id: `apt-${apt.id}-j1`,
            heure: '10 h 00',
            clientName,
            clientPhone,
            appareil,
            action: 'Confirmer le rendez-vous',
            statut: completedIds[`apt-${apt.id}-j1`] ? 'FAIT' : 'A_FAIRE',
            appointmentId: apt.id,
            ticketId: apt.ticketId,
            dateCible: addDaysToDateStr(aptDate, -1),
            typeRappel: 'CONFIRMATION_J1',
            details: `Confirmation téléphonique/WhatsApp pour RDV du ${aptDate}`,
            createdAt: apt.createdAt || aptDate
        });

        // J-0 à 8h
        rawActions.push({
            id: `apt-${apt.id}-j0-8h`,
            heure: '08 h 00',
            clientName,
            clientPhone,
            appareil,
            action: `Rendez-vous aujourd'hui (${formatTimeDisplay(aptTime)})`,
            statut: completedIds[`apt-${apt.id}-j0-8h`] ? 'FAIT' : 'A_FAIRE',
            appointmentId: apt.id,
            ticketId: apt.ticketId,
            dateCible: aptDate,
            typeRappel: 'JOUR_J0_8H',
            details: `Client attendu pour : ${apt.reason}`,
            createdAt: apt.createdAt || aptDate
        });

        // J-0 à l'heure du RDV
        if (aptTime && aptTime !== '08:00' && aptTime !== '08 h 00') {
            rawActions.push({
                id: `apt-${apt.id}-exact`,
                heure: formatTimeDisplay(aptTime),
                clientName,
                clientPhone,
                appareil,
                action: `Rendez-vous Client : ${apt.reason}`,
                statut: completedIds[`apt-${apt.id}-exact`] ? 'FAIT' : 'A_FAIRE',
                appointmentId: apt.id,
                ticketId: apt.ticketId,
                dateCible: aptDate,
                typeRappel: 'RDV_CLIENT',
                details: apt.notes || `Motif: ${apt.reason}`,
                createdAt: apt.createdAt || aptDate
            });
        }
    });

    // 3. Process Engagements SAV
    engagements.forEach(sav => {
        if (sav.statut === 'CLOS' || sav.statut === 'ANNULE') return;
        const targetDate = sav.prochaineDateAction || sav.datePromesse;
        if (!targetDate) return;

        const clientName = sav.nomClient || 'Client SAV';
        const clientPhone = sav.telephoneClient || '';
        const appareil = sav.appareil || 'Appareil SAV';

        // J-3
        rawActions.push({
            id: `sav-${sav.id}-j3`,
            heure: '09 h 00',
            clientName,
            clientPhone,
            appareil,
            action: 'Vérifier commande pièce SAV (J-3)',
            statut: completedIds[`sav-${sav.id}-j3`] ? 'FAIT' : 'A_FAIRE',
            engagementId: sav.id,
            dateCible: addDaysToDateStr(targetDate, -3),
            typeRappel: 'RAPPEL_J3',
            details: `Contrat SAV ${sav.id} - ${sav.pieceAremplacer || 'Pièce'} (${sav.statut})`,
            createdAt: sav.createdAt
        });

        // J-1
        rawActions.push({
            id: `sav-${sav.id}-j1`,
            heure: '10 h 00',
            clientName,
            clientPhone,
            appareil,
            action: 'Confirmer rendez-vous / avancement SAV',
            statut: completedIds[`sav-${sav.id}-j1`] ? 'FAIT' : 'A_FAIRE',
            engagementId: sav.id,
            dateCible: addDaysToDateStr(targetDate, -1),
            typeRappel: 'CONFIRMATION_J1',
            details: `Relance avant date promise : ${targetDate}`,
            createdAt: sav.createdAt
        });

        // J-0 à 8h
        rawActions.push({
            id: `sav-${sav.id}-j0-8h`,
            heure: '08 h 00',
            clientName,
            clientPhone,
            appareil,
            action: 'Action SAV du jour : ' + (sav.motif || 'Suivi promesse client'),
            statut: completedIds[`sav-${sav.id}-j0-8h`] ? 'FAIT' : 'A_FAIRE',
            engagementId: sav.id,
            dateCible: targetDate,
            typeRappel: 'SAV_PROMESSE',
            details: `SAV ${sav.id} - Promesse échue le ${targetDate}`,
            createdAt: sav.createdAt
        });
    });

    // Deduplicate by ID
    const actionMap = new Map<string, DailyActionItem>();
    rawActions.forEach(a => {
        if (!actionMap.has(a.id)) {
            actionMap.set(a.id, a);
        }
    });
    const uniqueActions = Array.from(actionMap.values());

    // Filter for the selected date
    const actionsForSelectedDate = uniqueActions
        .filter(a => a.dateCible === targetDateStr)
        .sort((a, b) => a.heure.localeCompare(b.heure));

    // Overdue items: any item with dateCible < todayStr (or < targetDateStr if viewing past/future) and statut !== 'FAIT'
    const overdueActions = uniqueActions
        .filter(a => a.dateCible < todayStr && a.statut !== 'FAIT')
        .map(a => ({ ...a, statut: 'EN_RETARD' as DailyActionStatus, isOverdue: true }))
        .sort((a, b) => b.dateCible.localeCompare(a.dateCible));

    // Breakdown for overdue summary
    let overdueDevisCount = 0;
    let overdueRelancesCount = 0;
    let overdueRdvConfirmCount = 0;

    overdueActions.forEach(a => {
        const actLow = a.action.toLowerCase();
        if (actLow.includes('devis')) {
            overdueDevisCount++;
        } else if (actLow.includes('confirm') || actLow.includes('rdv')) {
            overdueRdvConfirmCount++;
        } else {
            overdueRelancesCount++;
        }
    });

    const overdueCount = overdueActions.length;
    const summaryParts: string[] = [];
    if (overdueDevisCount > 0) summaryParts.push(`${overdueDevisCount} relance${overdueDevisCount > 1 ? 's' : ''} devis non effectuée${overdueDevisCount > 1 ? 's' : ''}`);
    if (overdueRdvConfirmCount > 0) summaryParts.push(`${overdueRdvConfirmCount} confirmation${overdueRdvConfirmCount > 1 ? 's' : ''} RDV en attente`);
    if (overdueRelancesCount > 0) summaryParts.push(`${overdueRelancesCount} action${overdueRelancesCount > 1 ? 's' : ''} atelier en retard`);

    const overdueSummaryText = summaryParts.length > 0 
        ? summaryParts.join(' • ') 
        : `${overdueCount} action${overdueCount > 1 ? 's' : ''} en retard`;

    const allFutureActions = uniqueActions
        .filter(a => a.dateCible > targetDateStr)
        .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

    const totalToday = actionsForSelectedDate.length;
    const doneCount = actionsForSelectedDate.filter(a => a.statut === 'FAIT').length;
    const todoCount = totalToday - doneCount;

    return {
        selectedDate: targetDateStr,
        actions: actionsForSelectedDate,
        overdueActions,
        allFutureActions,
        stats: {
            totalToday,
            todoCount,
            doneCount,
            overdueCount,
            overdueSummaryText,
            overdueDevisCount,
            overdueRelancesCount,
            overdueRdvConfirmCount
        }
    };
};
