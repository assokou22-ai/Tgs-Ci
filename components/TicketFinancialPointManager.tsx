import React, { useState, useMemo } from 'react';
import { RepairTicket, RepairStatus, ActivityCategory, FixedChargeFrequency, FixedChargeItem } from '../types.ts';
import { getTicketFinancialSummary } from '../utils/ticketHelpers.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { useProfitabilityData } from '../hooks/useProfitabilityData.ts';
import {
    ACTIVITY_LABELS,
    ACTIVITY_SHORT_LABELS,
    ACTIVITY_ORDER,
    PART_SOURCE_SHORT_LABELS,
    calculatePortfolioProfitability,
    calculateTicketProfitability,
    calculateWorkshopTreasury,
} from '../utils/profitability.ts';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicketFinancialPoint from './PrintableTicketFinancialPoint.tsx';
import { exportTicketFinancialPointToExcel, FinancialPointMetrics } from '../services/exportService.ts';
import { 
    Calendar, 
    Printer, 
    Download, 
    Search, 
    CheckCircle, 
    AlertTriangle, 
    FileText, 
    X, 
    ArrowLeft, 
    ChevronLeft, 
    ChevronRight,
    ChevronDown,
    DollarSign, 
    Share2,
    Eye,
    TrendingUp,
    Building2,
    Plus,
    Trash2,
    Wallet,
    ShieldCheck,
    Receipt,
    Package,
    Sliders
} from 'lucide-react';
import { playTone } from '../utils/audio.ts';
import { dbBulkPutTickets } from '../services/dbService.ts';
import { 
    detectSubcontractorCandidates, 
    harmonizeClientAsSubcontractor, 
    ClientRecurrenceProfile 
} from '../utils/clientRecurrenceHelper.ts';

export type PeriodMode = 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'annee' | 'custom' | 'jour' | 'all';
export type PaymentFilter = 'all' | 'paid' | 'with_balance' | 'infacturable';
export type TechStatusFilter = 'all' | 'devis' | 'in_progress' | 'ready' | 'returned' | 'canceled';

interface TicketFinancialPointManagerProps {
    tickets: RepairTicket[];
    onSelectTicket?: (ticket: RepairTicket) => void;
    onBack?: () => void;
    initialPeriodMode?: PeriodMode;
}

