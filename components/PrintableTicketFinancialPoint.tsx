import React from 'react';
import { RepairTicket } from '../types.ts';
import { AppleLogo } from './icons.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { getTicketFinancialSummary } from '../utils/ticketHelpers.ts';

interface PrintableTicketFinancialPointProps {
    tickets: RepairTicket[];
    periodLabel: string;
    startDateStr?: string;
    endDateStr?: string;
    subFilterLabel?: string;
}

export const PrintableTicketFinancialPoint: React.FC<PrintableTicketFinancialPointProps> = ({
    tickets,
    periodLabel,
    startDateStr,
    endDateStr,
    subFilterLabel
}) => {
    const { settings } = useAppSettings();
    const shop = settings?.workshop || {
        name: 'TGS - CÔTE D\'IVOIRE',
        phone: '+225 07 57 13 35 07',
        address: 'Cocody Faya, Carrefour Coq Ivoir, Abidjan',
        email: 'contact@tgs-ci.com',
        currency: 'F CFA'
    };

    // Calculs financiers globaux stricts selon la règle comptable TGS-CI
    const metrics = React.useMemo(() => {
        let totalBilled = 0;
        let totalAdvance = 0;
        let totalBalanceDue = 0;
        let facturablesCount = 0;
        let infacturablesCount = 0;
        let paidCount = 0;
        let withBalanceCount = 0;

        tickets.forEach(ticket => {
            const fin = getTicketFinancialSummary(ticket);
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
            totalCount: tickets.length
        };
    }, [tickets]);

    const currentDateStr = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const currentHourStr = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div 
            className="printable-point-document bg-white text-black p-6 font-sans text-[9pt] leading-normal"
            style={{ width: '100%', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}
        >
            {/* EN-TÊTE OFFICIEL TGS-CI */}
            <header className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <AppleLogo style={{ width: '22px', height: '22px', color: '#000' }} />
                        <h1 className="text-xl font-black tracking-tight uppercase m-0 leading-none">
                            {shop.name}
                        </h1>
                    </div>
                    <p className="text-[7.5pt] font-extrabold uppercase text-gray-600 m-0 tracking-wider">
                        Atelier Spécialisé MacBook &amp; Micro-Électronique Haute Précision
                    </p>
                    <p className="text-[7pt] text-gray-700 mt-1 m-0">
                        {shop.address} &bull; Tél: <strong>{shop.phone}</strong> &bull; {shop.email}
                    </p>
                </div>
                <div className="text-right">
                    <div className="inline-block bg-black text-white px-3 py-1 rounded text-[8.5pt] font-black uppercase tracking-wider mb-1">
                        POINT FINANCIER D'ATELIER
                    </div>
                    <p className="text-[8pt] font-bold text-gray-800 m-0">
                        Édité le {currentDateStr} à {currentHourStr}
                    </p>
                    <p className="text-[7pt] text-gray-500 m-0 font-mono">
                        Réf: PNT-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-{tickets.length}F
                    </p>
                </div>
            </header>

            {/* BANNIÈRE DE LA PÉRIODE SÉLECTIONNÉE */}
            <section className="bg-gray-100 border border-gray-400 rounded-lg p-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <span className="text-[7pt] font-black uppercase text-gray-500 tracking-widest block">
                        PÉRIODE DU POINT FINANCIER
                    </span>
                    <h2 className="text-sm font-black text-black uppercase tracking-tight m-0">
                        {periodLabel}
                    </h2>
                    {(startDateStr || endDateStr) && (
                        <p className="text-[7.5pt] text-gray-700 font-mono font-bold mt-0.5 m-0">
                            Plage exacte : Du {startDateStr || 'Origine'} au {endDateStr || "Aujourd'hui"}
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <span className="text-[7pt] font-black uppercase text-gray-500 tracking-widest block">
                        VOLUME ANALYSÉ
                    </span>
                    <p className="text-xs font-black text-black m-0">
                        {metrics.totalCount} dossier(s) &bull; {metrics.facturablesCount} facturable(s)
                    </p>
                    {subFilterLabel && (
                        <span className="inline-block px-1.5 py-0.5 bg-gray-200 border border-gray-300 rounded text-[6.5pt] font-bold uppercase mt-0.5">
                            Filtre : {subFilterLabel}
                        </span>
                    )}
                </div>
            </section>

            {/* SYNTHÈSE DES TOTAUX (4 CARTES COMPTABLES) */}
            <section className="grid grid-cols-4 gap-2 mb-4">
                <div className="border border-black rounded p-2 text-center bg-gray-50">
                    <span className="text-[6.5pt] font-black text-gray-600 uppercase tracking-wider block">
                        TOTAL MONTANTS FACTURÉS
                    </span>
                    <span className="text-sm font-black font-mono block mt-0.5">
                        {metrics.totalBilled.toLocaleString('fr-FR')} {shop.currency}
                    </span>
                    <span className="text-[6pt] text-gray-500 block">
                        {metrics.facturablesCount} fiches facturables
                    </span>
                </div>

                <div className="border border-emerald-700 bg-emerald-50 rounded p-2 text-center">
                    <span className="text-[6.5pt] font-black text-emerald-800 uppercase tracking-wider block">
                        ACOMPTES PERÇUS (CAISSE)
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-800 block mt-0.5">
                        {metrics.totalAdvance.toLocaleString('fr-FR')} {shop.currency}
                    </span>
                    <span className="text-[6pt] text-emerald-700 font-bold block">
                        Taux d'encaissement : {metrics.collectionRate}%
                    </span>
                </div>

                <div className="border border-amber-700 bg-amber-50 rounded p-2 text-center">
                    <span className="text-[6.5pt] font-black text-amber-800 uppercase tracking-wider block">
                        RESTANT DÛ (CRÉANCES)
                    </span>
                    <span className="text-sm font-black font-mono text-amber-900 block mt-0.5">
                        {metrics.totalBalanceDue.toLocaleString('fr-FR')} {shop.currency}
                    </span>
                    <span className="text-[6pt] text-amber-700 font-bold block">
                        {metrics.withBalanceCount} fiche(s) en attente solde
                    </span>
                </div>

                <div className="border border-gray-400 bg-gray-50 rounded p-2 text-center">
                    <span className="text-[6.5pt] font-black text-gray-600 uppercase tracking-wider block">
                        FICHES INFACTURABLES
                    </span>
                    <span className="text-sm font-black font-mono text-gray-700 block mt-0.5">
                        {metrics.infacturablesCount} annulée(s)
                    </span>
                    <span className="text-[6pt] text-rose-700 font-bold block">
                        0 F comptabilisé au point
                    </span>
                </div>
            </section>

            {/* RAPPEL DE LA RÈGLE COMPTABLE SI FICHES ANNULÉES */}
            {metrics.infacturablesCount > 0 && (
                <div className="bg-rose-50 border border-rose-300 rounded p-2 mb-3 text-[7pt] text-rose-900 flex items-center justify-between">
                    <div>
                        <strong>RÈGLE COMPTABLE ATELIER TGS-CI :</strong> {metrics.infacturablesCount} fiche(s) annulée(s) figure(nt) dans cette période. Elles sont déclarées <strong>INFACTURABLES</strong> : aucune avance historique ni solde n'est intégré dans les totaux du point.
                    </div>
                    <span className="font-mono font-bold text-rose-700 shrink-0 ml-2">
                        0 F CFA AU POINT
                    </span>
                </div>
            )}

            {/* TABLEAU DÉTAILLÉ DE CHAQUE FICHE */}
            <section className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-[8pt] font-black uppercase tracking-wider m-0">
                        DÉTAIL LIGNE PAR LIGNE SUR CHAQUE FICHE ({tickets.length})
                    </h3>
                    <span className="text-[7pt] text-gray-500 font-bold">
                        Montants exprimés en Francs CFA
                    </span>
                </div>

                <table className="w-full border-collapse text-[7pt]">
                    <thead>
                        <tr className="bg-black text-white">
                            <th className="p-1.5 text-left border border-black font-black">N° FICHE</th>
                            <th className="p-1.5 text-left border border-black font-black">DATE</th>
                            <th className="p-1.5 text-left border border-black font-black">CLIENT &amp; CONTACT</th>
                            <th className="p-1.5 text-left border border-black font-black">MODÈLE MAC</th>
                            <th className="p-1.5 text-left border border-black font-black">STATUT</th>
                            <th className="p-1.5 text-right border border-black font-black">DIAG (F)</th>
                            <th className="p-1.5 text-right border border-black font-black">RÉPAR. (F)</th>
                            <th className="p-1.5 text-right border border-black font-black">TOTAL FACTURÉ</th>
                            <th className="p-1.5 text-right border border-black font-black">ACOMPTE (F)</th>
                            <th className="p-1.5 text-right border border-black font-black">SOLDE DÛ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-6 text-center text-gray-500 border italic">
                                    Aucune fiche de réparation enregistrée pour la période sélectionnée ({periodLabel}).
                                </td>
                            </tr>
                        ) : (
                            tickets.map((t, idx) => {
                                const fin = getTicketFinancialSummary(t);
                                const dateFormatted = t.createdAt
                                    ? new Date(t.createdAt).toLocaleDateString('fr-FR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric'
                                      })
                                    : 'N/A';
                                const rowBg = fin.isInfacturable
                                    ? 'bg-rose-50 text-gray-600'
                                    : idx % 2 === 0
                                    ? 'bg-white'
                                    : 'bg-gray-50';

                                return (
                                    <tr key={t.id} className={`${rowBg} border-b border-gray-300`}>
                                        <td className="p-1 border border-gray-300 font-mono font-black">
                                            #{t.id}
                                        </td>
                                        <td className="p-1 border border-gray-300 font-mono">
                                            {dateFormatted}
                                        </td>
                                        <td className="p-1 border border-gray-300 font-bold uppercase truncate max-w-[120px]">
                                            {t.client?.name || 'Client'}
                                            {t.client?.phone && (
                                                <span className="block text-[6pt] text-gray-500 font-normal font-mono">
                                                    {t.client.phone}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-1 border border-gray-300 truncate max-w-[100px]">
                                            {t.macModel || 'MacBook'}
                                        </td>
                                        <td className="p-1 border border-gray-300 uppercase font-black text-[6.5pt]">
                                            {fin.isInfacturable ? (
                                                <span className="text-rose-700 font-bold">ANNULÉ (INFACT.)</span>
                                            ) : (
                                                <span>{t.status}</span>
                                            )}
                                        </td>
                                        <td className="p-1 border border-gray-300 text-right font-mono">
                                            {fin.isInfacturable ? '0' : fin.diagnosticCost.toLocaleString('fr-FR')}
                                        </td>
                                        <td className="p-1 border border-gray-300 text-right font-mono">
                                            {fin.isInfacturable ? '0' : fin.repairCost.toLocaleString('fr-FR')}
                                        </td>
                                        <td className="p-1 border border-gray-300 text-right font-mono font-black">
                                            {fin.isInfacturable ? (
                                                <span className="text-rose-700">0 (INFACT.)</span>
                                            ) : (
                                                `${fin.totalBilled.toLocaleString('fr-FR')} F`
                                            )}
                                        </td>
                                        <td className="p-1 border border-gray-300 text-right font-mono font-bold text-emerald-800">
                                            {fin.isInfacturable ? (
                                                <span className="text-gray-400">0 F</span>
                                            ) : (
                                                `${fin.advanceReceived.toLocaleString('fr-FR')} F`
                                            )}
                                        </td>
                                        <td className="p-1 border border-gray-300 text-right font-mono font-bold">
                                            {fin.isInfacturable ? (
                                                <span className="text-gray-400">0 F</span>
                                            ) : fin.balanceDue > 0 ? (
                                                <span className="text-amber-800 font-black">
                                                    {fin.balanceDue.toLocaleString('fr-FR')} F
                                                </span>
                                            ) : (
                                                <span className="text-emerald-700">Soldé</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                    {tickets.length > 0 && (
                        <tfoot>
                            <tr className="bg-gray-200 text-black font-black border-t-2 border-b-2 border-black">
                                <td colSpan={5} className="p-1.5 border border-black uppercase text-left text-[7.5pt]">
                                    TOTAL GÉNÉRAL DU POINT ({metrics.facturablesCount} fiches facturables)
                                </td>
                                <td className="p-1.5 border border-black text-right font-mono text-[7pt]">
                                    {tickets.reduce((sum, t) => sum + (getTicketFinancialSummary(t).isInfacturable ? 0 : getTicketFinancialSummary(t).diagnosticCost), 0).toLocaleString('fr-FR')}
                                </td>
                                <td className="p-1.5 border border-black text-right font-mono text-[7pt]">
                                    {tickets.reduce((sum, t) => sum + (getTicketFinancialSummary(t).isInfacturable ? 0 : getTicketFinancialSummary(t).repairCost), 0).toLocaleString('fr-FR')}
                                </td>
                                <td className="p-1.5 border border-black text-right font-mono text-[8pt] text-black bg-gray-300">
                                    {metrics.totalBilled.toLocaleString('fr-FR')} F
                                </td>
                                <td className="p-1.5 border border-black text-right font-mono text-[8pt] text-emerald-900 bg-emerald-100">
                                    {metrics.totalAdvance.toLocaleString('fr-FR')} F
                                </td>
                                <td className="p-1.5 border border-black text-right font-mono text-[8pt] text-amber-900 bg-amber-100">
                                    {metrics.totalBalanceDue.toLocaleString('fr-FR')} F
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </section>

            {/* CADRE D'ÉMARGEMENT ET VISAS COMPTABLES */}
            <footer className="mt-6 pt-3 border-t border-gray-400 text-[7pt]">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="border border-gray-300 rounded p-2">
                        <span className="font-black uppercase text-gray-700 block mb-8">
                            Visa Caissier(ère) / Réception
                        </span>
                        <div className="border-t border-dashed border-gray-400 pt-1 text-[6.5pt] text-gray-500">
                            Date &amp; Signature
                        </div>
                    </div>
                    <div className="border border-gray-300 rounded p-2">
                        <span className="font-black uppercase text-gray-700 block mb-8">
                            Visa Responsable d'Atelier
                        </span>
                        <div className="border-t border-dashed border-gray-400 pt-1 text-[6.5pt] text-gray-500">
                            Date &amp; Signature
                        </div>
                    </div>
                    <div className="border border-gray-300 rounded p-2">
                        <span className="font-black uppercase text-gray-700 block mb-8">
                            Cachet Comptable TGS-CI
                        </span>
                        <div className="border-t border-dashed border-gray-400 pt-1 text-[6.5pt] text-gray-500">
                            Certifié conforme au registre
                        </div>
                    </div>
                </div>

                <div className="mt-4 text-center text-[6.5pt] text-gray-500 font-bold uppercase tracking-wider">
                    {shop.name} &bull; Document officiel d'extraction comptable &bull; Généré selon les règles de gestion atelier
                </div>
            </footer>
        </div>
    );
};

export default PrintableTicketFinancialPoint;
