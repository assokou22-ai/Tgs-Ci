
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RepairTicket, RepairStatus, RepairServiceItem } from '../types.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { MacbookIcon, BuildingStorefrontIcon, BanknotesIcon, PlusIcon, SparklesIcon, TrashIcon, DocumentArrowDownIcon, CameraIcon, PhotoIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import PrintableEnterpriseBon from './PrintableEnterpriseBon.tsx';
import SignaturePad from './SignaturePad.tsx';
import { playTone } from '../utils/audio.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { generateNextTicketSequence, isFallbackTicketId } from '../utils/idGenerator.ts';
import { compressImageBase64 } from '../utils/imageCompression.ts';
import { findMacByModel } from '../utils/macModelsData.ts';
import { 
  findMatchingRecurrentClients, 
  checkIsSameMac, 
  ClientRecurrenceProfile 
} from '../utils/clientRecurrenceHelper.ts';
import { ReceptionModeField } from './ReceptionModeField.tsx';
import { useDeviceProfile } from '../context/DeviceProfileContext.tsx';


interface EnterpriseRepairFormProps {
  tickets: RepairTicket[];
  ticketToEdit?: RepairTicket | null;
  onSave: (ticket: Partial<RepairTicket>, action: 'new' | 'close' | 'print', oldId?: string) => Promise<RepairTicket | void>;
  onCancel: () => void;
}