export const TicketFinancialPointManager: React.FC<TicketFinancialPointManagerProps> = ({
    tickets,
    onSelectTicket,
    onBack,
    initialPeriodMode = 'mois'
}) => {
    const { showToast } = useToastContext();
    const { settings, updateSettings } = useAppSettings();
    const { stockItems, stockMap, stockUsages, externalPurchases, commandes, factures } = useProfitabilityData();

    const taxProvisionRate = settings.profitability?.taxProvisionRate ?? 0;
    const showProfitability = settings.profitability?.enableProfitabilityIndicators !== false;
    const showTreasury = Boolean(settings.profitability?.enableTreasuryTracking);
    const fixedCharges = useMemo(
        () => settings.profitability?.fixedCharges ?? [],
        [settings.profitability?.fixedCharges]
    );
    const [showTreasuryConfig, setShowTreasuryConfig] = useState(false);

    const handleToggleProfitability = () => {
        const nextVal = !showProfitability;
        updateSettings('profitability', { enableProfitabilityIndicators: nextVal });
        showToast(
            nextVal
                ? "Indicateurs de rentabilité par activité activés."
                : "Indicateurs de rentabilité masqués (aucune donnée supprimée).",
            "info"
        );
    };

    const handleToggleTreasury = () => {
        const nextVal = !showTreasury;
        updateSettings('profitability', {
            enableTreasuryTracking: nextVal,
            ...(nextVal && !settings.profitability?.treasuryStartDate
                ? { treasuryStartDate: new Date().toISOString().slice(0, 10) }
                : {}),
        });
        showToast(
            nextVal
                ? "Suivi Capital (~2M) & Trésorerie activé à partir de la date configurée."
                : "Suivi Capital (~2M) & Trésorerie désactivé (application en mode classique).",
            "info"
        );
    };

    // Mode temporel
    const [periodMode, setPeriodMode] = useState<PeriodMode>(initialPeriodMode);

    // Date de référence (pour semaine, mois, trimestre, semestre, année, jour)
    const [refDate, setRefDate] = useState<Date>(() => new Date());

    // Pour le mode 'custom' (De telle date à telle date au besoin)
    const [customStartDate, setCustomStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(1); // Début de mois par défaut
        return d.toISOString().slice(0, 10);
    });
    const [customEndDate, setCustomEndDate] = useState<string>(() => {
        return new Date().toISOString().slice(0, 10);
    });

    // Filtres secondaires
    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
    const [techStatusFilter, setTechStatusFilter] = useState<TechStatusFilter>('all');
    const [clientTypeFilter, setClientTypeFilter] = useState<'all' | 'individual' | 'enterprise'>('all');
    const [activityFilter, setActivityFilter] = useState<'all' | ActivityCategory>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Date type: filter by creation date or update date
    const [dateBasis, setDateBasis] = useState<'createdAt' | 'updatedAt'>('createdAt');

    // Modale d'aperçu d'impression
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    // Détail par ligne dépliable et gestion des charges fixes
    const [expandedTicketIds, setExpandedTicketIds] = useState<Set<string>>(() => new Set());
    const [showFixedChargesManager, setShowFixedChargesManager] = useState(false);
    const [newChargeLabel, setNewChargeLabel] = useState('');
    const [newChargeAmount, setNewChargeAmount] = useState('');
    const [newChargeFreq, setNewChargeFreq] = useState<FixedChargeFrequency>('mensuel');
    const [newChargeCategory, setNewChargeCategory] = useState('Loyer & Atelier');
    const [newChargeDate, setNewChargeDate] = useState(() => new Date().toISOString().slice(0, 10));

    // Gestion des candidats sous-traitants (≥ 5 machines enregistrées)
    const [dismissedCandidateKeys, setDismissedCandidateKeys] = useState<Set<string>>(() => new Set());
    const [isHarmonizing, setIsHarmonizing] = useState<boolean>(false);
    const [showAllTimeCandidates, setShowAllTimeCandidates] = useState<boolean>(false);

    // Détection des candidats : fiches totales de l'année (ou global)
    const currentYear = refDate.getFullYear();
    const subcontractorCandidates = useMemo(() => {
        const targetYear = (periodMode === 'annee' || !showAllTimeCandidates) ? currentYear : undefined;
        const list = detectSubcontractorCandidates(tickets, targetYear);
        return list.filter(c => !dismissedCandidateKeys.has(c.normalizedName));
    }, [tickets, periodMode, currentYear, showAllTimeCandidates, dismissedCandidateKeys]);

    const handleHarmonizeAsSubcontractor = async (candidate: ClientRecurrenceProfile) => {
        setIsHarmonizing(true);
        try {
            const { updatedTickets, count } = harmonizeClientAsSubcontractor(candidate.normalizedName, tickets);
            if (count > 0) {
                await dbBulkPutTickets(updatedTickets);
                window.dispatchEvent(new CustomEvent('requestsync'));
                window.dispatchEvent(new CustomEvent('tickets-updated', { detail: updatedTickets }));
                playTone(880, 200);
                showToast(`✅ ${candidate.clientName} validé comme Sous-traitant ! ${count} fiche(s) harmonisée(s) (Diagnostic = 0 F CFA, tarifs sous-traitants appliqués).`, "success");
            } else {
                showToast("Aucune fiche trouvée pour ce client.", "info");
            }
        } catch (err) {
            console.error("Erreur harmonisation sous-traitant:", err);
            showToast("Erreur lors de l'harmonisation du client.", "error");
        } finally {
            setIsHarmonizing(false);
        }
    };

    const handleDismissCandidate = (normKey: string) => {
        setDismissedCandidateKeys(prev => new Set([...prev, normKey]));
        showToast("Client conservé en client direct.", "info");
    };

    // Calcul des bornes [start, end] selon la période sélectionnée
    const { startDate, endDate, periodLabel, shortPeriodLabel } = useMemo(() => {
        const now = new Date(refDate);
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-indexed

        let start: Date | null = null;
        let end: Date | null = null;
        let label = '';
        let shortLabel = '';

        switch (periodMode) {
            case 'jour': {
                start = new Date(y, m, now.getDate(), 0, 0, 0, 0);
                end = new Date(y, m, now.getDate(), 23, 59, 59, 999);
                const str = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                label = `Journée du ${str}`;
                shortLabel = start.toLocaleDateString('fr-FR');
                break;
            }

            case 'semaine': {
                // Trouver le lundi de la semaine
                const currentDay = now.getDay();
                const diffToMonday = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
                start = new Date(y, m, diffToMonday, 0, 0, 0, 0);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);

                // Numéro de semaine ISO
                const firstDayOfYear = new Date(start.getFullYear(), 0, 1);
                const pastDaysOfYear = (start.getTime() - firstDayOfYear.getTime()) / 86400000;
                const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

                const startStr = start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const endStr = end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                label = `Semaine ${weekNumber} (${startStr} au ${endStr})`;
                shortLabel = `S${weekNumber} - ${y}`;
                break;
            }

            case 'mois': {
                start = new Date(y, m, 1, 0, 0, 0, 0);
                end = new Date(y, m + 1, 0, 23, 59, 59, 999);
                const monthName = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                label = `Mois de ${monthName}`;
                shortLabel = `${start.toLocaleDateString('fr-FR', { month: 'short' })} ${y}`;
                break;
            }

            case 'trimestre': {
                const quarterIndex = Math.floor(m / 3); // 0, 1, 2, 3
                start = new Date(y, quarterIndex * 3, 1, 0, 0, 0, 0);
                end = new Date(y, (quarterIndex + 1) * 3, 0, 23, 59, 59, 999);
                const qNum = quarterIndex + 1;
                const qMonths = [
                    'Janvier - Mars',
                    'Avril - Juin',
                    'Juillet - Septembre',
                    'Octobre - Décembre'
                ][quarterIndex];
                label = `${qNum}er Trimestre ${y} (T${qNum} : ${qMonths})`;
                if (qNum > 1) label = `${qNum}ème Trimestre ${y} (T${qNum} : ${qMonths})`;
                shortLabel = `T${qNum} ${y}`;
                break;
            }

            case 'semestre': {
                const semesterIndex = Math.floor(m / 6); // 0 ou 1
                start = new Date(y, semesterIndex * 6, 1, 0, 0, 0, 0);
                end = new Date(y, (semesterIndex + 1) * 6, 0, 23, 59, 59, 999);
                const sNum = semesterIndex + 1;
                const sMonths = semesterIndex === 0 ? 'Janvier - Juin' : 'Juillet - Décembre';
                label = `${sNum}${sNum === 1 ? 'er' : 'ème'} Semestre ${y} (S${sNum} : ${sMonths})`;
                shortLabel = `S${sNum} ${y}`;
                break;
            }

            case 'annee': {
                start = new Date(y, 0, 1, 0, 0, 0, 0);
                end = new Date(y, 11, 31, 23, 59, 59, 999);
                label = `Année Civile ${y}`;
                shortLabel = `Année ${y}`;
                break;
            }

            case 'custom': {
                if (customStartDate) {
                    start = new Date(`${customStartDate}T00:00:00.000`);
                }
                if (customEndDate) {
                    end = new Date(`${customEndDate}T23:59:59.999`);
                }
                const startStr = start ? start.toLocaleDateString('fr-FR') : 'Origine';
                const endStr = end ? end.toLocaleDateString('fr-FR') : "Aujourd'hui";
                label = `Période personnalisée du ${startStr} au ${endStr}`;
                shortLabel = `${startStr} - ${endStr}`;
                break;
            }

            case 'all':
            default: {
                start = null;
                end = null;
                label = `Historique Complet de l'Atelier`;
                shortLabel = 'Tout';
                break;
            }
        }

        return { startDate: start, endDate: end, periodLabel: label, shortPeriodLabel: shortLabel };
    }, [periodMode, refDate, customStartDate, customEndDate]);

    // Filtrage dynamique des fiches
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            // 1. Filtre par Date
            if (startDate || endDate) {
                const dateValStr = dateBasis === 'createdAt' ? t.createdAt : (t.updatedAt || t.createdAt);
                if (!dateValStr) return false;
                const d = new Date(dateValStr);
                if (isNaN(d.getTime())) return false;
                if (startDate && d < startDate) return false;
                if (endDate && d > endDate) return false;
            }

            const fin = getTicketFinancialSummary(t);

            // 2. Filtre par Statut de Règlement
            if (paymentFilter === 'paid' && (!fin.isFullyPaid || fin.isInfacturable)) return false;
            if (paymentFilter === 'with_balance' && (fin.balanceDue <= 0 || fin.isInfacturable)) return false;
            if (paymentFilter === 'infacturable' && !fin.isInfacturable) return false;

            // 3. Filtre par Statut Atelier
            if (techStatusFilter !== 'all') {
                if (techStatusFilter === 'devis' && ![RepairStatus.A_DIAGNOSTIQUER, RepairStatus.DIAGNOSTIC_EN_COURS, RepairStatus.DEVIS_A_VALIDER].includes(t.status)) return false;
                if (techStatusFilter === 'in_progress' && ![RepairStatus.DEVIS_APPROUVE, RepairStatus.EN_ATTENTE_DE_PIECES, RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS].includes(t.status)) return false;
                if (techStatusFilter === 'ready' && t.status !== RepairStatus.TERMINE) return false;
                if (techStatusFilter === 'returned' && t.status !== RepairStatus.RENDU) return false;
                if (techStatusFilter === 'canceled' && ![RepairStatus.ANNULE, RepairStatus.NON_REPARABLE, RepairStatus.REPORTE].includes(t.status)) return false;
            }

            // 4. Filtre par Type Client
            if (clientTypeFilter === 'individual' && t.client?.isEnterprise) return false;
            if (clientTypeFilter === 'enterprise' && !t.client?.isEnterprise) return false;

            // 5. Recherche par mot-clé
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchId = t.id.toLowerCase().includes(q);
                const matchClient = (t.client?.name || '').toLowerCase().includes(q);
                const matchPhone = (t.client?.phone || '').toLowerCase().includes(q);
                const matchModel = (t.macModel || '').toLowerCase().includes(q);
                const matchStatus = (t.status || '').toLowerCase().includes(q);
                if (!matchId && !matchClient && !matchPhone && !matchModel && !matchStatus) return false;
            }

            // 6. Filtre par Activité (calcul dynamique non destructif)
            if (showProfitability && activityFilter !== 'all') {
                const prof = calculateTicketProfitability(t, {
                    stockMap,
                    stockUsages,
                    externalPurchases,
                    taxProvisionRate,
                });
                if (prof.isInfacturable || !prof.activitiesPresent.includes(activityFilter)) {
                    return false;
                }
            }

            return true;
        });
    }, [tickets, startDate, endDate, dateBasis, paymentFilter, techStatusFilter, clientTypeFilter, searchQuery, showProfitability, activityFilter, stockMap, stockUsages, externalPurchases, taxProvisionRate]);

    // Métriques comptables sur l'échantillon filtré
    const metrics: FinancialPointMetrics = useMemo(() => {
        let totalBilled = 0;
        let totalAdvance = 0;
        let totalBalanceDue = 0;
        let facturablesCount = 0;
        let infacturablesCount = 0;
        let paidCount = 0;
        let withBalanceCount = 0;

        filteredTickets.forEach(t => {
            const fin = getTicketFinancialSummary(t);
            if (fin.isInfacturable) {
                infacturablesCount++;
            } else {
                facturablesCount++;
                totalBilled += fin.totalBilled;
                totalAdvance += fin.advanceReceived;
                totalBalanceDue += fin.balanceDue;
                if (fin.isFullyPaid) paidCount++;
                if (fin.balanceDue > 0) withBalanceCount++;
            }
        });

        const collectionRate = totalBilled > 0 ? Math.round((totalAdvance / totalBilled) * 100) : 0;

        return {
            totalBilled,
            totalAdvance,
            totalBalanceDue,
            facturablesCount,
            infacturablesCount,
            paidCount,
            withBalanceCount,
            collectionRate,
            totalCount: filteredTickets.length
        };
    }, [filteredTickets]);

    // Rapport complet de rentabilité (prévisionnel & réel, par ligne, dossier, activité + charges fixes séparées)
    const profitabilityReport = useMemo(() => {
        return calculatePortfolioProfitability(filteredTickets, {
            stockMap,
            stockUsages,
            externalPurchases,
            taxProvisionRate,
            fixedCharges,
            periodMode,
            startDate,
            endDate,
        });
    }, [filteredTickets, stockMap, stockUsages, externalPurchases, taxProvisionRate, fixedCharges, periodMode, startDate, endDate]);

    // Trésorerie globale atelier (~2M capital), réserves & dépenses à payer (uniquement si activée par l'utilisateur)
    const treasurySnapshot = useMemo(() => {
        if (!showTreasury) return null;
        return calculateWorkshopTreasury({
            allTickets: tickets,
            stockItems,
            stockUsages,
            externalPurchases,
            commandes,
            factures,
            settings: settings.profitability,
        });
    }, [showTreasury, tickets, stockItems, stockUsages, externalPurchases, commandes, factures, settings.profitability]);

    const toggleExpandTicket = (ticketId: string) => {
        setExpandedTicketIds(prev => {
            const next = new Set(prev);
            if (next.has(ticketId)) next.delete(ticketId);
            else next.add(ticketId);
            return next;
        });
    };

    const handleAddFixedCharge = (e: React.FormEvent) => {
        e.preventDefault();
        const amountNum = Math.max(0, Math.round(Number(newChargeAmount) || 0));
        if (!newChargeLabel.trim() || amountNum <= 0) {
            showToast("Renseignez un libellé et un montant positif.", "warning");
            return;
        }
        const newItem: FixedChargeItem = {
            id: `chg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            label: newChargeLabel.trim(),
            amount: amountNum,
            frequency: newChargeFreq,
            category: newChargeCategory.trim() || 'Atelier',
            active: true,
            ...(newChargeFreq === 'ponctuel' ? { date: newChargeDate } : {})
        };
        updateSettings('profitability', {
            taxProvisionRate,
            fixedCharges: [...fixedCharges, newItem]
        });
        setNewChargeLabel('');
        setNewChargeAmount('');
        showToast("Charge fixe ajoutée (séparée des marges d'activité).", "success");
    };

    const handleToggleFixedCharge = (id: string) => {
        updateSettings('profitability', {
            taxProvisionRate,
            fixedCharges: fixedCharges.map(c => c.id === id ? { ...c, active: !c.active } : c)
        });
    };

    const handleDeleteFixedCharge = (id: string) => {
        updateSettings('profitability', {
            taxProvisionRate,
            fixedCharges: fixedCharges.filter(c => c.id !== id)
        });
    };

    // Navigation temporelle (recule / avance dans le temps)
    const handleShiftPeriod = (delta: number) => {
        const next = new Date(refDate);
        switch (periodMode) {
            case 'jour':
                next.setDate(next.getDate() + delta);
                break;
            case 'semaine':
                next.setDate(next.getDate() + (delta * 7));
                break;
            case 'mois':
                next.setMonth(next.getMonth() + delta);
                break;
            case 'trimestre':
                next.setMonth(next.getMonth() + (delta * 3));
                break;
            case 'semestre':
                next.setMonth(next.getMonth() + (delta * 6));
                break;
            case 'annee':
                next.setFullYear(next.getFullYear() + delta);
                break;
            default:
                break;
        }
        setRefDate(next);
    };

    // Raccourcis temporels pour le mode personnalise
    const applyQuickCustomRange = (days: number | 'thisMonth' | 'thisQuarter' | 'thisYear') => {
        const today = new Date();
        const endStr = today.toISOString().slice(0, 10);
        setCustomEndDate(endStr);

        if (typeof days === 'number') {
            const s = new Date(today);
            s.setDate(today.getDate() - days + 1);
            setCustomStartDate(s.toISOString().slice(0, 10));
        } else if (days === 'thisMonth') {
            const s = new Date(today.getFullYear(), today.getMonth(), 1);
            setCustomStartDate(s.toISOString().slice(0, 10));
        } else if (days === 'thisQuarter') {
            const q = Math.floor(today.getMonth() / 3);
            const s = new Date(today.getFullYear(), q * 3, 1);
            setCustomStartDate(s.toISOString().slice(0, 10));
        } else if (days === 'thisYear') {
            const s = new Date(today.getFullYear(), 0, 1);
            setCustomStartDate(s.toISOString().slice(0, 10));
        }
    };

    // Export Excel
    const handleExportExcel = () => {
        try {
            const safeLabel = periodLabel.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 40);
            const fileName = `POINT_FINANCIER_FICHES_${safeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            exportTicketFinancialPointToExcel(
                filteredTickets,
                periodLabel,
                metrics,
                fileName,
                showProfitability ? profitabilityReport : undefined,
                showTreasury && treasurySnapshot ? treasurySnapshot : undefined
            );
            showToast(
                showProfitability || showTreasury
                    ? "Point financier exporté en Excel (.xlsx) avec les indicateurs activés !"
                    : "Point financier exporté en Excel (.xlsx) !",
                "success"
            );
        } catch (err) {
            console.error("Export Excel error:", err);
            showToast("Erreur lors de l'export Excel.", "error");
        }
    };

    // Export CSV
    const handleExportCsv = () => {
        try {
            const headers = showProfitability
                ? ["N° FICHE", "DATE", "CLIENT", "CONTACT", "MODELE", "STATUT", "REGIME_POINT", "ACTIVITES", "ORIGINE_PIECES", "DIAGNOSTIC_F", "REPARATION_F", "TOTAL_FACTURE_F", "COUT_PIECES_1X_F", "PROV_FISCALE_F", "MARGE_PREVISIONNELLE_F", "MARGE_REELLE_F", "ACOMPTE_F", "SOLDE_DU_F", "ETAT_PAIEMENT"]
                : ["N° FICHE", "DATE", "CLIENT", "CONTACT", "MODELE", "STATUT", "REGIME_POINT", "DIAGNOSTIC_F", "REPARATION_F", "TOTAL_FACTURE_F", "ACOMPTE_F", "SOLDE_DU_F", "ETAT_PAIEMENT"];
            const rows = filteredTickets.map(t => {
                const fin = getTicketFinancialSummary(t);
                const prof = showProfitability ? profitabilityReport.ticketResults.get(t.id) : undefined;
                const acts = fin.isInfacturable ? 'INFACTURABLE' : (prof?.activitiesPresent.map(a => ACTIVITY_LABELS[a]).join(' / ') || 'Réparation');
                const sourcesSet = Array.from(new Set((prof?.lines || []).map(l => l.sourcePiece ? PART_SOURCE_SHORT_LABELS[l.sourcePiece] : null).filter(Boolean)));
                const sourcesLabel = fin.isInfacturable ? '' : (sourcesSet.join(' / ') || 'Prestation');
                return [
                    `#${t.id}`,
                    t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '',
                    `"${(t.client?.name || '').replace(/"/g, '""')}"`,
                    `"${(t.client?.phone || '').replace(/"/g, '""')}"`,
                    `"${(t.macModel || '').replace(/"/g, '""')}"`,
                    `"${t.status}"`,
                    fin.isInfacturable ? 'INFACTURABLE' : 'FACTURABLE',
                    ...(showProfitability ? [`"${acts}"`, `"${sourcesLabel}"`] : []),
                    fin.isInfacturable ? 0 : fin.diagnosticCost,
                    fin.isInfacturable ? 0 : fin.repairCost,
                    fin.isInfacturable ? 0 : fin.totalBilled,
                    ...(showProfitability ? [
                        fin.isInfacturable ? 0 : (prof?.totalPartCost || 0),
                        fin.isInfacturable ? 0 : (prof?.totalTaxProvision || 0),
                        fin.isInfacturable ? 0 : (prof?.netMargin || 0),
                        fin.isInfacturable ? 0 : (prof?.realNetMargin || 0),
                    ] : []),
                    fin.isInfacturable ? 0 : fin.advanceReceived,
                    fin.isInfacturable ? 0 : fin.balanceDue,
                    fin.isInfacturable ? 'ANNULE_INFACTURABLE' : (fin.isFullyPaid ? 'SOLDE' : (fin.advanceReceived > 0 ? 'ACOMPTE_VERSE' : 'NON_PAYE'))
                ].join(';');
            });

            const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `POINT_FINANCIER_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Fichier CSV généré avec succès.", "success");
        } catch (err) {
            console.error("CSV Export error:", err);
            showToast("Erreur lors de l'export CSV.", "error");
        }
    };

    // Copier le résumé pour WhatsApp / Email / Direction
    const handleCopySummary = async () => {
        const rep = profitabilityReport.byActivity.reparation;
        const pcs = profitabilityReport.byActivity.vente_pieces;
        const mac = profitabilityReport.byActivity.vente_macbook;
        const profitabilitySection = showProfitability
            ? `\n📈 *RENTABILITÉ PAR ACTIVITÉ (Prév. vs Réelle — Pièces 1x & Fisc. ${profitabilityReport.taxRate}%) :*
• *Réparation :* CA ${rep.ca.toLocaleString('fr-FR')} F | Prév. *${rep.netMargin.toLocaleString('fr-FR')} F* | Réelle *${rep.realNetMargin.toLocaleString('fr-FR')} F*
• *Vente de pièces :* CA ${pcs.ca.toLocaleString('fr-FR')} F | Prév. *${pcs.netMargin.toLocaleString('fr-FR')} F* | Réelle *${pcs.realNetMargin.toLocaleString('fr-FR')} F*
• *Vente de MacBook :* CA ${mac.ca.toLocaleString('fr-FR')} F | Prév. *${mac.netMargin.toLocaleString('fr-FR')} F* | Réelle *${mac.realNetMargin.toLocaleString('fr-FR')} F*
✅ *Marge Activités Prév. / Réelle :* ${profitabilityReport.totalNetMarginBeforeFixed.toLocaleString('fr-FR')} F / *${profitabilityReport.totalRealNetMarginBeforeFixed.toLocaleString('fr-FR')} F*
🏢 *Charges Fixes (${profitabilityReport.fixedChargesPeriodFactorLabel}) :* -${profitabilityReport.fixedChargesTotal.toLocaleString('fr-FR')} F CFA
💼 *Résultat Exploitation Prév. / Réel :* ${profitabilityReport.operatingResultAfterFixed.toLocaleString('fr-FR')} F / *${profitabilityReport.realOperatingResultAfterFixed.toLocaleString('fr-FR')} F*\n`
            : '';
        const treasurySection = showTreasury && treasurySnapshot
            ? `\n🏦 *TRÉSORERIE & CAPITAL ATELIER (Sans double comptage${treasurySnapshot.treasuryStartDate ? ` — depuis ${new Date(`${treasurySnapshot.treasuryStartDate}T12:00:00`).toLocaleDateString('fr-FR')}` : ''}) :*
• *Trésorerie Disponible Nette :* ${treasurySnapshot.availableTreasury.toLocaleString('fr-FR')} F CFA
• *Réserves (Fisc + Réinvest.) :* ${treasurySnapshot.totalReserves.toLocaleString('fr-FR')} F CFA
• *Dépenses à Payer (Passif) :* ${treasurySnapshot.totalPayables.toLocaleString('fr-FR')} F CFA
• *Capital Actuel (Stock + Cash Net) :* ${treasurySnapshot.totalCurrentCapital.toLocaleString('fr-FR')} F CFA\n`
            : '';

        const text = `📊 *POINT FINANCIER - TGS CÔTE D'IVOIRE*
🗓️ *Période :* ${periodLabel}
⏱️ *Édité le :* ${new Date().toLocaleString('fr-FR')}

📁 *Volume de fiches :* ${metrics.totalCount} dossier(s) (${metrics.facturablesCount} facturable(s), ${metrics.infacturablesCount} annulée(s))
💰 *Total Montants Facturés (CA) :* ${metrics.totalBilled.toLocaleString('fr-FR')} F CFA
🟢 *Acomptes Perçus (Caisse) :* ${metrics.totalAdvance.toLocaleString('fr-FR')} F CFA
🟠 *Restant Dû (Créances) :* ${metrics.totalBalanceDue.toLocaleString('fr-FR')} F CFA
${profitabilitySection}${treasurySection}${metrics.infacturablesCount > 0 ? `🚫 *Fiches Infacturables :* ${metrics.infacturablesCount} (0 F CFA comptabilisé)\n` : ''}
_Document officiel d'atelier TGS-CI_`;

        try {
            await navigator.clipboard.writeText(text);
            showToast("Résumé financier copié dans le presse-papiers !", "success");
        } catch {
            showToast("Impossible de copier automatiquement.", "warning");
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in text-white">
            {/* EN-TÊTE PRINCIPAL & ACTIONS RAPIDES */}
            <div className="bg-gradient-to-r from-zinc-900 via-[#10141f] to-zinc-900 border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all shrink-0 cursor-pointer"
                                title="Retour"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full bg-apple-blue/20 border border-apple-blue/30 text-apple-blue font-black text-[9px] uppercase tracking-widest">
                                    Comptabilité Atelier TGS-CI
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold">
                                    {filteredTickets.length} fiche(s) analysée(s)
                                </span>
                            </div>
                            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white m-0">
                                Point Financier des Fiches
                            </h1>
                            <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                                Extrayez le point total des montants facturés sur chaque fiche selon vos besoins précis : par semaine, mois, trimestre, semestre, année civile ou de date à date.
                            </p>
                        </div>
                    </div>

                    {/* BOUTONS DE SORTIE DES POINTS */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                            onClick={() => setIsPrintModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
                            title="Ouvrir l'aperçu et imprimer le document officiel A4"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimer le Point (PDF)</span>
                        </button>

                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
                            title="Télécharger le classeur Excel officiel"
                        >
                            <Download className="w-4 h-4" />
                            <span>Excel (.xlsx)</span>
                        </button>

                        <button
                            onClick={handleExportCsv}
                            className="flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-2xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 cursor-pointer"
                            title="Exporter au format CSV universel"
                        >
                            <span>CSV</span>
                        </button>

                        <button
                            onClick={handleCopySummary}
                            className="flex items-center gap-2 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-2xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 cursor-pointer"
                            title="Copier la synthèse textuelle pour WhatsApp"
                        >
                            <Share2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Partager</span>
                        </button>
                    </div>
                </div>

                {/* BARRE DES 2 INTERRUPTEURS INDÉPENDANTS (SANS SUPPRESSION DE DONNÉES) */}
                <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Modules de pilotage (activables à tout moment sans perte de données) :
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleToggleProfitability}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                showProfitability
                                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30'
                                    : 'bg-white/5 border-white/15 text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Rentabilité Activités : {showProfitability ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleToggleTreasury}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                showTreasury
                                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30'
                                    : 'bg-white/5 border-white/15 text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <Wallet className="w-3.5 h-3.5" />
                            <span>Suivi Capital 2M &amp; Trésorerie : {showTreasury ? 'ON' : 'OFF'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* SÉLECTEUR DE PÉRIODES INTERACTIF ("SELON MON BESOIN") */}
            <div className="bg-[#0e111a] border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-apple-blue" />
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                            Choisir la Période du Point :
                        </span>
                    </div>

                    {/* Onglets de types de période */}
                    <div className="flex flex-wrap items-center gap-1 bg-black/50 p-1 rounded-2xl border border-white/10">
                        {(
                            [
                                { key: 'jour', label: 'Jour' },
                                { key: 'semaine', label: 'Semaine' },
                                { key: 'mois', label: 'Mois' },
                                { key: 'trimestre', label: 'Trimestre' },
                                { key: 'semestre', label: 'Semestre' },
                                { key: 'annee', label: 'Année' },
                                { key: 'custom', label: 'Date à Date' },
                                { key: 'all', label: 'Historique' },
                            ] as { key: PeriodMode; label: string }[]
                        ).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setPeriodMode(key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    periodMode === key
                                        ? 'bg-apple-blue text-white shadow-lg shadow-blue-500/20'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* BARRE DE CONTRÔLE DE NAVIGATION DANS LA PÉRIODE SÉLECTIONNÉE */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                    {/* Navigation précédente / suivante si applicable */}
                    {periodMode !== 'custom' && periodMode !== 'all' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleShiftPeriod(-1)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
                                title="Période précédente"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <button
                                onClick={() => setRefDate(new Date())}
                                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase text-zinc-300 hover:text-white cursor-pointer"
                            >
                                Aujourd'hui
                            </button>

                            <button
                                onClick={() => handleShiftPeriod(1)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
                                title="Période suivante"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>

                            <div className="ml-2 font-mono text-xs font-bold text-white bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                                {periodLabel}
                            </div>
                        </div>
                    )}

                    {/* Interface spécifique pour le mode Date à Date (Custom) */}
                    {periodMode === 'custom' && (
                        <div className="flex flex-wrap items-center gap-3 w-full">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Du :</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-apple-blue font-mono"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Au :</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-apple-blue font-mono"
                                />
                            </div>

                            {/* Raccourcis rapides */}
                            <div className="flex flex-wrap items-center gap-1 ml-auto">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase mr-1">Raccourcis :</span>
                                <button
                                    onClick={() => applyQuickCustomRange(1)}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300"
                                >
                                    Aujourd'hui
                                </button>
                                <button
                                    onClick={() => applyQuickCustomRange(7)}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300"
                                >
                                    7 jours
                                </button>
                                <button
                                    onClick={() => applyQuickCustomRange(30)}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300"
                                >
                                    30 jours
                                </button>
                                <button
                                    onClick={() => applyQuickCustomRange('thisMonth')}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300"
                                >
                                    Ce mois
                                </button>
                                <button
                                    onClick={() => applyQuickCustomRange('thisQuarter')}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300"
                                >
                                    Ce trimestre
                                </button>
                                <button
                                    onClick={() => applyQuickCustomRange('thisYear')}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300"
                                >
                                    Cette année
                                </button>
                            </div>
                        </div>
                    )}

                    {periodMode === 'all' && (
                        <div className="font-mono text-xs font-bold text-white bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                            Registre intégral depuis l'ouverture de l'atelier
                        </div>
                    )}

                    {/* Choix de la date de référence (Création vs MAJ) */}
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                        <label className="text-[10px] font-black uppercase text-zinc-400">Base temporelle :</label>
                        <select
                            value={dateBasis}
                            onChange={(e) => setDateBasis(e.target.value as 'createdAt' | 'updatedAt')}
                            className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-apple-blue font-sans cursor-pointer"
                        >
                            <option value="createdAt">Date d'enregistrement / entrée</option>
                            <option value="updatedAt">Date de dernière mise à jour</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* SECTION INTELLIGENTE : DÉTECTION & HARMONISATION DES SOUS-TRAITANTS (≥ 5 MACHINES ENREGISTRÉES) */}
            {subcontractorCandidates.length > 0 && (
                <div className="bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-zinc-900 border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4 animate-slide-up">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg">
                                🤝
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm md:text-base font-black text-amber-300 uppercase tracking-tight m-0">
                                        Détection Sous-Traitants Partenaires ({subcontractorCandidates.length} candidat{subcontractorCandidates.length > 1 ? 's' : ''})
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase">
                                        ≥ 5 machines
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                                    Ces clients ont enregistré au moins 5 machines à leur nom dans vos registres {periodMode === 'annee' ? `de l'année ${currentYear}` : 'de l\'atelier'}. Confirmez s'ils font partie de vos sous-traitants pour harmoniser toutes leurs fiches (exonération des frais de diagnostic, réductions sous-traitance).
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowAllTimeCandidates(!showAllTimeCandidates)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                    showAllTimeCandidates 
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                        : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
                                }`}
                            >
                                {showAllTimeCandidates ? "Année uniquement" : "Analyser tout l'historique"}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {subcontractorCandidates.map((candidate) => (
                            <div
                                key={candidate.normalizedName}
                                className="bg-black/50 border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-black text-sm text-white uppercase truncate">
                                                {candidate.clientName}
                                            </p>
                                            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                                                {candidate.phone || 'Sans téléphone'}
                                            </p>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-black shrink-0">
                                            {candidate.ticketCount} machines
                                        </span>
                                    </div>

                                    <div className="mt-2.5 p-2.5 bg-amber-500/5 rounded-xl border border-amber-500/15 text-[11px] text-zinc-300 leading-snug">
                                        <span className="font-bold text-amber-200">Question :</span> Ce client fait-il partie de vos sous-traitants ?
                                        <br />
                                        <span className="text-[10px] text-zinc-400">
                                            → Si oui : frais de diagnostic = 0 F CFA sur ses {candidate.ticketCount} fiches.
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                    <button
                                        type="button"
                                        disabled={isHarmonizing}
                                        onClick={() => handleHarmonizeAsSubcontractor(candidate)}
                                        className="flex-1 py-2 px-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-900/30 active:scale-95 disabled:opacity-50 cursor-pointer text-center"
                                    >
                                        {isHarmonizing ? "Harmonisation..." : "✓ Oui, valider sous-traitant"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDismissCandidate(candidate.normalizedName)}
                                        className="py-2 px-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer"
                                        title="Conserver en client direct pour l'instant"
                                    >
                                        ✕ Non
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SYNTHÈSE DES TOTAUX (4 CARTES COMPTABLES OFFICIELLES) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Facturé */}
                <div className="bg-gradient-to-br from-blue-950/40 to-slate-900/80 border border-blue-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                            Total Montants Facturés
                        </span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <DollarSign className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-white font-mono tracking-tight">
                        {metrics.totalBilled.toLocaleString('fr-FR')} <span className="text-xs font-normal text-blue-300">FCFA</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2 flex items-center justify-between">
                        <span>{metrics.facturablesCount} fiche(s) facturable(s)</span>
                        <span className="text-blue-400 font-bold">Diag + Réparation</span>
                    </p>
                </div>

                {/* Acomptes Encaissés (Caisse) */}
                <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                            Acomptes Reçus (Caisse)
                        </span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-emerald-300 font-mono tracking-tight">
                        {metrics.totalAdvance.toLocaleString('fr-FR')} <span className="text-xs font-normal text-emerald-400">FCFA</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2 flex items-center justify-between">
                        <span>Taux d'encaissement</span>
                        <span className="text-emerald-400 font-black font-mono">{metrics.collectionRate}%</span>
                    </p>
                </div>

                {/* Restant Dû (Créances) */}
                <div className="bg-gradient-to-br from-amber-950/40 to-slate-900/80 border border-amber-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                            Reste Dû (Créances)
                        </span>
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-amber-300 font-mono tracking-tight">
                        {metrics.totalBalanceDue.toLocaleString('fr-FR')} <span className="text-xs font-normal text-amber-400">FCFA</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2 flex items-center justify-between">
                        <span>{metrics.withBalanceCount} fiche(s) en attente</span>
                        <span className="text-amber-400 font-bold">À percevoir au retrait</span>
                    </p>
                </div>

                {/* Fiches Infacturables (Annulées) */}
                <div className="bg-gradient-to-br from-zinc-900 to-slate-900 border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Fiches Infacturables
                        </span>
                        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <X className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-zinc-300 font-mono tracking-tight">
                        {metrics.infacturablesCount} <span className="text-xs font-normal text-rose-400">annulée(s)</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2 flex items-center justify-between">
                        <span className="text-rose-400 font-bold">0 F comptabilisé au point</span>
                        <span className="text-zinc-500">Règle TGS-CI</span>
                    </p>
                </div>
            </div>

            {/* AVERTISSEMENT RÈGLE COMPTABLE ATELIER TGS-CI */}
            {metrics.infacturablesCount > 0 && (
                <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200">
                    <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                        <div>
                            <strong className="text-white uppercase">Règle Comptable Atelier TGS-CI appliquée :</strong> {metrics.infacturablesCount} dossier(s) annulé(s) figure(nt) sur cette période. Conformément à la gestion atelier, ils sont déclarés <strong>INFACTURABLES</strong> : aucune avance historique ni solde n'est intégré dans les totaux du point financier.
                        </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-black text-[11px] whitespace-nowrap">
                        0 F CFA AU POINT
                    </span>
                </div>
            )}

            {/* SECTION RENTABILITÉ PAR ACTIVITÉ & CHARGES FIXES SÉPARÉES */}
            {showProfitability && (
            <div className="bg-[#0e111a] border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm md:text-base font-black uppercase tracking-tight text-white m-0">
                                Rentabilité par Activité (1 fiche par dossier)
                            </h2>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                Marge Prévisionnelle (facturée) vs Réelle (encaissée) &bull; Coût pièces 1x (En stock / À commander / 0 F client) &bull; Charges fixes séparées
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-black/50 border border-amber-500/30 rounded-2xl px-3 py-1.5">
                            <label className="text-[10px] font-black uppercase text-amber-400 whitespace-nowrap">
                                Provision fiscale sur CA :
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={taxProvisionRate}
                                onChange={(e) => {
                                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                    updateSettings('profitability', { taxProvisionRate: val });
                                }}
                                className="w-16 bg-zinc-900 border border-white/15 rounded-lg px-2 py-1 text-xs font-mono font-black text-amber-300 text-right focus:outline-none focus:border-amber-400"
                            />
                            <span className="text-xs font-bold text-amber-400">%</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowFixedChargesManager(v => !v)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                showFixedChargesManager
                                    ? 'bg-purple-600/25 border-purple-400 text-purple-200'
                                    : 'bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10'
                            }`}
                        >
                            <Building2 className="w-4 h-4 text-purple-400" />
                            <span>Charges Fixes ({fixedCharges.filter(c => c.active).length})</span>
                        </button>
                    </div>
                </div>

                {/* 3 CARTES PAR ACTIVITÉ (PRÉVISIONNEL VS RÉEL) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {ACTIVITY_ORDER.map((act) => {
                        const summary = profitabilityReport.byActivity[act];
                        const isSelected = activityFilter === act;
                        const accentClass =
                            act === 'vente_macbook'
                                ? 'from-purple-950/40 border-purple-500/30 text-purple-300'
                                : act === 'vente_pieces'
                                    ? 'from-amber-950/40 border-amber-500/30 text-amber-300'
                                    : 'from-blue-950/40 border-blue-500/30 text-blue-300';

                        return (
                            <div
                                key={act}
                                className={`bg-gradient-to-br ${accentClass} to-zinc-900/90 border rounded-2xl p-4 space-y-3 transition-all ${
                                    isSelected ? 'ring-2 ring-white/50' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <span className="text-[11px] font-black uppercase tracking-wider text-white block">
                                            {summary.label}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 font-mono">
                                            {summary.ticketCount} dossier(s) &bull; {summary.lineCount} ligne(s)
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActivityFilter(prev => prev === act ? 'all' : act)}
                                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-white text-black border-white'
                                                : 'bg-black/40 text-zinc-300 border-white/15 hover:bg-white/10'
                                        }`}
                                    >
                                        {isSelected ? 'Tout afficher' : 'Filtrer'}
                                    </button>
                                </div>

                                <div className="space-y-1.5 text-xs border-t border-white/10 pt-2.5">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">CA Facturé / Encaissé</span>
                                        <span className="font-mono font-bold text-white">
                                            {summary.ca.toLocaleString('fr-FR')} F
                                            <span className="text-zinc-500 font-normal"> / {summary.realCA.toLocaleString('fr-FR')} F</span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Coût pièces (1x)</span>
                                        <span className="font-mono text-amber-300">-{summary.partCost.toLocaleString('fr-FR')} F</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Provision fiscale ({profitabilityReport.taxRate}%)</span>
                                        <span className="font-mono text-orange-300">-{summary.taxProvision.toLocaleString('fr-FR')} F</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2.5">
                                    <div className="bg-black/35 rounded-xl p-2 border border-white/5">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 block">Marge Prév.</span>
                                        <span className={`font-mono font-black text-sm ${summary.netMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {summary.netMargin.toLocaleString('fr-FR')} F
                                        </span>
                                        <span className="block text-[9px] font-mono text-zinc-400">({summary.marginRate.toFixed(1)}%)</span>
                                    </div>
                                    <div className="bg-black/35 rounded-xl p-2 border border-emerald-500/20">
                                        <span className="text-[9px] font-black uppercase text-emerald-300 block">Marge Réelle</span>
                                        <span className={`font-mono font-black text-sm ${summary.realNetMargin >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                                            {summary.realNetMargin.toLocaleString('fr-FR')} F
                                        </span>
                                        <span className="block text-[9px] font-mono text-emerald-400/80">({summary.realMarginRate.toFixed(1)}%)</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* RÉPARTITION APPROVISIONNEMENT PIÈCES SUR LA PÉRIODE */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-zinc-400 text-[10px] font-black uppercase">Pièces En Stock utilisées</span>
                        <span className="font-mono font-bold text-emerald-300">{profitabilityReport.enStockPartCostTotal.toLocaleString('fr-FR')} F</span>
                    </div>
                    <div className="bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-zinc-400 text-[10px] font-black uppercase">
                            Pièces À Commander ({profitabilityReport.aCommanderPlannedCostTotal > 0 ? `dont ${profitabilityReport.aCommanderPlannedCostTotal.toLocaleString('fr-FR')} F prévues` : 'engagées'})
                        </span>
                        <span className="font-mono font-bold text-amber-300">{profitabilityReport.aCommanderPartCostTotal.toLocaleString('fr-FR')} F</span>
                    </div>
                    <div className="bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-zinc-400 text-[10px] font-black uppercase">Lignes Fourni Client (0 F pièce)</span>
                        <span className="font-mono font-bold text-cyan-300">{profitabilityReport.fourniClientLineCount} ligne(s)</span>
                    </div>
                </div>

                {/* SÉPARATION CLAIRE : MARGE DES ACTIVITÉS (PRÉV. vs RÉELLE) vs CHARGES FIXES */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                    <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/25 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                1. Marge Activités (Avant Charges Fixes)
                            </span>
                            <span className="text-[10px] font-mono text-emerald-300 font-bold">
                                Prév. {profitabilityReport.marginRateBeforeFixed.toFixed(1)}% &bull; Réel {profitabilityReport.realMarginRateBeforeFixed.toFixed(1)}%
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                            <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                                <span className="text-[9px] text-zinc-400 uppercase block">CA Facturé / Réel</span>
                                <span className="font-mono font-black text-white block">{profitabilityReport.totalCA.toLocaleString('fr-FR')} F</span>
                                <span className="font-mono text-[10px] text-emerald-400">Réel: {profitabilityReport.totalRealCA.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                                <span className="text-[9px] text-amber-400 uppercase block">Pièces (1x) Prév/Réel</span>
                                <span className="font-mono font-bold text-amber-300 block">-{profitabilityReport.totalPartCost.toLocaleString('fr-FR')} F</span>
                                <span className="font-mono text-[10px] text-amber-200/80">Engagé: -{profitabilityReport.totalRealPartCost.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="bg-emerald-500/15 p-2.5 rounded-xl border border-emerald-500/30">
                                <span className="text-[9px] text-emerald-300 uppercase block">Marge Prév.</span>
                                <span className={`font-mono font-black ${profitabilityReport.totalNetMarginBeforeFixed >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {profitabilityReport.totalNetMarginBeforeFixed.toLocaleString('fr-FR')} F
                                </span>
                            </div>
                            <div className="bg-teal-500/15 p-2.5 rounded-xl border border-teal-500/35">
                                <span className="text-[9px] text-teal-300 uppercase block">Marge Réelle</span>
                                <span className={`font-mono font-black ${profitabilityReport.totalRealNetMarginBeforeFixed >= 0 ? 'text-teal-200' : 'text-rose-300'}`}>
                                    {profitabilityReport.totalRealNetMarginBeforeFixed.toLocaleString('fr-FR')} F
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-950/25 border border-purple-500/25 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">
                                2. Charges Fixes Séparées &amp; Résultat Net
                            </span>
                            <span className="text-[10px] font-mono text-purple-300">
                                {profitabilityReport.fixedChargesPeriodFactorLabel}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                            <div className="bg-black/40 p-2.5 rounded-xl border border-purple-500/20 flex flex-col justify-between">
                                <span className="text-[9px] text-purple-300 uppercase block">Charges Fixes ({fixedCharges.filter(c => c.active).length})</span>
                                <span className="font-mono font-black text-purple-300 text-sm">
                                    -{profitabilityReport.fixedChargesTotal.toLocaleString('fr-FR')} F
                                </span>
                            </div>
                            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                                profitabilityReport.operatingResultAfterFixed >= 0
                                    ? 'bg-emerald-500/15 border-emerald-500/35'
                                    : 'bg-rose-500/15 border-rose-500/35'
                            }`}>
                                <span className="text-[9px] uppercase font-black text-white block">Résultat Prév.</span>
                                <span className={`font-mono font-black text-sm ${
                                    profitabilityReport.operatingResultAfterFixed >= 0 ? 'text-emerald-300' : 'text-rose-300'
                                }`}>
                                    {profitabilityReport.operatingResultAfterFixed.toLocaleString('fr-FR')} F
                                </span>
                            </div>
                            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                                profitabilityReport.realOperatingResultAfterFixed >= 0
                                    ? 'bg-teal-500/15 border-teal-500/35'
                                    : 'bg-rose-500/15 border-rose-500/35'
                            }`}>
                                <span className="text-[9px] uppercase font-black text-teal-200 block">Résultat Réel</span>
                                <span className={`font-mono font-black text-sm ${
                                    profitabilityReport.realOperatingResultAfterFixed >= 0 ? 'text-teal-200' : 'text-rose-300'
                                }`}>
                                    {profitabilityReport.realOperatingResultAfterFixed.toLocaleString('fr-FR')} F
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* GESTIONNAIRE DÉDIÉ DES CHARGES FIXES (SÉPARÉ DES FICHES) */}
                {showFixedChargesManager && (
                    <div className="p-4 rounded-2xl bg-black/50 border border-purple-500/30 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <div>
                                <h3 className="text-xs font-black uppercase text-purple-300 m-0">
                                    Configuration des Charges Fixes (Indépendantes des Dossiers)
                                </h3>
                                <p className="text-[10px] text-zinc-400 mt-0.5">
                                    Loyer, salaires fixes, électricité, fibre, abonnements... Ces charges sont proratisées selon la période choisie et déduites uniquement du résultat global.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowFixedChargesManager(false)}
                                className="text-zinc-400 hover:text-white p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleAddFixedCharge} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
                            <div className="lg:col-span-2">
                                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Libellé de la charge *</label>
                                <input
                                    type="text"
                                    value={newChargeLabel}
                                    onChange={(e) => setNewChargeLabel(e.target.value)}
                                    placeholder="Ex: Loyer Atelier, Salaires, CIE..."
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Montant (F CFA) *</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={newChargeAmount}
                                    onChange={(e) => setNewChargeAmount(e.target.value)}
                                    placeholder="250000"
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Périodicité</label>
                                <select
                                    value={newChargeFreq}
                                    onChange={(e) => setNewChargeFreq(e.target.value as FixedChargeFrequency)}
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                                >
                                    <option value="mensuel">Mensuelle</option>
                                    <option value="trimestriel">Trimestrielle</option>
                                    <option value="annuel">Annuelle</option>
                                    <option value="ponctuel">Ponctuelle (date)</option>
                                </select>
                            </div>
                            <div>
                                {newChargeFreq === 'ponctuel' ? (
                                    <>
                                        <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Date</label>
                                        <input
                                            type="date"
                                            value={newChargeDate}
                                            onChange={(e) => setNewChargeDate(e.target.value)}
                                            className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Catégorie</label>
                                        <input
                                            type="text"
                                            value={newChargeCategory}
                                            onChange={(e) => setNewChargeCategory(e.target.value)}
                                            placeholder="Loyer, Salaires..."
                                            className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                                        />
                                    </>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                Ajouter
                            </button>
                        </form>

                        {profitabilityReport.fixedChargesLines.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-white/10">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-white/5 text-[9px] uppercase font-black text-zinc-400 border-b border-white/10">
                                            <th className="py-2 px-3">Actif</th>
                                            <th className="py-2 px-3">Libellé</th>
                                            <th className="py-2 px-3">Catégorie</th>
                                            <th className="py-2 px-3">Fréquence</th>
                                            <th className="py-2 px-3 text-right">Montant Base</th>
                                            <th className="py-2 px-3 text-right">Prorata Période</th>
                                            <th className="py-2 px-3 text-center">Suppr.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {profitabilityReport.fixedChargesLines.map(chg => (
                                            <tr key={chg.id} className={!chg.active ? 'opacity-40' : ''}>
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={chg.active}
                                                        onChange={() => handleToggleFixedCharge(chg.id)}
                                                        className="accent-purple-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="py-2 px-3 font-bold text-white">{chg.label}</td>
                                                <td className="py-2 px-3 text-zinc-400">{chg.category || 'Atelier'}</td>
                                                <td className="py-2 px-3 uppercase text-[10px] font-mono text-purple-300">
                                                    {chg.frequency}{chg.date ? ` (${chg.date})` : ''}
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono text-zinc-300">
                                                    {chg.baseAmount.toLocaleString('fr-FR')} F
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono font-black text-purple-300">
                                                    {chg.proratedAmount.toLocaleString('fr-FR')} F
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFixedCharge(chg.id)}
                                                        className="p-1 text-rose-400 hover:bg-rose-500/15 rounded-lg cursor-pointer"
                                                        title="Supprimer cette charge"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-xs text-zinc-500 italic">
                                Aucune charge fixe configurée pour le moment. Ajoutez vos charges récurrentes (loyer, salaires, internet...) pour isoler le résultat d'exploitation réel.
                            </div>
                        )}
                    </div>
                )}
            </div>
            )}

            {/* PILOTAGE CAPITAL (~2M), TRÉSORERIE DISPONIBLE, RÉSERVES & DÉPENSES À PAYER */}
            {showTreasury && treasurySnapshot && (
            <div className="bg-[#0e111a] border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-sm md:text-base font-black uppercase tracking-tight text-white m-0">
                                    Trésorerie Disponible, Réserves &amp; Capital Atelier
                                </h2>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-black uppercase">
                                    Sans double comptage &bull; 0 blocage stock
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[9px] font-black uppercase">
                                    {treasurySnapshot.treasuryStartDate
                                        ? `Depuis le ${new Date(`${treasurySnapshot.treasuryStartDate}T12:00:00`).toLocaleDateString('fr-FR')}`
                                        : 'Historique complet'}
                                </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                Capital initial (~{(treasurySnapshot.initialCapital / 1000000).toFixed(1)}M) réinvesti progressivement &bull; Sépare caisse brute, réserves dédiées et dépenses à payer
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowTreasuryConfig(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                            showTreasuryConfig
                                ? 'bg-cyan-600/25 border-cyan-400 text-cyan-200'
                                : 'bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10'
                        }`}
                    >
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        <span>Paramètres Trésorerie &amp; Seuils (Optionnels)</span>
                    </button>
                </div>

                {/* ALERTES STRICTEMENT OPTIONNELLES (0 BLOCAGE) */}
                {treasurySnapshot.enableOptionalAlerts && (treasurySnapshot.isLowTreasuryAlert || treasurySnapshot.lowStockItemsCount > 0) && (
                    <div className="bg-amber-950/30 border border-amber-500/35 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
                        <div className="flex items-center gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                                <strong>Alerte informative (non bloquante) :</strong>
                                {treasurySnapshot.isLowTreasuryAlert && ` Trésorerie disponible (${treasurySnapshot.availableTreasury.toLocaleString('fr-FR')} F) sous le seuil de ${treasurySnapshot.lowTreasuryThreshold.toLocaleString('fr-FR')} F.`}
                                {treasurySnapshot.lowStockItemsCount > 0 && ` ${treasurySnapshot.lowStockItemsCount} article(s) stock au niveau du seuil configuré.`}
                            </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-zinc-400">
                            Aucun blocage atelier
                        </span>
                    </div>
                )}

                {/* CONFIGURATION INLINE TRÉSORERIE & CAPITAL */}
                {showTreasuryConfig && (
                    <div className="p-4 rounded-2xl bg-black/50 border border-cyan-500/30 space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[9px] font-black uppercase text-cyan-300">Date démarrage suivi</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateSettings('profitability', { treasuryStartDate: new Date().toISOString().slice(0, 10) })}
                                            className="text-[9px] text-cyan-400 hover:underline font-bold cursor-pointer"
                                        >
                                            Aujourd&apos;hui
                                        </button>
                                        {settings.profitability?.treasuryStartDate && (
                                            <button
                                                type="button"
                                                onClick={() => updateSettings('profitability', { treasuryStartDate: '' })}
                                                className="text-[9px] text-zinc-400 hover:underline font-bold cursor-pointer"
                                            >
                                                Tout l&apos;historique
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <input
                                    type="date"
                                    value={settings.profitability?.treasuryStartDate || ''}
                                    onChange={(e) => updateSettings('profitability', { treasuryStartDate: e.target.value })}
                                    className="w-full bg-zinc-900 border border-cyan-500/30 rounded-xl px-3 py-2 text-xs font-mono text-cyan-200"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Capital Initial Atelier (F)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="50000"
                                    value={settings.profitability?.initialCapital ?? 2000000}
                                    onChange={(e) => updateSettings('profitability', { initialCapital: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[9px] font-black uppercase text-zinc-400">Trésorerie de Départ (F)</label>
                                    {!treasurySnapshot.isOpeningCashAuto && (
                                        <button
                                            type="button"
                                            onClick={() => updateSettings('profitability', { openingCash: undefined })}
                                            className="text-[9px] text-cyan-400 hover:underline font-bold cursor-pointer"
                                        >
                                            Remettre Auto
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    placeholder={`Auto (${Math.max(0, (settings.profitability?.initialCapital ?? 2000000) - treasurySnapshot.stockCostValue).toLocaleString('fr-FR')})`}
                                    value={settings.profitability?.openingCash ?? ''}
                                    onChange={(e) => {
                                        const raw = e.target.value.trim();
                                        updateSettings('profitability', { openingCash: raw === '' ? undefined : Number(raw) || 0 });
                                    }}
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Réinvestissement Stock (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={settings.profitability?.reinvestmentRate ?? 0}
                                    onChange={(e) => updateSettings('profitability', { reinvestmentRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Seuil Alerte Trésorerie (0 = off)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="50000"
                                    value={settings.profitability?.lowTreasuryThreshold ?? 0}
                                    onChange={(e) => updateSettings('profitability', { lowTreasuryThreshold: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Impôts Déjà Versés (F)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="10000"
                                    value={settings.profitability?.manualTaxReservePaid ?? 0}
                                    onChange={(e) => updateSettings('profitability', { manualTaxReservePaid: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-1">Réinvestissement Déjà Utilisé (F)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="10000"
                                    value={settings.profitability?.manualReinvestedUsed ?? 0}
                                    onChange={(e) => updateSettings('profitability', { manualReinvestedUsed: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white"
                                />
                            </div>

                            <label className="flex items-center gap-2.5 bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.profitability?.includeFacturesInTreasury !== false}
                                    onChange={(e) => updateSettings('profitability', { includeFacturesInTreasury: e.target.checked })}
                                    className="accent-cyan-500"
                                />
                                <span className="text-[11px] font-bold text-zinc-200">Inclure Factures &amp; Commandes clients</span>
                            </label>

                            <label className="flex items-center gap-2.5 bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={Boolean(settings.profitability?.enableOptionalAlerts)}
                                    onChange={(e) => updateSettings('profitability', { enableOptionalAlerts: e.target.checked })}
                                    className="accent-amber-500"
                                />
                                <span className="text-[11px] font-bold text-zinc-200">Activer alertes seuils (optionnel)</span>
                            </label>
                        </div>
                    </div>
                )}

                {/* 4 CARTES TRÉSORERIE / RÉSERVES / PASSIF / CAPITAL */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* 1. Trésorerie Disponible Nette */}
                    <div className="bg-gradient-to-br from-cyan-950/35 to-zinc-900/90 border border-cyan-500/30 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                                Trésorerie Disponible Nette
                            </span>
                            <Wallet className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className={`text-2xl font-black font-mono ${treasurySnapshot.availableTreasury >= 0 ? 'text-cyan-200' : 'text-rose-400'}`}>
                            {treasurySnapshot.availableTreasury.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
                        </div>
                        <div className="space-y-1 text-[11px] border-t border-white/10 pt-2">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Départ ({treasurySnapshot.isOpeningCashAuto ? 'Auto' : 'Manuel'})</span>
                                <span className="font-mono text-zinc-200">{treasurySnapshot.effectiveOpeningCash.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Encaissements totaux</span>
                                <span className="font-mono text-emerald-300">+{treasurySnapshot.totalCashIn.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Sorties payées</span>
                                <span className="font-mono text-amber-300">-{treasurySnapshot.totalCashOut.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between font-bold border-t border-white/5 pt-1">
                                <span className="text-zinc-300">Caisse brute</span>
                                <span className="font-mono text-white">{treasurySnapshot.grossCashBalance.toLocaleString('fr-FR')} F</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Réserves Dédiées */}
                    <div className="bg-gradient-to-br from-emerald-950/35 to-zinc-900/90 border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                                Réserves Dédiées
                            </span>
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-200">
                            {treasurySnapshot.totalReserves.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
                        </div>
                        <div className="space-y-1 text-[11px] border-t border-white/10 pt-2">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Réserve fiscale nette</span>
                                <span className="font-mono text-orange-300">{treasurySnapshot.fiscalReserveRemaining.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Réinvest. stock ({treasurySnapshot.reinvestmentRate}%)</span>
                                <span className="font-mono text-emerald-300">{treasurySnapshot.reinvestmentReserveRemaining.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Créances clients en attente</span>
                                <span className="font-mono text-amber-200">{treasurySnapshot.clientReceivables.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between font-bold border-t border-white/5 pt-1">
                                <span className="text-zinc-300">Caisse après réserves</span>
                                <span className="font-mono text-white">{treasurySnapshot.treasuryAfterReserves.toLocaleString('fr-FR')} F</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Dépenses à Payer (Passif) */}
                    <div className="bg-gradient-to-br from-amber-950/35 to-zinc-900/90 border border-amber-500/30 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                                Dépenses à Payer (Passif)
                            </span>
                            <Receipt className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="text-2xl font-black font-mono text-amber-200">
                            {treasurySnapshot.totalPayables.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
                        </div>
                        <div className="space-y-1 text-[11px] border-t border-white/10 pt-2">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Commandes fourn. ({treasurySnapshot.supplierOrdersPayableCount})</span>
                                <span className="font-mono text-amber-300">{treasurySnapshot.supplierOrdersPayable.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Pièces à commander ({treasurySnapshot.plannedPartsToOrderCount})</span>
                                <span className="font-mono text-orange-300">{treasurySnapshot.plannedPartsToOrderCost.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Charges fixes (mois en cours)</span>
                                <span className="font-mono text-purple-300">{treasurySnapshot.monthlyFixedCharges.toLocaleString('fr-FR')} F</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Capital Atelier & Stock */}
                    <div className="bg-gradient-to-br from-purple-950/35 to-zinc-900/90 border border-purple-500/30 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                                Capital Atelier &amp; Stock
                            </span>
                            <Package className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="text-2xl font-black font-mono text-white">
                            {treasurySnapshot.totalCurrentCapital.toLocaleString('fr-FR')} <span className="text-xs font-normal text-purple-300">F</span>
                        </div>
                        <div className="space-y-1 text-[11px] border-t border-white/10 pt-2">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Capital initial</span>
                                <span className="font-mono text-zinc-300">{treasurySnapshot.initialCapital.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Stock ({treasurySnapshot.stockQuantityTotal} u.) achat</span>
                                <span className="font-mono text-purple-200">{treasurySnapshot.stockCostValue.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Valeur vente stock</span>
                                <span className="font-mono text-zinc-400">{treasurySnapshot.stockSellingValue.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between font-bold border-t border-white/5 pt-1">
                                <span className="text-zinc-300">Évolution capital</span>
                                <span className={`font-mono ${treasurySnapshot.capitalGrowth >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                                    {treasurySnapshot.capitalGrowth >= 0 ? '+' : ''}{treasurySnapshot.capitalGrowth.toLocaleString('fr-FR')} F
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* FILTRES SECONDAIRES & RECHERCHE INSTANTANÉE */}
            <div className="bg-[#0c0e14] border border-white/10 rounded-3xl p-4 shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher par n° fiche, nom du client, contact, modèle Mac..."
                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-apple-blue/50"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Filtre Paiement */}
                    <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
                        className="bg-black/60 border border-white/10 rounded-2xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-apple-blue cursor-pointer"
                    >
                        <option value="all">Tous les états de règlement</option>
                        <option value="paid">✅ Uniquement Soldés (100% payés)</option>
                        <option value="with_balance">🟠 Uniquement avec Reste Dû (Créances)</option>
                        <option value="infacturable">🚫 Fiches Annulées / Infacturables</option>
                    </select>

                    {/* Filtre Statut technique */}
                    <select
                        value={techStatusFilter}
                        onChange={(e) => setTechStatusFilter(e.target.value as TechStatusFilter)}
                        className="bg-black/60 border border-white/10 rounded-2xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-apple-blue cursor-pointer"
                    >
                        <option value="all">Tous les statuts d'atelier</option>
                        <option value="devis">Diagnostic & Devis</option>
                        <option value="in_progress">En cours de travaux / tests</option>
                        <option value="ready">Prêts au retrait</option>
                        <option value="returned">Restitués / Rendus au client</option>
                        <option value="canceled">Annulés / Irréparables</option>
                    </select>

                    {/* Filtre Client */}
                    <select
                        value={clientTypeFilter}
                        onChange={(e) => setClientTypeFilter(e.target.value as 'all' | 'individual' | 'enterprise')}
                        className="bg-black/60 border border-white/10 rounded-2xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-apple-blue cursor-pointer"
                    >
                        <option value="all">Tous types de clients</option>
                        <option value="individual">Particuliers uniquement</option>
                        <option value="enterprise">Entreprises uniquement</option>
                    </select>

                    {/* Filtre Activité */}
                    {showProfitability && (
                        <select
                            value={activityFilter}
                            onChange={(e) => setActivityFilter(e.target.value as 'all' | ActivityCategory)}
                            className="bg-black/60 border border-white/10 rounded-2xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-apple-blue cursor-pointer"
                        >
                            <option value="all">Toutes les activités</option>
                            <option value="reparation">🔧 Réparation</option>
                            <option value="vente_pieces">🧩 Vente de pièces</option>
                            <option value="vente_macbook">💻 Vente de MacBook</option>
                        </select>
                    )}
                </div>
            </div>

            {/* TABLEAU DÉTAILLÉ LIGNE PAR LIGNE SUR CHAQUE FICHE */}
            <div className="bg-[#0c0e14] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-apple-blue" />
                        <h2 className="text-sm font-black uppercase tracking-wider text-white m-0">
                            Point Dossier par Dossier &amp; Détail Ligne par Ligne ({filteredTickets.length})
                        </h2>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">
                        Cliquez sur ▸ pour voir le détail par ligne &bull; Période : <strong className="text-white">{periodLabel}</strong>
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.03] text-zinc-400 text-[10px] uppercase font-black tracking-wider">
                                {showProfitability && <th className="py-3 px-2 text-center w-8"></th>}
                                <th className="py-3 px-3 text-center">N° Fiche</th>
                                <th className="py-3 px-3">Date</th>
                                <th className="py-3 px-3">Client &amp; Contact</th>
                                <th className="py-3 px-3">{showProfitability ? 'Modèle / Activités' : 'Modèle Mac'}</th>
                                <th className="py-3 px-3">Statut</th>
                                <th className="py-3 px-3 text-right bg-blue-500/10 text-blue-300">CA Facturé</th>
                                {showProfitability && <th className="py-3 px-3 text-right text-amber-300">Pièces (1x)</th>}
                                {showProfitability && <th className="py-3 px-3 text-right text-orange-300">Prov. Fisc.</th>}
                                {showProfitability && <th className="py-3 px-3 text-right bg-emerald-500/10 text-emerald-300">Marge Prév. / Réelle</th>}
                                <th className="py-3 px-3 text-right">Acompte</th>
                                <th className="py-3 px-3 text-right">Solde Dû</th>
                                <th className="py-3 px-3 text-center">Action</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-white/5">
                            {filteredTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={showProfitability ? 13 : 9} className="py-12 text-center text-zinc-500 italic">
                                        Aucune fiche de réparation ne correspond aux critères pour cette période ({periodLabel}).
                                    </td>
                                </tr>
                            ) : (
                                filteredTickets.map((ticket) => {
                                    const fin = getTicketFinancialSummary(ticket);
                                    const prof = showProfitability ? profitabilityReport.ticketResults.get(ticket.id) : undefined;
                                    const isExpanded = showProfitability && expandedTicketIds.has(ticket.id);
                                    const dateStr = ticket.createdAt 
                                        ? new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                        })
                                        : 'N/A';

                                    const isRowInfacturable = fin.isInfacturable;

                                    return (
                                        <React.Fragment key={ticket.id}>
                                            <tr 
                                                className={`transition-colors hover:bg-white/[0.04] ${
                                                    isRowInfacturable ? 'bg-rose-950/15 text-zinc-400' : ''
                                                }`}
                                            >
                                                {/* Bouton déplier lignes */}
                                                {showProfitability && (
                                                    <td className="py-3 px-2 text-center">
                                                        {!isRowInfacturable && prof && prof.lines.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpandTicket(ticket.id)}
                                                                className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-all cursor-pointer"
                                                                title="Afficher le détail par ligne"
                                                            >
                                                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                            </button>
                                                        )}
                                                    </td>
                                                )}

                                                {/* N° Fiche */}
                                                <td className="py-3 px-3 text-center font-mono font-black text-white">
                                                    #{ticket.id}
                                                </td>

                                                {/* Date */}
                                                <td className="py-3 px-3 font-mono text-[11px] text-zinc-400">
                                                    {dateStr}
                                                </td>

                                                {/* Client & Contact */}
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-white uppercase truncate max-w-[140px]">
                                                        {ticket.client?.name || 'Client Inconnu'}
                                                    </div>
                                                    {ticket.client?.phone && (
                                                        <div className="text-[10px] font-mono text-zinc-400">
                                                            {ticket.client.phone}
                                                        </div>
                                                    )}
                                                    {ticket.client?.isEnterprise && (
                                                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[8px] font-black uppercase">
                                                            Entreprise
                                                        </span>
                                                    )}
                                                    {ticket.client?.clientType === 'subcontractor' && (
                                                        <span className="inline-block ml-1 mt-0.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] font-black uppercase">
                                                            ⚡ Sous-traitant
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Modèle Mac & Activités */}
                                                <td className="py-3 px-3">
                                                    <span className="truncate max-w-[130px] block font-medium text-zinc-300">
                                                        {ticket.macModel || 'MacBook'}
                                                    </span>
                                                    {!isRowInfacturable && prof && prof.activitiesPresent.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {prof.activitiesPresent.map(act => (
                                                                <span
                                                                    key={act}
                                                                    className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase border ${
                                                                        act === 'vente_macbook'
                                                                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                                                            : act === 'vente_pieces'
                                                                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                                                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                                                    }`}
                                                                >
                                                                    {ACTIVITY_SHORT_LABELS[act]}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Statut Atelier */}
                                                <td className="py-3 px-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border inline-block ${
                                                        isRowInfacturable 
                                                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                                                            : ticket.status === RepairStatus.TERMINE 
                                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                                            : ticket.status === RepairStatus.RENDU
                                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                                    }`}>
                                                        {isRowInfacturable ? 'ANNULÉ' : ticket.status}
                                                    </span>
                                                </td>

                                                {/* CA FACTURÉ */}
                                                <td className="py-3 px-3 text-right font-mono font-black bg-blue-500/5 text-blue-200">
                                                    {isRowInfacturable ? (
                                                        <span className="text-rose-400 font-bold text-[10px]">0 F (INFACT.)</span>
                                                    ) : (
                                                        `${fin.totalBilled.toLocaleString('fr-FR')} F`
                                                    )}
                                                </td>

                                                {/* COÛT PIÈCES 1X */}
                                                {showProfitability && (
                                                    <td className="py-3 px-3 text-right font-mono text-amber-300">
                                                        {isRowInfacturable ? (
                                                            <span className="text-zinc-600">0 F</span>
                                                        ) : (
                                                            `${(prof?.totalPartCost || 0) > 0 ? '-' : ''}${(prof?.totalPartCost || 0).toLocaleString('fr-FR')} F`
                                                        )}
                                                    </td>
                                                )}

                                                {/* PROVISION FISCALE */}
                                                {showProfitability && (
                                                    <td className="py-3 px-3 text-right font-mono text-orange-300">
                                                        {isRowInfacturable ? (
                                                            <span className="text-zinc-600">0 F</span>
                                                        ) : (
                                                            `${(prof?.totalTaxProvision || 0) > 0 ? '-' : ''}${(prof?.totalTaxProvision || 0).toLocaleString('fr-FR')} F`
                                                        )}
                                                    </td>
                                                )}

                                                {/* MARGE NETTE DOSSIER (PRÉVISIONNELLE & RÉELLE) */}
                                                {showProfitability && (
                                                    <td className="py-3 px-3 text-right font-mono font-black bg-emerald-500/5">
                                                        {isRowInfacturable ? (
                                                            <span className="text-zinc-600">0 F</span>
                                                        ) : (
                                                            <div>
                                                                <span className={(prof?.netMargin || 0) >= 0 ? 'text-emerald-300' : 'text-rose-400'}>
                                                                    {(prof?.netMargin || 0).toLocaleString('fr-FR')} F
                                                                </span>
                                                                <span className={`block text-[10px] font-bold ${(prof?.realNetMargin || 0) >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                                                                    Réel: {(prof?.realNetMargin || 0).toLocaleString('fr-FR')} F
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}

                                                {/* ACOMPTE PERÇU */}
                                                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-300">
                                                    {isRowInfacturable ? (
                                                        <span className="text-zinc-600">0 F</span>
                                                    ) : (
                                                        `${fin.advanceReceived.toLocaleString('fr-FR')} F`
                                                    )}
                                                </td>

                                                {/* SOLDE RESTANT DÛ */}
                                                <td className="py-3 px-3 text-right font-mono font-black">
                                                    {isRowInfacturable ? (
                                                        <span className="text-zinc-600">0 F</span>
                                                    ) : fin.balanceDue > 0 ? (
                                                        <span className="text-amber-400">
                                                            {fin.balanceDue.toLocaleString('fr-FR')} F
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-400 font-bold text-[10px]">Soldé</span>
                                                    )}
                                                </td>

                                                {/* Action Détail */}
                                                <td className="py-3 px-3 text-center">
                                                    {onSelectTicket && (
                                                        <button
                                                            onClick={() => onSelectTicket(ticket)}
                                                            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                                                            title="Consulter le dossier"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* SOUS-TABLEAU DÉTAIL PAR LIGNE */}
                                            {isExpanded && !isRowInfacturable && prof && prof.lines.length > 0 && (
                                                <tr className="bg-black/60">
                                                    <td colSpan={13} className="px-6 py-3 border-b border-white/10">
                                                        <div className="rounded-2xl border border-white/10 bg-[#080a10] p-3 space-y-2">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase text-zinc-400">
                                                                <span>Détail par ligne — Dossier #{ticket.id}</span>
                                                                <span className="font-mono text-emerald-400">
                                                                    Prév. : {prof.netMargin.toLocaleString('fr-FR')} F ({prof.marginRate.toFixed(1)}%) &bull; Réelle : <span className="text-teal-300">{prof.realNetMargin.toLocaleString('fr-FR')} F ({prof.realMarginRate.toFixed(1)}%)</span>
                                                                </span>
                                                            </div>
                                                            <table className="w-full text-left border-collapse text-[11px]">
                                                                <thead>
                                                                    <tr className="border-b border-white/10 text-[9px] uppercase text-zinc-500">
                                                                        <th className="py-1.5 px-2">Ligne / Prestation</th>
                                                                        <th className="py-1.5 px-2">Activité</th>
                                                                        <th className="py-1.5 px-2">Origine Pièce</th>
                                                                        <th className="py-1.5 px-2 text-center">Qté</th>
                                                                        <th className="py-1.5 px-2 text-right">CA Facturé</th>
                                                                        <th className="py-1.5 px-2 text-right">Coût 1x</th>
                                                                        <th className="py-1.5 px-2 text-right">Prov. Fisc.</th>
                                                                        <th className="py-1.5 px-2 text-right">Marge Prév.</th>
                                                                        <th className="py-1.5 px-2 text-right">Marge Réelle</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-white/5">
                                                                    {prof.lines.map(line => (
                                                                        <tr key={line.id}>
                                                                            <td className="py-1.5 px-2 font-bold text-white uppercase">{line.designation}</td>
                                                                            <td className="py-1.5 px-2">
                                                                                <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase border ${
                                                                                    line.activite === 'vente_macbook'
                                                                                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                                                                        : line.activite === 'vente_pieces'
                                                                                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                                                            : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                                                                }`}>
                                                                                    {ACTIVITY_LABELS[line.activite]}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-1.5 px-2">
                                                                                {line.sourcePiece ? (
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase border ${
                                                                                        line.sourcePiece === 'en_stock'
                                                                                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                                                            : line.sourcePiece === 'a_commander'
                                                                                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                                                                : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                                                                    }`}>
                                                                                        {PART_SOURCE_SHORT_LABELS[line.sourcePiece]}{line.isPlannedOrderPending ? ' (Prévu)' : ''}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-[9px] text-zinc-500 uppercase">Main d&apos;œuvre</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-center font-mono text-zinc-300">{line.quantite}</td>
                                                                            <td className="py-1.5 px-2 text-right font-mono text-white">{line.ca.toLocaleString('fr-FR')} F</td>
                                                                            <td className="py-1.5 px-2 text-right font-mono text-amber-300">
                                                                                {line.partCost > 0 ? `-${line.partCost.toLocaleString('fr-FR')} F` : '0 F'}
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-right font-mono text-orange-300">
                                                                                {line.taxProvision > 0 ? `-${line.taxProvision.toLocaleString('fr-FR')} F` : '0 F'}
                                                                            </td>
                                                                            <td className={`py-1.5 px-2 text-right font-mono font-bold ${line.netMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                                {line.netMargin.toLocaleString('fr-FR')} F
                                                                            </td>
                                                                            <td className={`py-1.5 px-2 text-right font-mono font-black ${line.realNetMargin >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                                                                                {line.realNetMargin.toLocaleString('fr-FR')} F
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>

                        {/* LIGNE DE PIED DE TABLEAU : TOTAUX GÉNÉRAUX CUMULÉS */}
                        {filteredTickets.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-white/20 bg-black/60 font-black text-xs">
                                    <td colSpan={showProfitability ? 6 : 5} className="py-4 px-3 uppercase text-zinc-300 tracking-wider">
                                        TOTAUX DU POINT ({metrics.facturablesCount} facturables / {metrics.totalCount} fiches)
                                    </td>
                                    <td className="py-4 px-3 text-right font-mono text-sm text-blue-300 bg-blue-500/15 border-l border-r border-blue-500/20">
                                        {metrics.totalBilled.toLocaleString('fr-FR')} F
                                    </td>
                                    {showProfitability && (
                                        <td className="py-4 px-3 text-right font-mono text-amber-300">
                                            -{profitabilityReport.totalPartCost.toLocaleString('fr-FR')} F
                                        </td>
                                    )}
                                    {showProfitability && (
                                        <td className="py-4 px-3 text-right font-mono text-orange-300">
                                            -{profitabilityReport.totalTaxProvision.toLocaleString('fr-FR')} F
                                        </td>
                                    )}
                                    {showProfitability && (
                                        <td className="py-4 px-3 text-right font-mono text-sm text-emerald-300 bg-emerald-500/15 border-l border-r border-emerald-500/20">
                                            <div>{profitabilityReport.totalNetMarginBeforeFixed.toLocaleString('fr-FR')} F</div>
                                            <div className="text-[10px] text-teal-300">Réel: {profitabilityReport.totalRealNetMarginBeforeFixed.toLocaleString('fr-FR')} F</div>
                                        </td>
                                    )}
                                    <td className="py-4 px-3 text-right font-mono text-emerald-300">
                                        {metrics.totalAdvance.toLocaleString('fr-FR')} F
                                    </td>
                                    <td className="py-4 px-3 text-right font-mono text-amber-300">
                                        {metrics.totalBalanceDue.toLocaleString('fr-FR')} F
                                    </td>
                                    <td className="py-4 px-3 text-center text-[10px] text-zinc-400">
                                        {metrics.collectionRate}%
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* MODALE D'APERÇU D'IMPRESSION & PDF A4 */}
            {isPrintModalOpen && (
                <PreviewModal
                    isOpen={isPrintModalOpen}
                    onClose={() => setIsPrintModalOpen(false)}
                    fileName={`POINT_FINANCIER_${shortPeriodLabel.replace(/\s+/g, '_')}.pdf`}
                >
                    <PrintableTicketFinancialPoint
                        tickets={filteredTickets}
                        periodLabel={periodLabel}
                        startDateStr={startDate ? startDate.toLocaleDateString('fr-FR') : undefined}
                        endDateStr={endDate ? endDate.toLocaleDateString('fr-FR') : undefined}
                        subFilterLabel={paymentFilter !== 'all' ? paymentFilter : undefined}
                        profitability={showProfitability ? profitabilityReport : undefined}
                        treasury={showTreasury && treasurySnapshot ? treasurySnapshot : undefined}
                    />
                </PreviewModal>
            )}
        </div>
    );
};

export default TicketFinancialPointManager;
