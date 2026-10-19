import React, { useState, useRef } from 'react';
import { 
    Plus, 
    FileText, 
    Eye, 
    Trash2, 
    CheckCircle2, 
    Upload, 
    Download,
    X,
    Calendar,
    Wallet,
    Receipt,
    Coins
} from 'lucide-react';
import { PaymentEntry, PaymentMethod } from '../types';
import { compressImage, isPdfDataUrl } from '../utils/fileHelpers';

interface PaymentLedgerManagerProps {
    payments: PaymentEntry[];
    totalDue: number;
    onAddPayment: (payment: PaymentEntry) => void;
    onDeletePayment?: (id: string) => void;
    onUpdatePayment?: (payment: PaymentEntry) => void;
    readOnly?: boolean;
}

export const PaymentLedgerManager: React.FC<PaymentLedgerManagerProps> = ({
    payments = [],
    totalDue = 0,
    onAddPayment,
    onDeletePayment,
    onUpdatePayment,
    readOnly = false,
}) => {
    const [isAddOpen, setIsAddOpen] = useState(false);

    const [selectedProofModal, setSelectedProofModal] = useState<PaymentEntry | null>(null);
    const [uploadingForPaymentId, setUploadingForPaymentId] = useState<string | null>(null);

    // Formulaire d'ajout
    const [amount, setAmount] = useState<string>('');
    const [method, setMethod] = useState<PaymentMethod>('wave');
    const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [proofFile, setProofFile] = useState<{ url: string; name: string; type: 'image' | 'pdf' } | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const lateAttachFileInputRef = useRef<HTMLInputElement>(null);

    // Calculs financiers stricts
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remainingBalance = Math.max(0, totalDue - totalPaid);

    const getMethodDetails = (m: PaymentMethod) => {
        switch (m) {
            case 'wave':
                return { label: 'Wave', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', brandBg: 'from-sky-600 to-sky-700' };
            case 'orange_money':
                return { label: 'Orange Money', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', brandBg: 'from-orange-600 to-amber-700' };
            case 'mtn_momo':
                return { label: 'MTN Mobile Money', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', brandBg: 'from-yellow-600 to-amber-600' };
            case 'moov_money':
                return { label: 'Moov Money', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', brandBg: 'from-blue-600 to-indigo-700' };
            case 'especes':
                return { label: 'Espèces / Cash', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', brandBg: 'from-emerald-600 to-teal-700' };
            case 'virement':
                return { label: 'Virement bancaire', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', brandBg: 'from-purple-600 to-indigo-700' };
            case 'carte_bancaire':
                return { label: 'Carte Bancaire', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', brandBg: 'from-cyan-600 to-blue-700' };
            default:
                return { label: 'Autre moyen', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', brandBg: 'from-slate-600 to-slate-700' };
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingFile(true);
        try {
            const base64 = await compressImage(file);
            setProofFile({
                url: base64,
                name: file.name,
                type: file.type === 'application/pdf' ? 'pdf' : 'image'
            });
        } catch (err) {
            console.error("Erreur de compression:", err);
        } finally {
            setIsProcessingFile(false);
            e.target.value = '';
        }
    };

    const handleLateProofUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetPayment: PaymentEntry) => {
        const file = e.target.files?.[0];
        if (!file || !onUpdatePayment) return;

        try {
            const base64 = await compressImage(file);
            onUpdatePayment({
                ...targetPayment,
                proofUrl: base64,
                proofName: file.name,
                proofType: file.type === 'application/pdf' ? 'pdf' : 'image'
            });
        } catch (err) {
            console.error("Erreur lors de l'attachement ultérieur:", err);
        } finally {
            setUploadingForPaymentId(null);
            e.target.value = '';
        }
    };

    const handleSubmitPayment = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) return;

        const newPayment: PaymentEntry = {
            id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            amount: numAmount,
            date: date || new Date().toISOString().split('T')[0],
            method,
            reference: reference.trim() || undefined,
            proofUrl: proofFile?.url,
            proofName: proofFile?.name,
            proofType: proofFile?.type,
            notes: notes.trim() || undefined,
            createdAt: new Date().toISOString()
        };

        onAddPayment(newPayment);

        // Reset
        setAmount('');
        setReference('');
        setNotes('');
        setProofFile(null);
        setIsAddOpen(false);
    };

    return (
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 sm:p-6 space-y-5">
            {/* Header comptable */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-emerald-400" />
                        Justificatifs de Paiement
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Enregistrement Wave, Orange Money, Espèces et archivage des preuves de transaction
                    </p>
                </div>

                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => setIsAddOpen(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Enregistrer un paiement</span>
                    </button>
                )}
            </div>

            {/* SYNTHÈSE COMPTABLE (3 COMPTEURS OFFICIELS) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Facturé */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Total Facturé / Dû
                    </span>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1 tabular-nums">
                        {totalDue.toLocaleString('fr-FR')} <span className="text-xs font-sans text-slate-400">FCFA</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">Diagnostic + Devis travaux</span>
                </div>

                {/* Total Réglé */}
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Total Encaissé
                    </span>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                        {totalPaid.toLocaleString('fr-FR')} <span className="text-xs font-sans text-emerald-500/80">FCFA</span>
                    </div>
                    <span className="text-[10px] text-emerald-300/70 mt-1">
                        {payments.length} règlement(s) enregistré(s)
                    </span>
                </div>

                {/* Solde restant dû */}
                <div className={`border rounded-xl p-3.5 flex flex-col justify-between ${
                    remainingBalance === 0 && totalDue > 0
                        ? 'bg-emerald-900/10 border-emerald-500/40'
                        : remainingBalance > 0 && totalPaid > 0
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-rose-950/20 border-rose-500/40'
                }`}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
                        <span className={
                            remainingBalance === 0 ? 'text-emerald-400' : remainingBalance > 0 && totalPaid > 0 ? 'text-amber-400' : 'text-rose-400'
                        }>
                            Solde Restant Dû
                        </span>
                        {remainingBalance === 0 && totalDue > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                                Intégralement Payé
                            </span>
                        ) : remainingBalance > 0 && totalPaid > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                                Paiement Partiel
                            </span>
                        ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold">
                                Non Réglé
                            </span>
                        )}
                    </span>
                    <div className={`text-xl sm:text-2xl font-bold font-mono mt-1 tabular-nums ${
                        remainingBalance === 0 ? 'text-emerald-300' : remainingBalance > 0 && totalPaid > 0 ? 'text-amber-300' : 'text-rose-300'
                    }`}>
                        {remainingBalance.toLocaleString('fr-FR')} <span className="text-xs font-sans opacity-75">FCFA</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                        {remainingBalance === 0 ? 'Aucun reliquat' : 'Montant à percevoir à la restitution'}
                    </span>
                </div>
            </div>

            {/* FORMULAIRE D'AJOUT DE PAIEMENT (ACCORDÉON / MODALE) */}
            {isAddOpen && !readOnly && (
                <form 
                    onSubmit={handleSubmitPayment}
                    className="bg-slate-800/80 border border-emerald-500/40 rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200"
                >
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-emerald-400" />
                            Enregistrement d'un règlement
                        </h4>
                        <button
                            type="button"
                            onClick={() => setIsAddOpen(false)}
                            className="text-slate-400 hover:text-white p-1 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Montant */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Montant versé (FCFA) *
                            </label>
                            <input
                                type="number"
                                required
                                min="1"
                                placeholder="ex: 25000"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        {/* Moyen de paiement */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Moyen de paiement *
                            </label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                <option value="wave">Wave (Mobile Money)</option>
                                <option value="orange_money">Orange Money</option>
                                <option value="mtn_momo">MTN Mobile Money</option>
                                <option value="moov_money">Moov Money</option>
                                <option value="especes">Espèces / Cash comptoir</option>
                                <option value="virement">Virement bancaire</option>
                                <option value="carte_bancaire">Carte bancaire</option>
                                <option value="cheque">Chèque</option>
                                <option value="autre">Autre moyen</option>
                            </select>
                        </div>

                        {/* Date du paiement */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Date du versement *
                            </label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        {/* Référence de transaction */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Réf. transaction (Wave Tx, OM ID...)
                            </label>
                            <input
                                type="text"
                                placeholder="ex: TX-984210"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        {/* Justificatif électronique */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                                <span>Reçu / Justificatif {method === 'especes' ? '(Facultatif en espèces)' : '(Recommandé pour paiement électronique)'}</span>
                                {proofFile && (
                                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Fichier prêt
                                    </span>
                                )}
                            </label>

                            {proofFile ? (
                                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                                    <div className="flex items-center gap-2 truncate">
                                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span className="text-white truncate">{proofFile.name}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setProofFile(null)}
                                        className="text-red-400 hover:text-red-300 p-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isProcessingFile}
                                    className="w-full py-2.5 px-3 border border-dashed border-slate-700 hover:border-emerald-500 rounded-lg flex items-center justify-center gap-2 text-xs text-slate-300 hover:text-emerald-400 bg-slate-900/50 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>{isProcessingFile ? 'Traitement...' : 'Joindre reçu JPG, PNG ou document PDF'}</span>
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>
                    </div>

                    {/* Note sur le paiement */}
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            Note comptable (facultatif)
                        </label>
                        <input
                            type="text"
                            placeholder="ex: Acompte 50% versé à la signature du devis"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
                        <button
                            type="button"
                            onClick={() => setIsAddOpen(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
                        >
                            Confirmer l'encaissement
                        </button>
                    </div>
                </form>
            )}

            {/* LISTE DES PAIEMENTS ENREGISTRÉS */}
            <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Historique des règlements ({payments.length})
                </div>

                {payments.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
                        <Coins className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Aucun règlement enregistré pour cette intervention.</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Cliquez sur « Enregistrer un paiement » pour ajouter un acompte Wave, OM ou espèces.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                        {payments.map((p) => {
                            const methodInfo = getMethodDetails(p.method);
                            return (
                                <div key={p.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className={`px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0 ${methodInfo.color}`}>
                                            {methodInfo.label}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-sm text-white tabular-nums">
                                                    {Number(p.amount).toLocaleString('fr-FR')} FCFA
                                                </span>
                                                {p.reference && (
                                                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                                        Réf: {p.reference}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                                <span>Date : {p.date}</span>
                                                {p.notes && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-slate-300 italic">{p.notes}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preuve & Actions */}
                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        {p.proofUrl ? (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedProofModal(p)}
                                                className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-xs flex items-center gap-1.5 transition-colors"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>Voir reçu ({p.proofType === 'pdf' ? 'PDF' : 'Image'})</span>
                                            </button>
                                        ) : !readOnly && onUpdatePayment ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setUploadingForPaymentId(p.id);
                                                    lateAttachFileInputRef.current?.click();
                                                }}
                                                className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
                                            >
                                                <Upload className="w-3 h-3" />
                                                <span>Ajouter reçu</span>
                                            </button>
                                        ) : (
                                            <span className="text-[11px] text-slate-500 italic">Sans reçu joint</span>
                                        )}

                                        {!readOnly && onDeletePayment && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (confirm("Supprimer ce règlement ?")) {
                                                        onDeletePayment(p.id);
                                                    }
                                                }}
                                                className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                                                title="Supprimer le règlement"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Input caché pour attachement ultérieur */}
            <input
                ref={lateAttachFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                    const targetPayment = payments.find(p => p.id === uploadingForPaymentId);
                    if (targetPayment) {
                        handleLateProofUpload(e, targetPayment);
                    }
                }}
            />

            {/* MODAL APERÇU GRAND FORMAT DU JUSTIFICATIF */}
            {selectedProofModal && selectedProofModal.proofUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
                    <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <div>
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-emerald-400" />
                                    Justificatif de règlement — {Number(selectedProofModal.amount).toLocaleString('fr-FR')} FCFA ({getMethodDetails(selectedProofModal.method).label})
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Réf: {selectedProofModal.reference || 'Non spécifiée'} • Date: {selectedProofModal.date}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={selectedProofModal.proofUrl}
                                    download={selectedProofModal.proofName || `recu_paiement_${selectedProofModal.id}`}
                                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                                    title="Télécharger"
                                >
                                    <Download className="w-4 h-4" />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setSelectedProofModal(null)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 overflow-auto flex items-center justify-center flex-1 bg-black/40">
                            {selectedProofModal.proofType === 'pdf' || isPdfDataUrl(selectedProofModal.proofUrl) ? (
                                <iframe 
                                    src={selectedProofModal.proofUrl}
                                    className="w-full h-[70vh] border-0 rounded-lg"
                                    title="Justificatif PDF"
                                />
                            ) : (
                                <img
                                    src={selectedProofModal.proofUrl}
                                    alt="Reçu de paiement"
                                    className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
