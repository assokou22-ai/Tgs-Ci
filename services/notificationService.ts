
import { RepairTicket } from '../types.ts';

export const isNotificationSupported = (): boolean => {
    return 'Notification' in window;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    if (!isNotificationSupported()) return 'denied';
    return await Notification.requestPermission();
};

export const sendNotification = (title: string, options?: NotificationOptions): void => {
    if (!isNotificationSupported()) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { ...options, icon: '/vite.svg', badge: '/vite.svg' });
    }
};

const formatPhone = (phone: string) => {
    let cleaned = phone.replace(/\s+/g, '');
    if (cleaned.startsWith('0')) cleaned = '225' + cleaned.substring(1);
    return cleaned;
};

export const generateWhatsAppMessage = (
    ticket: RepairTicket,
    type: 'ready' | 'quote' | 'update' | 'unrepairable',
    reason?: string
): string => {
    const phone = formatPhone(ticket.client.phone);
    let message = '';
    const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const balance = totalCost - (ticket.costs.advance || 0);

    const intro = `*TGS CI - RÉPARER MON MACBOOK*\n📌 *Fiche N°${ticket.id}*\n👤 *Client :* ${ticket.client.name}\n\n`;

    switch (type) {
        case 'ready':
            message = `${intro}✅ Votre appareil (${ticket.macModel}) est PRÊT.\n\n💰 *Solde à régler :* ${balance.toLocaleString('fr-FR')} F CFA.\nVous pouvez passer le récupérer à l'atelier.`;
            break;
        case 'quote':
            message = `${intro}🛠 *DEVIS DISPONIBLE* pour votre ${ticket.macModel}.\n\nMontant total des travaux : *${totalCost.toLocaleString('fr-FR')} F CFA*.\nMerci de nous donner votre accord pour lancer l'intervention.`;
            break;
        case 'update':
            message = `${intro}⚙️ *SUIVI DES TRAVAUX* : Votre ${ticket.macModel} est actuellement en cours d'intervention. Nous vous informons dès que les tests finaux sont validés.`;
            break;
        case 'unrepairable':
            message = `${intro}⚠️ *RAPPORT TECHNIQUE* : Après expertise approfondie sur votre ${ticket.macModel}, nous avons le regret de vous informer que l'appareil n'est pas réparable.\n\n*Motif :* ${reason || 'Dégradation critique de la carte mère'}.`;
            break;
    }
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export const generateSMSMessage = (
    ticket: RepairTicket,
    type: 'ready' | 'quote' | 'update' | 'unrepairable',
    reason?: string
): string => {
    const phone = formatPhone(ticket.client.phone);
    let message = '';
    const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const balance = totalCost - (ticket.costs.advance || 0);

    const prefix = `TGS-CI (Fiche ${ticket.id}) : `;

    switch (type) {
        case 'ready':
            message = `${prefix}Bonjour ${ticket.client.name}, votre Mac (${ticket.macModel}) est prêt. Solde a regler : ${balance.toLocaleString('fr-FR')} F.`;
            break;
        case 'quote':
            message = `${prefix}Devis dispo pour votre ${ticket.macModel}. Montant : ${totalCost.toLocaleString('fr-FR')} F. Merci de nous donner votre accord.`;
            break;
        case 'update':
            message = `${prefix}Votre ${ticket.macModel} est en cours de reparation. Nous vous prevenons des que c'est termine.`;
            break;
        case 'unrepairable':
            message = `${prefix}Votre ${ticket.macModel} est declare non reparable (${reason || 'defaut carte mere'}). Vous pouvez le recuperer.`;
            break;
    }
    
    // Check if it's iOS or Android/others for SMS body parameter
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    
    return `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
};

export const generateEmailLink = (ticket: RepairTicket): string => {
    const clientEmail = ticket.client.email;
    if (!clientEmail) return '';

    const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const balance = totalCost - (ticket.costs.advance || 0);

    const subject = `[TGS CI] Suivi de votre dossier n°${ticket.id} - ${ticket.client.name}`;
    const body = `Bonjour ${ticket.client.name},

Voici le point sur votre dossier n°${ticket.id} concernant votre ${ticket.macModel} :

- Statut actuel : ${ticket.status}
- Solde restant à régler : ${balance.toLocaleString('fr-FR')} F CFA

INFORMATIONS IMPORTANTES :
- Le Prestataire est tenu à une obligation de moyens.
- Garantie de 1 mois sur l'intervention réalisée.

Cordialement,
L'équipe TGS CI - Département Macbook
Abidjan, Cocody Faya
+225 07 57 13 35 07`;

    return `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