const EnterpriseRepairForm: React.FC<EnterpriseRepairFormProps> = ({ tickets, ticketToEdit, onSave, onCancel }) => {
  const { showToast } = useToastContext();
  const { isTouch } = useDeviceProfile();
  const isEditMode = !!ticketToEdit;
  
  const [ticket, setTicket] = useState<Partial<RepairTicket>>(() => ({
    status: RepairStatus.A_DIAGNOSTIQUER,
    macBrand: 'APPLE',
    macModel: '',
    macColor: '',
    problemDescription: '',
    powersOn: false,
    powerOnStatus: 'non',
    chargerIncluded: false,
    bagIncluded: false,
    bagDescription: '',
    services: ticketToEdit?.services ? [...ticketToEdit.services] : [],
    history: ticketToEdit?.history ? [...ticketToEdit.history] : [],
    attachments: ticketToEdit?.attachments ? [...ticketToEdit.attachments] : [],
    isReIntervention: false,
    ...(ticketToEdit || {}),
    client: {
      name: '',
      phone: '',
      email: '',
      isEnterprise: true,
      customFields: {},
      ...(ticketToEdit?.client || {})
    },
    costs: {
      diagnostic: 5000,
      repair: 0,
      advance: 0,
      ...(ticketToEdit?.costs || {})
    },
    customFields: {
      exitBonRef: '',
      deposantName: '',
      deposantFunction: '',
      bonEmissionDate: new Date().toISOString().split('T')[0],
      powerOnDetails: '',
      constatsParticuliers: '',
      diagnostic: '',
      chargerWatts: '',
      hasCable: 'non',
      diagAccepted: 'false',
      devisAccepted: 'false',
      luEtApprouve: '',
      machineBrand: 'Apple',
      modelA: '',
      rccm: '',
      compteContribuable: '',
      poRef: '',
      screenBroken: 'non',
      traceChoc: 'non',
      traceLiquid: 'non',
      keyboardDamaged: 'non',
      missingScrews: 'non',
      foundScrewsCount: '',
      ...(ticketToEdit?.customFields || {})
    }
  }));

  const lastUpdatedAtRef = useRef<string | undefined>(ticketToEdit?.updatedAt);

  useEffect(() => {
    if (ticketToEdit && ticketToEdit.id === ticket.id) {
      if (ticketToEdit.updatedAt !== lastUpdatedAtRef.current) {
        lastUpdatedAtRef.current = ticketToEdit.updatedAt;
        setTicket(prev => {
          const merged = mergeUpdates('ticket', prev as RepairTicket, ticketToEdit);
          return merged;
        });
        showToast("Mise à jour simultanée : Les modifications apportées par un autre technicien ont été intégrées en temps réel.", "info");
      }
    }
  }, [ticketToEdit, ticket.id, showToast]);

  const [quickServiceName, setQuickServiceName] = useState('');
  const [quickServicePrice, setQuickServicePrice] = useState('');
  const [fullTicketId, setFullTicketId] = useState<string>(() => {
    if (ticketToEdit?.id) return ticketToEdit.id;
    return generateNextTicketSequence(tickets, true);
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  // Clients récurrents & identification machine (Règle utilisateur: ≥ 2 fiches pour suggestion, comparaison même Mac / nouveau Mac)
  const [selectedRecurrentClient, setSelectedRecurrentClient] = useState<ClientRecurrenceProfile | null>(null);
  const [dismissedRecurrentPrompt, setDismissedRecurrentPrompt] = useState(false);

  // Initialisation du client récurrent si ticket en édition ou déjà connu
  useEffect(() => {
    if (ticketToEdit?.client?.name && tickets && tickets.length > 0) {
      const matches = findMatchingRecurrentClients(ticketToEdit.client.name, tickets);
      if (matches.length > 0) {
        setSelectedRecurrentClient(matches[0]);
      }
    }
  }, [ticketToEdit, tickets]);

  // Détection des clients récurrents (≥ 2 fiches)
  const matchingRecurrentClients = useMemo(() => {
    if (dismissedRecurrentPrompt) return [];
    const nameQuery = ticket.client?.name || '';
    const phoneQuery = ticket.client?.phone || '';
    const activeQuery = nameQuery.trim().length >= 2 ? nameQuery : (phoneQuery.trim().length >= 4 ? phoneQuery : '');
    if (!activeQuery) return [];

    const matches = findMatchingRecurrentClients(activeQuery, tickets || []);
    if (selectedRecurrentClient && matches.some(m => m.normalizedName === selectedRecurrentClient.normalizedName && ticket.client?.name === m.clientName)) {
      return [];
    }
    return matches;
  }, [ticket.client?.name, ticket.client?.phone, tickets, dismissedRecurrentPrompt, selectedRecurrentClient]);

  const handleSelectRecurrentClient = (match: ClientRecurrenceProfile) => {
    const isSub = match.isSubcontractor;
    setTicket(prev => ({
      ...prev,
      client: {
        ...prev.client!,
        name: match.clientName,
        phone: match.phone,
        smsPhone: match.secondaryPhone || prev.client?.smsPhone || '',
        email: match.email || prev.client?.email || '',
        clientType: isSub ? 'subcontractor' : (prev.client?.clientType || 'direct'),
        technicianName: isSub ? match.clientName : prev.client?.technicianName,
        technicianPhone: isSub ? match.phone : prev.client?.technicianPhone,
      },
      costs: {
        ...prev.costs!,
        diagnostic: isSub ? 0 : (prev.costs?.diagnostic ?? 5000)
      }
    }));
    setSelectedRecurrentClient(match);
    playTone(880, 150);
    showToast(`Coordonnées de ${match.clientName} reportées (${match.ticketCount} dossiers archivés).`, "success");
  };

  const [sameMacHandlingMode, setSameMacHandlingMode] = useState<'distinct_new' | 'reintervention_same_id' | 'new_service_same_id'>('distinct_new');

  const sameMacCheck = useMemo(() => {
    if (!selectedRecurrentClient || selectedRecurrentClient.uniqueMacs.length === 0) {
      return { isSameMac: false };
    }
    return checkIsSameMac({
      serialNumber: ticket.serialNumber,
      modelNumber: ticket.modelNumber || ticket.customFields?.modelA,
      macModel: ticket.macModel
    }, selectedRecurrentClient.uniqueMacs);
  }, [selectedRecurrentClient, ticket.serialNumber, ticket.modelNumber, ticket.customFields?.modelA, ticket.macModel]);

  // Détection lorsque le NOM + le NUMÉRO DE SÉRIE du MacBook existent déjà
  const matchingExistingMac = useMemo(() => {
    const currentName = (ticket.client?.name || '').trim().toLowerCase();
    const currentPhone = (ticket.client?.phone || '').replace(/\s+/g, '');
    const currentSn = (ticket.serialNumber || '').trim().toUpperCase();

    if (!currentSn || currentSn.length < 5 || (ticketToEdit && ticketToEdit.id)) {
      return null;
    }

    const found = (tickets || []).find(t => {
      if (ticketToEdit && t.id === ticketToEdit.id) return false;
      const tSn = (t.serialNumber || '').trim().toUpperCase();
      if (!tSn || tSn !== currentSn) return false;

      const tName = (t.client?.name || '').trim().toLowerCase();
      const tPhone = (t.client?.phone || '').replace(/\s+/g, '');
      const nameMatches = currentName && (tName === currentName || tName.includes(currentName) || currentName.includes(tName));
      const phoneMatches = currentPhone && tPhone && currentPhone === tPhone;

      return nameMatches || phoneMatches;
    });

    if (found) {
      return {
        ticketId: found.id,
        serialNumber: found.serialNumber || currentSn,
        macModel: found.macModel,
        modelNumber: found.modelNumber,
        createdAt: found.createdAt,
        clientName: found.client?.name || ticket.client?.name
      };
    }

    if (sameMacCheck.isSameMac && sameMacCheck.matchedMac) {
      return {
        ticketId: sameMacCheck.matchedMac.lastTicketId,
        serialNumber: sameMacCheck.matchedMac.serialNumber || currentSn,
        macModel: sameMacCheck.matchedMac.macModel,
        modelNumber: sameMacCheck.matchedMac.modelNumber,
        createdAt: new Date().toISOString(),
        clientName: ticket.client?.name
      };
    }

    return null;
  }, [ticket.client?.name, ticket.client?.phone, ticket.serialNumber, tickets, ticketToEdit, sameMacCheck]);

  const handleSelectReinterventionSameId = (pastInfo: { ticketId: string; serialNumber: string; macModel?: string; modelNumber?: string }) => {
    setSameMacHandlingMode('reintervention_same_id');
    setFullTicketId(pastInfo.ticketId);
    setTicket(prev => ({
      ...prev,
      isReIntervention: true,
      macModel: pastInfo.macModel || prev.macModel,
      modelNumber: pastInfo.modelNumber || prev.modelNumber,
      serialNumber: pastInfo.serialNumber || prev.serialNumber,
      customFields: {
        ...(prev.customFields || {}),
        modelA: pastInfo.modelNumber || prev.customFields?.modelA,
        serialNumber: pastInfo.serialNumber || prev.customFields?.serialNumber,
        exitBonRef: `SAV-REINT-${pastInfo.ticketId}`
      }
    }));
    playTone(700, 120);
    showToast(`🔄 Dossier #${pastInfo.ticketId} conservé en Réintervention / SAV.`, "success");
  };

  const handleSelectNewServiceSameId = (pastInfo: { ticketId: string; serialNumber: string; macModel?: string; modelNumber?: string }) => {
    setSameMacHandlingMode('new_service_same_id');
    setFullTicketId(pastInfo.ticketId);
    setTicket(prev => ({
      ...prev,
      isReIntervention: false,
      macModel: pastInfo.macModel || prev.macModel,
      modelNumber: pastInfo.modelNumber || prev.modelNumber,
      serialNumber: pastInfo.serialNumber || prev.serialNumber,
      customFields: {
        ...(prev.customFields || {}),
        modelA: pastInfo.modelNumber || prev.customFields?.modelA,
        serialNumber: pastInfo.serialNumber || prev.customFields?.serialNumber,
        exitBonRef: `NOUV-PREST-${pastInfo.ticketId}`
      }
    }));
    playTone(750, 120);
    showToast(`🛠️ Dossier #${pastInfo.ticketId} conservé pour une Nouvelle Prestation.`, "success");
  };

  const handleSelectDistinctNewMac = () => {
    setSameMacHandlingMode('distinct_new');
    const targetYear = ticket.createdAt ? new Date(ticket.createdAt).getFullYear() : undefined;
    const nextDistinctSeq = generateNextTicketSequence(tickets, true, targetYear);
    setFullTicketId(nextDistinctSeq);
    setTicket(prev => ({
      ...prev,
      isReIntervention: false
    }));
    playTone(600, 80);
    showToast("✨ Nouveau Mac avec numéro distinct sélectionné (Prise en charge standard).", "info");
  };

  const handleSelectPastMacForReintervention = (pastMac: { serialNumber?: string; modelNumber?: string; macModel?: string; macColor?: string; lastTicketId: string }) => {
    handleSelectReinterventionSameId({
      ticketId: pastMac.lastTicketId,
      serialNumber: pastMac.serialNumber || '',
      macModel: pastMac.macModel,
      modelNumber: pastMac.modelNumber
    });
    if (pastMac.macColor) {
      setTicket(prev => ({ ...prev, macColor: pastMac.macColor }));
    }
  };

  const handleSetAsNewMac = () => {
    handleSelectDistinctNewMac();
  };
  const signaturePadRef = useRef<{ getSignature: () => string }>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleAddIntakeImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const currentImages = ticket.intakeImages || [];
    const remainingSlots = 6 - currentImages.length;
    if (remainingSlots <= 0) {
      showToast("Nombre maximal de 6 photos atteint pour ce dossier.", "warning");
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const newCompressed: string[] = [];

    for (const file of filesToProcess) {
      try {
        const rawBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const compressed = await compressImageBase64(rawBase64, 1024, 1024, 0.68);
        newCompressed.push(compressed);
      } catch (err) {
        console.error("Erreur lecture photo entreprise:", err);
      }
    }

    if (newCompressed.length === 0) return;

    const updated = [...currentImages, ...newCompressed].slice(0, 6);
    setTicket(prev => ({
      ...prev,
      intakeImages: updated
    }));

    showToast(`${newCompressed.length} photo(s) ajoutée(s) au dossier !`, "success");
    playTone(700, 100);

    // Détection automatique du couvre arrière peu importe l'ordre des photos
    autoDetectBackCoverAndDeviceInfo(updated);
  };

  const handleRemoveIntakeImage = (indexToRemove: number) => {
    setTicket(prev => {
      const nextImages = (prev.intakeImages || []).filter((_, i) => i !== indexToRemove);
      const isRemovingBackCover = prev.backCoverImageIndex === indexToRemove;
      return {
        ...prev,
        intakeImages: nextImages,
        backCoverImage: isRemovingBackCover ? undefined : prev.backCoverImage,
        backCoverImageIndex: isRemovingBackCover ? -1 : (
          typeof prev.backCoverImageIndex === 'number' && prev.backCoverImageIndex > indexToRemove
            ? prev.backCoverImageIndex - 1
            : prev.backCoverImageIndex
        )
      };
    });
  };

  const autoDetectBackCoverAndDeviceInfo = async (imagesToScan: string[], specificIndex?: number) => {
    if (!imagesToScan || imagesToScan.length === 0) return;
    setIsAnalyzingPhoto(true);
    try {
      const payload = specificIndex !== undefined && imagesToScan[specificIndex]
        ? { imageBase64: imagesToScan[specificIndex] }
        : { imagesBase64: imagesToScan };

      const res = await fetch('/api/gemini/extract-device-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        let detectedCount = 0;
        const updates: Partial<RepairTicket> = {};
        const updatedCustom = { ...(ticket.customFields || {}) };
        const messages: string[] = [];

        if (data.modelNumber && /^A\d{4}$/i.test(data.modelNumber.trim())) {
          const cleanModel = data.modelNumber.trim().toUpperCase();
          updates.modelNumber = cleanModel;
          updatedCustom.modelA = cleanModel;
          messages.push(`Modèle ${cleanModel}`);
          detectedCount++;
          
          const found = findMacByModel(cleanModel);
          if (found && !ticket.macModel) {
            updates.macModel = found.name;
          }
        }

        if (data.serialNumber && data.serialNumber.trim().length >= 8) {
          const cleanSerial = data.serialNumber.trim().toUpperCase();
          updates.serialNumber = cleanSerial;
          updatedCustom.serialNumber = cleanSerial;
          messages.push(`S/N: ${cleanSerial}`);
          detectedCount++;
        }

        if (data.emc && data.emc.trim().length > 0) {
          let cleanEmc = data.emc.trim().toUpperCase();
          if (!cleanEmc.startsWith('EMC') && /^\d{4}$/.test(cleanEmc)) {
            cleanEmc = `EMC ${cleanEmc}`;
          }
          updates.emc = cleanEmc;
          updatedCustom.emc = cleanEmc;
          messages.push(cleanEmc);
          detectedCount++;
        }

        if (data.color && (!ticket.macColor || ticket.macColor.trim() === '')) {
          updates.macColor = data.color.toUpperCase();
        }

        let targetIdx = -1;
        if (specificIndex !== undefined) {
          targetIdx = specificIndex;
        } else if (typeof data.backCoverIndex === 'number' && data.backCoverIndex >= 0 && data.backCoverIndex < imagesToScan.length) {
          targetIdx = data.backCoverIndex;
        } else if (data.isBackCoverDetected) {
          targetIdx = 0;
        }

        if (targetIdx >= 0 && imagesToScan[targetIdx]) {
          updates.backCoverImage = imagesToScan[targetIdx];
          updates.backCoverImageIndex = targetIdx;
        }

        if (detectedCount > 0 || updates.backCoverImage) {
          setTicket(prev => ({ 
            ...prev, 
            ...updates, 
            customFields: { ...(prev.customFields || {}), ...updatedCustom } 
          }));
          const coverNote = targetIdx >= 0 ? ` [Photo #${targetIdx + 1} identifiée comme Couvre Arrière]` : '';
          showToast(`✨ Couvre arrière détecté : ${messages.join(' | ')}${coverNote}`, "success");
          playTone(880, 180);
        } else {
          if (specificIndex !== undefined) {
            showToast("Aucun numéro de modèle, série ou EMC lisible sur cette photo.", "info");
          }
        }
      }
    } catch (err) {
      console.warn("Échec requête OCR IA:", err);
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const getPreviewTicket = (): RepairTicket => {
    const signature = signaturePadRef.current?.getSignature() || ticket.clientSignature;
    const servicesSum = ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0;
    const currentId = (fullTicketId && fullTicketId.trim()) || ticketToEdit?.id || 'NOUVEAU';
    
    return {
      ...ticket,
      id: currentId,
      modelNumber: ticket.customFields?.modelA || ticket.modelNumber,
      costs: {
        diagnostic: ticket.costs?.diagnostic || 0,
        repair: servicesSum,
        advance: ticket.costs?.advance || 0
      },
      createdAt: ticketToEdit?.createdAt || new Date().toISOString(),
      clientSignature: signature,
      history: ticket.history || [],
      client: {
        name: ticket.client?.name || '',
        phone: ticket.client?.phone || '',
        email: ticket.client?.email || '',
        id: ticket.client?.id || '',
        isEnterprise: true,
        customFields: ticket.client?.customFields || {}
      }
    } as RepairTicket;
  };

  useEffect(() => {
    if (!isEditMode) {
      const nextSeq = generateNextTicketSequence(tickets, true);
      setFullTicketId(nextSeq);
    }
  }, [tickets, isEditMode]);

  const handleQuickAddService = () => {
    const price = parseInt(quickServicePrice);
    if (quickServiceName && !isNaN(price)) {
        const newService: RepairServiceItem = {
            id: `svc-${Date.now()}`,
            updatedAt: new Date().toISOString(),
            name: quickServiceName.toUpperCase(),
            price: price,
            category: 'Prestation Entreprise'
        };
        const updatedServices = [...(ticket.services || []), newService];
        setTicket(p => ({ 
            ...p, 
            services: updatedServices,
            costs: { ...p.costs!, repair: updatedServices.reduce((sum, s) => sum + s.price, 0) }
        }));
        setQuickServiceName('');
        setQuickServicePrice('');
    }
  };

  const handleSave = async (action: 'new' | 'close' | 'print') => {
    if (!ticket.client?.name) {
        showToast("Nom de l'entreprise requis.", "warning");
        return;
    }
    if (!isEditMode && !ticket.customFields?.deposantName) {
        showToast("Nom du déposant requis pour une nouvelle fiche.", "warning");
        return;
    }
    if (!isEditMode && ticket.customFields?.luEtApprouve?.toLowerCase() !== 'lu et approuvé') {
        showToast("Veuillez saisir 'Lu et approuvé' avant de signer.", "warning");
        return;
    }
    
    setIsSaving(true);
    try {
        const signature = signaturePadRef.current?.getSignature() || ticket.clientSignature;
        let cleanId = fullTicketId.trim().toUpperCase();
        if (!cleanId || (!isEditMode && isFallbackTicketId(cleanId))) {
            cleanId = generateNextTicketSequence(tickets, true);
            setFullTicketId(cleanId);
        }

        const finalTicket = {
            ...ticket,
            id: cleanId,
            modelNumber: ticket.customFields?.modelA || ticket.modelNumber,
            clientSignature: signature,
            createdAt: ticketToEdit ? ticketToEdit.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (ticket.isReIntervention && !ticketToEdit?.isReIntervention) {
             finalTicket.history = [
                 ...(finalTicket.history || []),
                 { timestamp: new Date().toISOString(), user: 'Accueil', action: "Marqué comme RÉ-INTERVENTION ENTREPRISE." }
             ];
         }
        
        await onSave(finalTicket, action, ticketToEdit?.id);
        playTone(880, 150);
    } catch (err) {
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const totalCalculated = (ticket.costs?.diagnostic || 0) + (ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0);

  const inputStyle = "w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-purple-500 transition-all";
  const labelStyle = "block text-[9px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest";
  const sectionTitle = "text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3";

  return (
    <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-apple-surface p-6 rounded-[32px] border border-white/10 glass shadow-2xl sticky top-20 z-40">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600 rounded-2xl shadow-lg">
                    <BuildingStorefrontIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">Fiche Entreprise</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID Dossier :</p>
                        <input
                            type="text"
                            value={fullTicketId}
                            onChange={(e) => setFullTicketId(e.target.value.toUpperCase())}
                            className="bg-black/40 border border-white/10 rounded-lg px-2 py-0.5 font-mono text-purple-400 font-bold text-xs uppercase focus:border-purple-500 outline-none w-32"
                        />
                        {!isEditMode && (
                            <button
                                type="button"
                                onClick={() => {
                                    const next = generateNextTicketSequence(tickets, true);
                                    setFullTicketId(next);
                                    showToast(`Numéro Entreprise régénéré : ${next}`, "info");
                                }}
                                className="text-[10px] font-bold text-slate-400 hover:text-purple-400"
                                title="Régénérer automatique"
                            >
                                🔄
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={() => setIsPreviewOpen(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-purple-900/40 flex items-center gap-1.5">
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    <span>Export PDF Rapide</span>
                </button>
                <button onClick={onCancel} className="px-6 py-3 text-slate-400 hover:text-white uppercase font-black text-[10px] tracking-widest">Annuler</button>
                <button onClick={() => handleSave('close')} disabled={isSaving} className="px-6 py-3 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Enregistrer</button>
                <button onClick={() => handleSave('print')} disabled={isSaving} className="px-8 py-3 bg-purple-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/40">Enregistrer & Imprimer</button>
            </div>
        </div>

        <div className={`grid grid-cols-1 ${isTouch ? 'gap-6' : 'lg:grid-cols-12 gap-8'}`}>
            <div className={`${isTouch ? 'w-full space-y-6' : 'lg:col-span-8 space-y-8'}`}>
                {/* 1. RÉFÉRENCES & SOCIÉTÉ */}
                <div className="apple-card p-8 bg-white/[0.02]">
                    <h3 className={sectionTitle}><BuildingStorefrontIcon className="w-5 h-5"/> Entité Entreprise</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 flex items-center justify-between">
                            <div className="flex-1 mr-6">
                                <label className={labelStyle}>Nom de l'entreprise *</label>
                                <input placeholder="RAISON SOCIALE" value={ticket.client?.name} onChange={e => setTicket({...ticket, client: {...ticket.client!, name: e.target.value.toUpperCase()}})} className={inputStyle} />
                            </div>
                            <div className="w-48">
                                <label className="flex items-center gap-3 p-3 bg-red-600/5 border border-red-500/20 rounded-xl cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={ticket.isReIntervention} 
                                        onChange={e => setTicket({...ticket, isReIntervention: e.target.checked})}
                                        className="w-5 h-5 accent-red-600"
                                    />
                                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-tight">Retour SAV</span>
                                </label>
                            </div>
                        </div>

                        {/* BANNIÈRE DE CONFIRMATION SI ENTREPRISE RÉCURRENTE SÉLECTIONNÉE */}
                        {selectedRecurrentClient && (
                            <div className="md:col-span-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">🏢</span>
                                    <span className="text-xs font-black text-purple-300 uppercase">Partenaire Récurrent :</span>
                                    <span className="text-xs font-bold text-white">{selectedRecurrentClient.clientName}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        {selectedRecurrentClient.ticketCount} machines enregistrées
                                    </span>
                                    {selectedRecurrentClient.isSubcontractor && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            ⚡ Sous-traitant Partenaire (Diagnostic Offert)
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedRecurrentClient(null);
                                        setDismissedRecurrentPrompt(false);
                                    }}
                                    className="text-[10px] font-bold text-zinc-400 hover:text-white uppercase transition-colors"
                                >
                                    Changer
                                </button>
                            </div>
                        )}

                        {/* PROMPT CLIENT RÉCURRENT (RÈGLE STRICTE : ≥ 2 MACHINES ENREGISTRÉES) */}
                        {matchingRecurrentClients.length > 0 && !selectedRecurrentClient && (
                            <div className="md:col-span-2 p-4 bg-gradient-to-r from-purple-950/50 via-indigo-950/40 to-black/60 border border-purple-500/40 rounded-2xl space-y-3 animate-slide-up shadow-xl">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">❓</span>
                                        <div>
                                            <p className="text-xs font-black uppercase text-purple-300 tracking-wider m-0">
                                                S'agit-il d'une entreprise déjà enregistrée chez nous ?
                                            </p>
                                            <p className="text-[11px] text-zinc-300 mt-0.5">
                                                Ce compte correspond à un partenaire récurrent (au moins 2 machines enregistrées). Vous pouvez reporter les coordonnées et le contact en un clic.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDismissedRecurrentPrompt(true)}
                                        className="text-zinc-400 hover:text-white p-1 text-xs cursor-pointer"
                                        title="Ignorer cette suggestion"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {matchingRecurrentClients.slice(0, 3).map((match) => (
                                        <div
                                            key={match.normalizedName}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-black/50 hover:bg-black/70 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all"
                                        >
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-black text-white">{match.clientName}</span>
                                                    <span className="text-[11px] font-mono text-zinc-300 font-bold">{match.phone}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                        {match.ticketCount} dossiers
                                                    </span>
                                                    {match.isSubcontractor && (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                            ⚡ Sous-traitant
                                                        </span>
                                                    )}
                                                </div>
                                                {(match.uniqueMacs || []).length > 0 && (
                                                    <p className="text-[10px] text-zinc-400 mt-1">
                                                        Machines : {(match.uniqueMacs || []).map(m => m.macModel || m.modelNumber || m.serialNumber).filter(Boolean).join(' • ')}
                                                    </p>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSelectRecurrentClient(match)}
                                                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>✓ Reporter nom & contact</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className={labelStyle}>Nom du Déposant / Représentant *</label>
                            <input placeholder="NOM Prénom" value={ticket.customFields?.deposantName} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, deposantName: e.target.value}})} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Fonction du Déposant *</label>
                            <input placeholder="ex: Responsable IT, Gérant, Comptable..." value={ticket.customFields?.deposantFunction} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, deposantFunction: e.target.value}})} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Téléphone contact direct *</label>
                            <input placeholder="ex: 07 00 00 00 00" value={ticket.client?.phone} onChange={e => setTicket({...ticket, client: {...ticket.client!, phone: e.target.value}})} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Email de l'entreprise / Contact</label>
                            <input placeholder="ex: contact@entreprise.com" value={ticket.client?.email} onChange={e => setTicket({...ticket, client: {...ticket.client!, email: e.target.value}})} className={inputStyle} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Numéro pour notifications SMS</label>
                            <div className="flex items-center gap-2">
                                {!ticket.client?.useWhatsAppForSms && (
                                    <input 
                                        placeholder="07 XX XX XX XX" 
                                        value={ticket.client?.smsPhone || ''} 
                                        onChange={e => setTicket(p => ({...p, client: {...p.client!, smsPhone: e.target.value}}))} 
                                        className="flex-1 p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-mono font-bold outline-none focus:border-purple-500 transition-all" 
                                    />
                                )}
                                <label className={`flex items-center gap-2 p-3 ${ticket.client?.useWhatsAppForSms ? 'bg-purple-500/10 border-purple-500/30' : 'bg-black/20 border-white/5'} border rounded-xl cursor-pointer transition-all flex-1`}>
                                    <input 
                                        type="checkbox" 
                                        checked={ticket.client?.useWhatsAppForSms || false} 
                                        onChange={e => {
                                            const useWA = e.target.checked;
                                            setTicket(p => ({
                                                ...p, 
                                                client: {
                                                    ...p.client!, 
                                                    useWhatsAppForSms: useWA,
                                                    smsPhone: useWA ? p.client!.phone : ''
                                                }
                                            }));
                                        }}
                                        className="w-4 h-4 accent-purple-500"
                                    />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Idem Contact</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>N° Bon de Commande / PO Interne</label>
                            <input placeholder="Réf. Commande Entreprise" value={ticket.customFields?.poRef} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, poRef: e.target.value.toUpperCase()}})} className={inputStyle + " font-mono text-purple-400"} />
                        </div>
                        <div>
                            <label className={labelStyle}>Registre du Commerce (RCCM)</label>
                            <input placeholder="ex: CI-ABJ-01-XXXX-X" value={ticket.customFields?.rccm} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, rccm: e.target.value.toUpperCase()}})} className={inputStyle + " font-mono"} />
                        </div>
                        <div>
                            <label className={labelStyle}>Compte Contribuable (N° CC)</label>
                            <input placeholder="ex: 1234567 X" value={ticket.customFields?.compteContribuable} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, compteContribuable: e.target.value.toUpperCase()}})} className={inputStyle + " font-mono"} />
                        </div>
                    </div>
                </div>

                {/* NOUVEAU : MODE DE RÉCEPTION DE L'ORDINATEUR (DÉPÔT ATELIER VS YANGO) */}
                <div className="apple-card p-6 bg-white/[0.02]">
                    <ReceptionModeField
                        receptionMode={ticket.receptionMode || 'depot_atelier'}
                        yangoDetails={ticket.yangoDetails}
                        onChangeMode={(mode) => setTicket(p => ({ ...p, receptionMode: mode }))}
                        onChangeYangoDetails={(details) => setTicket(p => ({ ...p, yangoDetails: details }))}
                        clientName={ticket.client?.name}
                        clientPhone={ticket.client?.phone}
                    />
                </div>

                {/* 1.B PHOTOS DE L'APPAREIL & IDENTIFICATION PHYSIQUE */}
                <div className="apple-card p-8 bg-white/[0.02]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-white/5 pb-4">
                        <div>
                            <h3 className={sectionTitle}>
                                <CameraIcon className="w-5 h-5 text-purple-400" />
                                Photos de l'appareil (Max 6)
                            </h3>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                Clichés face fermée, face ouverte et coque arrière avec N° de série, Modèle Axxxx et EMC
                            </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold bg-white/5 border border-white/10 text-slate-300 self-start sm:self-auto">
                            {(ticket.intakeImages?.length || 0)} / 6 photos
                        </span>
                    </div>

                    {/* Inputs cachés pour Tablette / Mobile / Desktop */}
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        ref={cameraInputRef} 
                        onChange={e => { handleAddIntakeImages(e.target.files); e.target.value = ''; }} 
                        className="hidden" 
                    />
                    <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        ref={galleryInputRef} 
                        onChange={e => { handleAddIntakeImages(e.target.files); e.target.value = ''; }} 
                        className="hidden" 
                    />

                    {/* Boutons d'action : Appareil photo ou Galerie */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={(ticket.intakeImages?.length || 0) >= 6}
                            className="flex-1 min-w-[140px] px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/30"
                            title="Ouvre directement la caméra sur tablette (iPad, Android) ou smartphone"
                        >
                            <CameraIcon className="w-4 h-4" />
                            Prendre photo
                        </button>

                        <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            disabled={(ticket.intakeImages?.length || 0) >= 6}
                            className="flex-1 min-w-[140px] px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-200 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                            title="Importer depuis la galerie photos ou les fichiers"
                        >
                            <PhotoIcon className="w-4 h-4 text-slate-400" />
                            Parcourir / Galerie
                        </button>
                    </div>

                    {isAnalyzingPhoto && (
                        <div className="mt-4 p-3 bg-purple-600/10 border border-purple-500/30 rounded-xl flex items-center gap-3 animate-pulse text-purple-300 text-xs font-bold">
                            <SparklesIcon className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                            <span>Détection automatique en cours : analyse du couvre arrière (Modèle AXXXX, Numéro de série et EMC peu importe l'ordre)...</span>
                        </div>
                    )}

                    {/* Bandeau récapitulatif Couvre Arrière détecté */}
                    {ticket.backCoverImage && (
                        <div className="mt-4 p-3 bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-teal-950/40 border border-emerald-500/40 rounded-xl flex flex-wrap items-center justify-between gap-2 text-emerald-300 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-base">🛡️</span>
                                <span className="font-bold">
                                    Couvre arrière identifié et intégré au dossier entreprise !
                                    {(ticket.customFields?.modelA || ticket.modelNumber) ? ` · Modèle: ${ticket.customFields?.modelA || ticket.modelNumber}` : ''}
                                    {ticket.serialNumber ? ` · S/N: ${ticket.serialNumber}` : ''}
                                    {(ticket.emc || ticket.customFields?.emc) ? ` · ${ticket.emc || ticket.customFields?.emc}` : ''}
                                </span>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/50 rounded font-black text-[9px] uppercase tracking-wider text-emerald-200">
                                ✓ Renseigné
                            </span>
                        </div>
                    )}

                    {/* Grille des photos enregistrées */}
                    {(ticket.intakeImages && ticket.intakeImages.length > 0) && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
                            {(ticket.intakeImages || []).map((img, idx) => {
                                const isBackCover = (ticket.backCoverImage && ticket.backCoverImage === img) || (ticket.backCoverImageIndex === idx);
                                const label = isBackCover
                                    ? "🛡️ Couvre Arrière (Gravures S/N • Modèle • EMC)"
                                    : `Photo ${idx + 1}`;

                                return (
                                    <div 
                                        key={idx} 
                                        className={`relative group bg-black/60 rounded-xl overflow-hidden shadow-md flex flex-col transition-all border ${
                                            isBackCover 
                                                ? 'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400' 
                                                : 'border-white/10'
                                        }`}
                                    >
                                        {isBackCover && (
                                            <div className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-md bg-emerald-600/90 backdrop-blur-md text-[8px] font-black uppercase text-white shadow-md flex items-center gap-1 border border-emerald-300/60">
                                                <span>🛡️</span>
                                                <span>Couvre Arrière</span>
                                            </div>
                                        )}

                                        <div className="relative aspect-video w-full cursor-pointer overflow-hidden bg-zinc-950 flex items-center justify-center" onClick={() => setPreviewImageModal(img)}>
                                            <img src={img} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-[9px] font-black text-white uppercase bg-black/70 px-2 py-1 rounded">Agrandir</span>
                                            </div>
                                        </div>

                                        <div className={`p-2 flex items-center justify-between gap-1 text-[8.5px] ${isBackCover ? 'bg-emerald-950/80 border-t border-emerald-500/30' : 'bg-zinc-900/90'}`}>
                                            <span className={`font-bold truncate ${isBackCover ? 'text-emerald-300 font-black' : 'text-slate-300'}`} title={label}>{label}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); autoDetectBackCoverAndDeviceInfo(ticket.intakeImages || [], idx); }}
                                                    className={`p-1 rounded transition-colors ${
                                                        isBackCover 
                                                            ? 'text-emerald-300 hover:text-white hover:bg-emerald-600/40' 
                                                            : 'text-purple-400 hover:text-white hover:bg-purple-600/30'
                                                    }`}
                                                    title="Analyser cette photo pour détecter le couvre arrière, modèle, série et EMC"
                                                >
                                                    <SparklesIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveIntakeImage(idx); }}
                                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded transition-colors"
                                                    title="Supprimer cette photo"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 2. IDENTIFICATION MATÉRIEL */}
                <div className="apple-card p-8">
                    <h3 className={sectionTitle}><MacbookIcon className="w-5 h-5"/> Identification Matériel</h3>

                    {/* PROPOSITION LORSQUE LE NOM + NUMÉRO DE SÉRIE DU MACBOOK EXISTENT DÉJÀ */}
                    {matchingExistingMac && (
                        <div className="mb-6 p-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border-2 border-blue-500/40 rounded-2xl space-y-3.5 animate-slide-up shadow-xl">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-xl">💻</span>
                                    <div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-wider m-0">
                                            Machine déjà enregistrée pour cette entreprise !
                                        </h4>
                                        <p className="text-[11px] text-zinc-300 mt-0.5">
                                            Ce MacBook (S/N: <strong className="font-mono text-blue-300">{matchingExistingMac.serialNumber}</strong>) a déjà été traité pour <strong>{matchingExistingMac.clientName}</strong> sous le dossier initial <strong className="font-mono text-amber-300">#{matchingExistingMac.ticketId}</strong>.
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-xl bg-blue-500/20 text-blue-300 text-[9px] font-black uppercase border border-blue-500/30 shrink-0">
                                    Numéro Connu
                                </span>
                            </div>

                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Sélectionnez l'option de prise en charge :
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                                {/* OPTION 1 : NOUVEAU MAC (CHOIX PAR DÉFAUT) */}
                                <button
                                    type="button"
                                    onClick={handleSelectDistinctNewMac}
                                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer ${
                                        sameMacHandlingMode === 'distinct_new'
                                            ? 'bg-emerald-600/25 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500/40'
                                            : 'bg-black/40 border-white/10 hover:border-white/20 text-zinc-300'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-black uppercase text-emerald-400">✨ Nouveau Mac</span>
                                            {sameMacHandlingMode === 'distinct_new' && (
                                                <span className="text-[8px] bg-emerald-500 text-black font-black px-1.5 py-0.5 rounded-full uppercase">Par défaut</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-white mt-1">Numéro distinct ({fullTicketId})</p>
                                        <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight">
                                            Nouvelle fiche société avec numéro séquentiel propre.
                                        </p>
                                    </div>
                                </button>

                                {/* OPTION 2 : RÉINTERVENTION EN CONSERVANT LE MÊME NUMÉRO */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectReinterventionSameId(matchingExistingMac)}
                                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer ${
                                        sameMacHandlingMode === 'reintervention_same_id'
                                            ? 'bg-red-600/25 border-red-500 text-white shadow-lg ring-1 ring-red-500/40'
                                            : 'bg-black/40 border-white/10 hover:border-white/20 text-zinc-300'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-black uppercase text-red-400">🔄 Réintervention</span>
                                            {sameMacHandlingMode === 'reintervention_same_id' && (
                                                <span className="text-[8px] bg-red-500 text-white font-black px-1.5 py-0.5 rounded-full uppercase">Actif</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-white mt-1">Même numéro (#{matchingExistingMac.ticketId})</p>
                                        <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight">
                                            Retour SAV en conservant l'identifiant initial du dossier.
                                        </p>
                                    </div>
                                </button>

                                {/* OPTION 3 : NOUVELLE PRESTATION EN CONSERVANT LE MÊME NUMÉRO */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectNewServiceSameId(matchingExistingMac)}
                                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer ${
                                        sameMacHandlingMode === 'new_service_same_id'
                                            ? 'bg-purple-600/25 border-purple-500 text-white shadow-lg ring-1 ring-purple-500/40'
                                            : 'bg-black/40 border-white/10 hover:border-white/20 text-zinc-300'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-black uppercase text-purple-400">🛠️ Nouvelle prestation</span>
                                            {sameMacHandlingMode === 'new_service_same_id' && (
                                                <span className="text-[8px] bg-purple-500 text-white font-black px-1.5 py-0.5 rounded-full uppercase">Actif</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-white mt-1">Même numéro (#{matchingExistingMac.ticketId})</p>
                                        <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight">
                                            Nouvelle intervention / bon de prise en charge sous le même numéro.
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* BANNIÈRE PAR DÉFAUT : NOUVEAU MAC POUR CETTE ENTREPRISE (NUMÉRO DISTINCT) */}
                    {sameMacHandlingMode === 'distinct_new' && (
                        <div className="mb-6 p-3.5 bg-gradient-to-r from-emerald-950/30 to-zinc-900 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
                            <div className="flex items-center gap-2.5">
                                <span className="text-base">✨</span>
                                <div>
                                    <p className="text-xs font-black text-emerald-400 uppercase tracking-wider m-0">
                                        Nouveau Mac pour cette entreprise (Numéro distinct)
                                    </p>
                                    <p className="text-[10px] text-zinc-400 mt-0.5">
                                        Machine non répertoriée dans les dépôts précédents. Prise de vue et identification complète actives.
                                    </p>
                                </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase border border-emerald-500/30 shrink-0">
                                Choix par défaut
                            </span>
                        </div>
                    )}

                    {/* SÉLECTEUR DE PARC : MACHINES PRÉCÉDEMMENT ENREGISTRÉES POUR CETTE SOCIÉTÉ */}
                    {selectedRecurrentClient && selectedRecurrentClient.uniqueMacs.length > 0 && (
                        <div className="mb-6 p-4 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs">💻</span>
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                                        Parc de machines enregistrées pour cette entreprise ({selectedRecurrentClient.uniqueMacs.length} Mac{selectedRecurrentClient.uniqueMacs.length > 1 ? 's' : ''})
                                    </span>
                                </div>
                                <span className="text-[9px] text-zinc-500">
                                    Cliquez pour basculer en réintervention ou déclarez un nouveau Mac
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(selectedRecurrentClient?.uniqueMacs || []).map((pastMac, idx) => {
                                    const isSelected = (ticket.serialNumber && ticket.serialNumber === pastMac.serialNumber) ||
                                        ((ticket.modelNumber || ticket.customFields?.modelA) && (ticket.modelNumber || ticket.customFields?.modelA) === pastMac.modelNumber && ticket.isReIntervention);
                                    return (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                                isSelected
                                                    ? 'bg-red-500/15 border-red-500/50 shadow-md ring-1 ring-red-400/30'
                                                    : 'bg-black/40 border-white/5 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-black text-white truncate m-0">
                                                        {pastMac.macModel || pastMac.modelNumber || 'MacBook'}
                                                    </p>
                                                    {pastMac.modelNumber && (
                                                        <span className="text-[9px] font-mono text-purple-400 font-bold">
                                                            ({pastMac.modelNumber})
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                                                    S/N: {pastMac.serialNumber || 'Non gravé'} {pastMac.macColor ? `• ${pastMac.macColor}` : ''}
                                                </p>
                                                <p className="text-[9px] text-zinc-500 mt-0.5">
                                                    Dossier #{pastMac.lastTicketId} ({pastMac.ticketCount} passage{pastMac.ticketCount > 1 ? 's' : ''})
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSelectPastMacForReintervention(pastMac)}
                                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-red-600 text-white shadow-lg'
                                                        : 'bg-white/10 hover:bg-white/20 text-white'
                                                }`}
                                            >
                                                {isSelected ? '✓ Même Mac' : 'C\'est ce Mac'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-1 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={handleSetAsNewMac}
                                    className="text-[10px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>✨ C'est un Nouveau Mac pour cette entreprise (Nouvelle identification & photos)</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className={labelStyle}>Modèle (AXXXX) *</label>
                                {(ticket.customFields?.modelA || ticket.modelNumber) && ticket.backCoverImage && (
                                    <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1 py-0.5 rounded">
                                        ✨ Détecté dos
                                    </span>
                                )}
                            </div>
                            <input value={ticket.customFields?.modelA || ticket.modelNumber || ''} onChange={e => setTicket({...ticket, modelNumber: e.target.value.toUpperCase(), customFields: {...ticket.customFields, modelA: e.target.value.toUpperCase()}})} placeholder="ex: A2338" className={inputStyle + " font-mono"} />
                        </div>
                        <div>
                            <label className={labelStyle}>Nom Modèle Commercial *</label>
                            <input value={ticket.macModel} onChange={e => setTicket({...ticket, macModel: e.target.value.toUpperCase()})} placeholder="ex: MACBOOK PRO 14" className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Couleur *</label>
                            <input list="enterprise-colors-list" value={ticket.macColor} onChange={e => setTicket({...ticket, macColor: e.target.value.toUpperCase()})} placeholder="ex: SILVER, BLUSH, CITRUS..." className={inputStyle} />
                            <datalist id="enterprise-colors-list">
                                <option value="SILVER" />
                                <option value="BLUSH" />
                                <option value="CITRUS" />
                                <option value="INDIGO" />
                                <option value="GRIS SIDÉRAL" />
                                <option value="ARGENT" />
                                <option value="MINUIT" />
                                <option value="LUMIÈRE STELLAIRE" />
                                <option value="NOIR SIDÉRAL" />
                                <option value="OR" />
                            </datalist>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className={labelStyle}>Numéro de série (S/N)</label>
                                {ticket.serialNumber && ticket.backCoverImage && (
                                    <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1 py-0.5 rounded">
                                        ✨ Détecté couvre arrière
                                    </span>
                                )}
                            </div>
                            <input placeholder="S/N" value={ticket.serialNumber} onChange={e => setTicket({...ticket, serialNumber: e.target.value.toUpperCase()})} className={inputStyle + " font-mono text-blue-400"} />
                        </div>
                        <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                                <label className={labelStyle}>Code EMC (Gravure Apple)</label>
                                {(ticket.emc || ticket.customFields?.emc) && (
                                    <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1 py-0.5 rounded">
                                        ✨ Détecté couvre arrière
                                    </span>
                                )}
                            </div>
                            <input 
                                placeholder="ex: EMC 3347" 
                                value={ticket.emc || ticket.customFields?.emc || ''} 
                                onChange={e => {
                                    const val = e.target.value.toUpperCase();
                                    setTicket({
                                        ...ticket, 
                                        emc: val, 
                                        customFields: { ...ticket.customFields, emc: val }
                                    });
                                }} 
                                className={inputStyle + " font-mono text-emerald-400"} 
                            />
                        </div>
                    </div>
                </div>
                {/* 3. ÉTAT TECHNIQUE DÉTAILLÉ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="apple-card p-8 bg-purple-600/5">
                        <h3 className={sectionTitle}><SparklesIcon className="w-5 h-5"/> S'allume : État</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                                <label className="text-[10px] font-black uppercase text-slate-300">Machine s'allume ?</label>
                                <input type="checkbox" checked={ticket.powersOn} onChange={e => setTicket({...ticket, powersOn: e.target.checked})} className="w-6 h-6 accent-purple-500" />
                            </div>
                            
                            {ticket.powersOn && (
                                <div className="space-y-3 animate-fade-in">
                                    <label className={labelStyle}>Préciser le comportement</label>
                                    <select 
                                        value={ticket.customFields?.powerOnDetails} 
                                        onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, powerOnDetails: e.target.value}})}
                                        className={inputStyle}
                                    >
                                        <option value="">-- Sélectionner l'état --</option>
                                        <option value="Charge le bureau">Charge le bureau</option>
                                        <option value="Redémarre sans arrêt">Redémarre sans arrêt</option>
                                        <option value="S'allume et s'éteint sans charger le système">S'allume et s'éteint sans charger</option>
                                        <option value="Écran cassé - Aucune visibilité possible">Écran cassé - Aucune visibilité possible</option>
                                        <option value="Autre">Préciser autre problème...</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="apple-card p-8">
                        <h3 className={sectionTitle}><PlusIcon className="w-5 h-5"/> Accessoires Reçus</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">Chargeur</span>
                                    <input type="checkbox" checked={ticket.chargerIncluded} onChange={e => setTicket({...ticket, chargerIncluded: e.target.checked})} className="accent-purple-500" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                                <span className="text-[10px] font-bold text-slate-300 uppercase">Câble d'alimentation</span>
                                <input type="checkbox" checked={ticket.customFields?.hasCable === 'oui'} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, hasCable: e.target.checked ? 'oui' : 'non'}})} className="accent-purple-500" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">Sac / Housse</span>
                                    <input type="checkbox" checked={ticket.bagIncluded} onChange={e => setTicket({...ticket, bagIncluded: e.target.checked})} className="accent-purple-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. INSPECTION PHYSIQUE & VISUELLE B2B (Logique Juridique & Protection) */}
                <div className="apple-card p-8 bg-white/[0.02]">
                    <h3 className={sectionTitle}>🔍 Inspection Physique de l'Appareil (Protection Atelier & Client)</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6 -mt-3">
                        Ces constats visuels engagent l'entreprise et la déchargent de toute réclamation sur des défauts préexistants.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex items-center justify-between p-3.5 bg-black/30 border border-white/5 rounded-xl">
                            <div>
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Écran Cassé / Fissuré</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Défaut d'affichage, rayures majeures</span>
                            </div>
                            <select 
                                value={ticket.customFields?.screenBroken || 'non'} 
                                onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, screenBroken: e.target.value}})}
                                className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                            >
                                <option value="non">NON</option>
                                <option value="oui">OUI</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-3.5 bg-black/30 border border-white/5 rounded-xl">
                            <div>
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Traces de Chocs / Déformation</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Coins enfoncés, châssis tordu</span>
                            </div>
                            <select 
                                value={ticket.customFields?.traceChoc || 'non'} 
                                onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, traceChoc: e.target.value}})}
                                className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                            >
                                <option value="non">NON</option>
                                <option value="oui">OUI</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-3.5 bg-black/30 border border-white/5 rounded-xl">
                            <div>
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Traces de Liquide / Oxydation</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Indicateurs de contact liquide actifs</span>
                            </div>
                            <select 
                                value={ticket.customFields?.traceLiquid || 'non'} 
                                onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, traceLiquid: e.target.value}})}
                                className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                            >
                                <option value="non">NON</option>
                                <option value="oui">OUI</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-3.5 bg-black/30 border border-white/5 rounded-xl">
                            <div>
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Clavier / Trackpad HS</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Touches manquantes ou bloquées</span>
                            </div>
                            <select 
                                value={ticket.customFields?.keyboardDamaged || 'non'} 
                                onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, keyboardDamaged: e.target.value}})}
                                className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                            >
                                <option value="non">NON</option>
                                <option value="oui">OUI</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-3 p-3.5 bg-black/30 border border-white/5 rounded-xl sm:col-span-2">
                            <div className="flex items-center justify-between w-full">
                                <div>
                                    <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Vis de capot manquantes sous le châssis</span>
                                    <span className="text-[8px] text-slate-500 font-bold uppercase">Appareil déjà ouvert par un tiers ou choc antérieur</span>
                                </div>
                                <select 
                                    value={ticket.customFields?.missingScrews || 'non'} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        setTicket({
                                            ...ticket, 
                                            customFields: {
                                                ...ticket.customFields, 
                                                missingScrews: val,
                                                foundScrewsCount: val === 'non' ? '' : (ticket.customFields?.foundScrewsCount || '')
                                            }
                                        });
                                    }}
                                    className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                                >
                                    <option value="non">NON (Toutes présentes)</option>
                                    <option value="oui">OUI (Une ou plusieurs vis manquantes)</option>
                                </select>
                            </div>
                            {ticket.customFields?.missingScrews === 'oui' && (
                                <div className="mt-2 pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <span className="block text-[10px] font-black text-purple-400 uppercase tracking-wider">Préciser le nombre de vis trouvées sous le châssis *</span>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase">Saisissez le nombre ou la description (ex: "6 vis trouvées")</span>
                                    </div>
                                    <input 
                                        type="text"
                                        placeholder="ex: 6 vis trouvées"
                                        value={ticket.customFields?.foundScrewsCount || ''}
                                        onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, foundScrewsCount: e.target.value}})}
                                        className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-bold w-full sm:w-64 focus:border-purple-500 transition-all placeholder:text-purple-300/40"
                                        required={ticket.customFields?.missingScrews === 'oui'}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="apple-card p-8 space-y-6">
                    <div>
                        <h3 className={sectionTitle}>📜 Problème signalé par le client</h3>
                        <textarea rows={3} value={ticket.problemDescription} onChange={e => setTicket({...ticket, problemDescription: e.target.value})} className={inputStyle + " font-normal resize-none"} placeholder="Détails des symptômes..." />
                    </div>
                </div>

                <div className="apple-card p-8 bg-purple-600/5 border-purple-500/20">
                    <h3 className={sectionTitle}><BanknotesIcon className="w-5 h-5"/> Coût de la prestation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className={labelStyle}>Forfait Expertise / Diagnostic (F CFA)</label>
                                {ticket.client?.clientType === 'subcontractor' && (
                                    <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                        Exonéré (Sous-traitant : 0 F CFA)
                                    </span>
                                )}
                            </div>
                            <input 
                                type="number" 
                                min="0"
                                step="500"
                                value={ticket.client?.clientType === 'subcontractor' ? 0 : (ticket.costs?.diagnostic ?? '')} 
                                disabled={ticket.client?.clientType === 'subcontractor'}
                                onKeyDown={(e) => {
                                    if (['e', 'E', '+', '-'].includes(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    const numVal = raw === '' ? 0 : Math.max(0, parseInt(raw, 10));
                                    setTicket(p => ({
                                        ...p, 
                                        costs: {
                                            ...(p.costs || { diagnostic: 0, repair: 0, advance: 0 }), 
                                            diagnostic: numVal
                                        }
                                    }));
                                }} 
                                className={inputStyle + " text-blue-400 font-mono text-lg" + (ticket.client?.clientType === 'subcontractor' ? ' opacity-60 cursor-not-allowed text-amber-400' : '')} 
                            />
                        </div>
                        <div className="bg-black/20 p-4 rounded-2xl flex flex-col items-end justify-center">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Cumulé (Diag + Services)</p>
                            <p className="text-3xl font-black text-white font-mono">{totalCalculated.toLocaleString()} F</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                        {(ticket.services && ticket.services.length > 0) ? ticket.services.map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-purple-500/20 transition-all">
                                <div className="flex-1 mr-4">
                                    <span className="text-xs font-black text-white uppercase">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-mono font-black text-purple-400">{s.price.toLocaleString()} F</span>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const updatedServices = (ticket.services || []).filter((_, idx) => idx !== i);
                                            setTicket(p => ({ 
                                                ...p, 
                                                services: updatedServices,
                                                costs: { ...(p.costs || { diagnostic: 0, repair: 0, advance: 0 }), repair: updatedServices.reduce((sum, s) => sum + s.price, 0) }
                                            }));
                                        }} 
                                        className="p-2 text-red-500 hover:bg-red-600/20 rounded-xl transition-all"
                                    >
                                        <TrashIcon className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-20">
                                <p className="text-[10px] font-black uppercase italic">Aucune prestation chiffrée</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 p-2 bg-black/40 rounded-2xl border border-white/5">
                        <input placeholder="Libellé prestation..." value={quickServiceName} onChange={e => setQuickServiceName(e.target.value)} className="flex-1 bg-transparent px-4 py-2 text-xs text-white outline-none font-bold" />
                        <input 
                            type="number" 
                            min="0"
                            step="500"
                            placeholder="Prix" 
                            value={quickServicePrice} 
                            onKeyDown={(e) => {
                                if (['e', 'E', '+', '-'].includes(e.key)) {
                                    e.preventDefault();
                                }
                            }}
                            onChange={e => setQuickServicePrice(e.target.value.replace(/[^0-9]/g, ''))} 
                            className="w-24 bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono text-center" 
                        />
                        <button onClick={handleQuickAddService} className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-all"><PlusIcon className="w-5 h-5"/></button>
                    </div>
                </div>
            </div>

            <div className={`${isTouch ? 'w-full space-y-6' : 'lg:col-span-4 space-y-8'}`}>
                <div className="apple-card p-6 bg-yellow-600/5 border border-yellow-500/20">
                    <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-4">Acceptations & Clauses B2B</h3>
                    
                    {/* Rappel des conditions légales */}
                    <div className="p-3.5 bg-black/40 border border-yellow-500/10 rounded-xl space-y-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-6">
                        <div className="flex gap-2">
                            <span className="text-yellow-500">✔</span>
                            <p><span className="text-white">Habilitation :</span> Le déposant certifie engager juridiquement l'entreprise pour cette intervention.</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-yellow-500">✔</span>
                            <p><span className="text-white">Garantie Apple :</span> L'ouverture matérielle annule définitivement la garantie constructeur d'origine.</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-yellow-500">✔</span>
                            <p><span className="text-white">Données (SSD) :</span> La sauvegarde incombe exclusivement au client (puces SSD soudées).</p>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <label className="flex items-start gap-3 p-3 bg-black/40 rounded-xl cursor-pointer border border-white/5 hover:border-purple-500/30 transition-all">
                            <input type="checkbox" checked={ticket.customFields?.diagAccepted === 'true'} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, diagAccepted: e.target.checked ? 'true' : 'false'}})} className="mt-1 w-4 h-4 accent-purple-500" />
                            <span className="text-[10px] font-bold text-slate-300 uppercase leading-tight">Diagnostic 5 000 F accepté</span>
                        </label>
                        <label className="flex items-start gap-3 p-3 bg-black/40 rounded-xl cursor-pointer border border-white/5 hover:border-purple-500/30 transition-all">
                            <input type="checkbox" checked={ticket.customFields?.devisAccepted === 'true'} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, devisAccepted: e.target.checked ? 'true' : 'false'}})} className="mt-1 w-4 h-4 accent-purple-500" />
                            <span className="text-[10px] font-bold text-slate-300 uppercase leading-tight">Conditions Générales B2B acceptées</span>
                        </label>
                    </div>

                    <div className="space-y-4">
                        {!isEditMode && (
                            <>
                                <div>
                                    <label className={labelStyle}>Taper "Lu et approuvé" pour signer</label>
                                    <input 
                                        value={ticket.customFields?.luEtApprouve} 
                                        onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, luEtApprouve: e.target.value}})}
                                        placeholder="..." 
                                        className={inputStyle + " text-center italic"} 
                                    />
                                </div>
                                <div className={`bg-black/40 rounded-2xl border-2 transition-all ${ticket.customFields?.luEtApprouve?.toLowerCase() === 'lu et approuvé' ? 'border-purple-500' : 'border-white/5 opacity-30 pointer-events-none'}`}>
                                    <SignaturePad ref={signaturePadRef} />
                                </div>
                            </>
                        )}
                        {isEditMode && ticket.clientSignature && (
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center">
                                <p className="text-[8px] font-black uppercase text-slate-500 mb-2">Signature du dépôt enregistrée</p>
                                <img src={ticket.clientSignature} className="max-h-20 opacity-60" alt="Signature client" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {isPreviewOpen && (
            <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileName={`bon_entreprise_rapide_${getPreviewTicket().id}.pdf`}>
                <div className="flex flex-col text-black">
                    <PrintableTicket ticket={getPreviewTicket()} />
                    <PrintableEnterpriseBon ticket={getPreviewTicket()} />
                </div>
            </PreviewModal>
        )}

        {/* Modal d'agrandissement d'une photo */}
        {previewImageModal && (
            <div 
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                onClick={() => setPreviewImageModal(null)}
            >
                <div className="relative max-w-4xl max-h-[90vh] bg-zinc-950 p-2 rounded-2xl border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <button 
                        type="button" 
                        onClick={() => setPreviewImageModal(null)} 
                        className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center shadow-lg hover:bg-red-500 transition-all z-10"
                    >
                        &times;
                    </button>
                    <img src={previewImageModal} alt="Agrandissement" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
                </div>
            </div>
        )}
    </div>
  );
};

export default EnterpriseRepairForm;
