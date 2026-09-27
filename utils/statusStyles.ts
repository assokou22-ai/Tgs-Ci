import { RepairStatus } from '../types.ts';

export interface StatusStyle {
    bg: string;
    text: string;
    border: string;
    dot: string;
    hoverBg: string;
    focusBg: string;
    badge: string; // complete badge class list
    selectBadge: string; // styling for select button in RepairDetail
}

export const getStatusStyle = (status: RepairStatus): StatusStyle => {
    switch (status) {
        // Group: Gris (à diagnostiquer, diagnostic en cours, devis à valider)
        case RepairStatus.A_DIAGNOSTIQUER:
        case RepairStatus.DIAGNOSTIC_EN_COURS:
        case RepairStatus.DEVIS_A_VALIDER:
            return {
                bg: 'bg-neutral-500/10',
                text: 'text-neutral-400',
                border: 'border-neutral-500/20',
                dot: 'bg-neutral-400 shadow-[0_0_8px_rgba(163,163,163,0.5)]',
                hoverBg: 'hover:bg-neutral-500/20',
                focusBg: 'bg-neutral-500/20',
                badge: 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/25',
                selectBadge: 'border-neutral-500/40 text-neutral-300 bg-neutral-500/10 hover:bg-neutral-500/20 shadow-[0_0_12px_rgba(163,163,163,0.1)]'
            };

        // Group: Orange (devis approuvé, en attente de pièces)
        case RepairStatus.DEVIS_APPROUVE:
        case RepairStatus.EN_ATTENTE_DE_PIECES:
            return {
                bg: 'bg-orange-500/10',
                text: 'text-orange-400',
                border: 'border-orange-500/20',
                dot: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
                hoverBg: 'hover:bg-orange-500/20',
                focusBg: 'bg-orange-500/20',
                badge: 'bg-orange-500/10 text-orange-400 border border-orange-500/25',
                selectBadge: 'border-orange-500/40 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.1)]'
            };

        // Group: Jaune (réparation en cours, test en cours, terminé, reporté)
        case RepairStatus.REPARATION_EN_COURS:
        case RepairStatus.TESTS_EN_COURS:
        case RepairStatus.TERMINE:
        case RepairStatus.REPORTE:
            return {
                bg: 'bg-yellow-500/10',
                text: 'text-yellow-400',
                border: 'border-yellow-500/20',
                dot: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]',
                hoverBg: 'hover:bg-yellow-500/20',
                focusBg: 'bg-yellow-500/20',
                badge: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25',
                selectBadge: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 shadow-[0_0_12px_rgba(234,179,8,0.1)]'
            };

        // Group: Rouge (rendu, non réparable, annulé)
        case RepairStatus.RENDU:
        case RepairStatus.NON_REPARABLE:
        case RepairStatus.ANNULE:
            return {
                bg: 'bg-red-500/10',
                text: 'text-red-400',
                border: 'border-red-500/20',
                dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
                hoverBg: 'hover:bg-red-500/20',
                focusBg: 'bg-red-500/20',
                badge: 'bg-red-500/10 text-red-400 border border-red-500/25',
                selectBadge: 'border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.1)]'
            };

        default:
            return {
                bg: 'bg-neutral-500/10',
                text: 'text-neutral-400',
                border: 'border-neutral-500/20',
                dot: 'bg-neutral-400',
                hoverBg: 'hover:bg-neutral-500/20',
                focusBg: 'bg-neutral-500/20',
                badge: 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/25',
                selectBadge: 'border-neutral-500/40 text-neutral-400 bg-neutral-500/10 hover:bg-neutral-500/20'
            };
    }
};
