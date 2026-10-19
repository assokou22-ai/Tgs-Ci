
import { RepairTicket } from '../types.ts';
import { formatPhone, generateWhatsAppUrl } from '../utils/formatters.ts';
import { generateWorkshopMessage } from './workshopCommunicationService.ts';

export type NotificationMessageType = 
    | 'ready' 
    | 'quote' 
    | 'update' 
    | 'unrepairable'
    | 'two_options'
    | 'nand_voltages'
    | 'session_password';

/**
 * Utility to get correct separator for SMS links (iPhone vs Android)
 */
const getSMSDivider = () => {
    const ua = navigator.userAgent.toLowerCase();
    return (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1) ? '&' : '?';
};

/**
 * Generates an SMS deep link for manual sending
 */
export const generateSMSMessage = (
    ticket: RepairTicket,
    type: NotificationMessageType,
    reason?: string
): string => {
    const recipientPhone = ticket.client.smsPhone || ticket.client.phone;
    const phone = formatPhone(recipientPhone);
    let message = '';
    const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const advance = (ticket.costs.advance || 0);
    const balance = Math.max(0, totalCost - advance);

    const prefix = `TGS-CI (Fiche ${ticket.id}) : `;

    switch (type) {
        case 'ready':
            message = `${prefix}Bonjour ${ticket.client.name}, votre Mac (${ticket.macModel}) est prêt. Solde à régler au retrait : ${balance.toLocaleString('fr-FR')} F CFA. Atelier Cocody Faya. Tél: +225 07 57 13 35 07`;
            break;
        case 'quote':
            message = `${prefix}Devis dispo pour votre ${ticket.macModel}. Montant total : ${totalCost.toLocaleString('fr-FR')} F CFA. Merci de nous donner votre accord.`;
            break;
        case 'two_options':
            message = `${prefix}Bonjour ${ticket.client.name}, point sur votre Mac (${ticket.macModel}) : deux options s'offrent à vous (poursuite réparation ou remplacement carte mère 72h). Merci de consulter notre message WhatsApp ou nous appeler.`;
            break;
        case 'nand_voltages':
            message = `${prefix}Bonjour ${ticket.client.name}, point sur votre ${ticket.macModel} : tensions rétablies mais puces NAND à remplacer (perte de données). Merci de consulter WhatsApp pour le point complet.`;
            break;
        case 'session_password':
            message = `${prefix}Urgent TGS-CI : votre Mac (${ticket.macModel}) redémarre. Mot de passe de session obligatoire pour l'activation Apple et les tests. Merci de nous le transmettre par SMS/WhatsApp.`;
            break;
        case 'update':
            message = `${prefix}Votre ${ticket.macModel} est en cours de réparation. Nous vous prévenons dès la fin des tests.`;
            break;
        case 'unrepairable':
            message = `${prefix}Votre ${ticket.macModel} est déclaré non réparable (${reason || 'défaut carte mère'}). Vous pouvez le récupérer à l'atelier.`;
            break;
    }
    
    return `sms:${phone}${getSMSDivider()}body=${encodeURIComponent(message)}`;
};

/**
 * Generates a WhatsApp deep link with accurate +225 CI 10-digit number handling
 */
export const generateWhatsAppMessage = (
    ticket: RepairTicket,
    type: NotificationMessageType,
    reason?: string
): string => {
    const phone = ticket.client?.phone || ticket.clientPhone || '';
    let message = '';
    const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const advance = (ticket.costs.advance || 0);
    const balance = Math.max(0, totalCost - advance);
    const clientName = ticket.client?.name || ticket.clientName || 'Client';
    const model = ticket.macModel || 'MacBook';

    const intro = `*TGS CI - RÉPARER MON MACBOOK*\n📌 *FICHE N°${ticket.id}*\n👤 *CLIENT :* ${clientName}\n\n`;

    switch (type) {
        case 'two_options':
            return generateWorkshopMessage('two_options_t2_nand', ticket);
        case 'nand_voltages':
            return generateWorkshopMessage('nand_voltages_dataloss', ticket);
        case 'session_password':
            return generateWorkshopMessage('apple_session_password', ticket);
        case 'ready':
            message = `${intro}✅ *VOTRE APPAREIL EST PRÊT !*\n\nBonjour ${clientName},\nVotre *${model}* est entièrement réparé, testé et disponible dans nos ateliers.\n\n💰 *Total des travaux :* ${totalCost.toLocaleString('fr-FR')} F CFA\n💳 *Acompte versé :* ${advance.toLocaleString('fr-FR')} F CFA\n💵 *SOLDE À RÉGLER AU RETRAIT :* ${balance.toLocaleString('fr-FR')} F CFA\n\n📍 *Atelier TGS CI :* Cocody Faya, Abidjan\n📞 *Contact :* +225 07 57 13 35 07\n\nVous pouvez passer récupérer votre appareil aux horaires d'ouverture. Merci de votre confiance !`;
            break;
        case 'quote':
            message = `${intro}🛠 *DEVIS TECHNIQUE DISPONIBLE*\n\nBonjour ${clientName},\nL'expertise de votre *${model}* est terminée.\n\n💰 *Montant total des travaux :* ${totalCost.toLocaleString('fr-FR')} F CFA\n🛠 *Constat :* ${ticket.diagnosticReport || ticket.problemDescription || 'Intervention technique'}\n\nMerci de nous donner votre accord par retour de message pour lancer la réparation.`;
            break;
        case 'update':
            message = `${intro}⚙️ *SUIVI DES TRAVAUX*\n\nBonjour ${clientName},\nVotre *${model}* est actuellement en cours d'intervention sur notre banc technique. Nous vous informons dès la finalisation.`;
            break;
        case 'unrepairable':
            message = `${intro}⚠️ *RAPPORT D'EXPERTISE TECHNIQUE*\n\nBonjour ${clientName},\nAprès expertise approfondie de votre *${model}*, nous avons le regret de vous informer que l'appareil n'est pas réparable.\n\n*Motif :* ${reason || ticket.technicianNotes || 'Dommages irréversibles sur la carte logique'}.\n\nVous pouvez passer le récupérer à l'atelier.`;
            break;
    }
    
    return generateWhatsAppUrl(phone, message);
};

/**
 * Generates a Mailto deep link for manual sending
 */
export const generateEmailLink = (ticket: RepairTicket): string => {
    const clientEmail = ticket.client?.email;
    if (!clientEmail) return '';

    const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const advance = (ticket.costs.advance || 0);
    const balance = Math.max(0, totalCost - advance);
    const clientName = ticket.client?.name || ticket.clientName || 'Client';

    const subject = `[TGS CI] Suivi de votre dossier n°${ticket.id} - ${clientName}`;
    const body = `Bonjour ${clientName},

Voici le point sur votre dossier n°${ticket.id} concernant votre ${ticket.macModel} :

- Statut actuel : ${ticket.status}
- Montant total : ${totalCost.toLocaleString('fr-FR')} F CFA
- Acompte versé : ${advance.toLocaleString('fr-FR')} F CFA
- Solde restant à régler : ${balance.toLocaleString('fr-FR')} F CFA

🔗 LIEN DE SUIVI : ${window.location.origin}/?role=accueil&ticketId=${ticket.id}

Cordialement,
L'équipe TGS CI - Département Macbook
Abidjan, Cocody Faya
+225 07 57 13 35 07`;

    return `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

