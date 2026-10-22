
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RepairTicket, RepairStatus, Role, Attachment, PowerOnStatus, Commande } from '../types.ts';
import { mergeUpdates } from '../utils/merge.ts';
import SignaturePad from './SignaturePad.tsx';
import { MacbookIcon, UserIcon, TrashIcon, CloudArrowDownIcon, SparklesIcon, CalendarDaysIcon, ChevronDownIcon, ArrowPathIcon, PrinterIcon, ShoppingCartIcon, DocumentArrowDownIcon, CameraIcon, PhotoIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import PrintableEnterpriseBon from './PrintableEnterpriseBon.tsx';
import { playTone } from '../utils/audio.ts';
import SmartAutocompleteInput from './SmartAutocompleteInput.tsx';
import { learnFromData } from '../services/suggestionService.ts';
import { findMacByModel } from '../utils/macModelsData.ts';
import { LignesVenteManager } from './LignesVenteManager.tsx';
import { syncSalesLinesToServices } from '../services/inventoryService.ts';
import { decompileServicesToLignesVente } from '../utils/ticketHelpers.ts';
import DeclaredSymptomsManager from './DeclaredSymptomsManager.tsx';
import useCommandes from '../hooks/useCommandes.ts';
import useAppointments from '../hooks/useAppointments.ts';
import { calculateFutureDate } from '../utils/dateCalculator.ts';
import { compressImageBase64 } from '../utils/imageCompression.ts';
import { generateNextTicketSequence, isFallbackTicketId } from '../utils/idGenerator.ts';
import { 
  findMatchingRecurrentClients, 
  checkIsSameMac, 
  ClientRecurrenceProfile 
} from '../utils/clientRecurrenceHelper.ts';
import { ReceptionModeField } from './ReceptionModeField.tsx';
import { useDeviceProfile } from '../context/DeviceProfileContext.tsx';


interface RepairFormProps {
  tickets: RepairTicket[];
  ticketToEdit?: RepairTicket | null;
  onSave: (ticket: Partial<RepairTicket>, action: 'new' | 'close' | 'print', oldId?: string) => Promise<RepairTicket | void>;
  onCancel: () => void;
  role: Role;
}

const COLOR_CLASSES: Record<string, string> = {
  'Silver': 'bg-[#D8D9DA] border-[#BFC1C4]',
  'Blush': 'bg-[#EAD2CE] border-[#D9BCB7]',
  'Citrus': 'bg-[#D6DF89] border-[#C0CA6C]',
  'Indigo': 'bg-[#4B5668] border-[#394250]',
  'Argent': 'bg-[#D8D9DA] border-[#BFC1C4]',
  'Gris sidéral': 'bg-[#7D7E80] border-[#606163]',
  'Minuit': 'bg-[#2E3641] border-[#1D232B]',
  'Lumière stellaire': 'bg-[#F0E5D3] border-[#DCD0BB]',
  'Noir sidéral': 'bg-[#2C2B2D] border-[#1A191A]',
  'Or': 'bg-[#F9E5C9] border-[#E7D0AF]',
  'Or Rose': 'bg-[#E7C1B5] border-[#CE9F91]',
  'Bleu': 'bg-[#3E5F8A] border-[#2C476A]',
  'Rose': 'bg-[#F4B8C1] border-[#DA96A1]',
  'Blanc': 'bg-[#F5F5F7] border-[#D1D1D6]',
  'Noir': 'bg-[#1D1D1F] border-[#000000]',
};

const initialTicketState: Partial<RepairTicket> = {
  status: RepairStatus.A_DIAGNOSTIQUER,
  client: { name: '', phone: '', email: '', id: '', customFields: {} },
  macBrand: 'APPLE',
  macModel: '',
  modelNumber: '',
  macColor: '',
  serialNumber: '',
  emc: '',
  backCoverImage: undefined,
  backCoverImageIndex: -1,
  problemDescription: '',
  costs: { diagnostic: 5000, repair: 0, advance: 0 },
  powersOn: false,
  powerOnStatus: 'non',
  chargerIncluded: false,
  bagIncluded: false,
  bagDescription: '',
  caseIncluded: false,
  caseColor: '',
  batteryFunctional: 'unknown',
  warrantyVoidAgreed: true,
  dataBackupAck: true,
  services: [],
  history: [],
  attachments: [],
  customFields: {},
  isReIntervention: false,
  reInterventionReason: '',
  receptionMode: 'depot_atelier',
};

import { useToastContext } from '../context/ToastContext.tsx';

const RepairForm: React.FC<RepairFormProps> = ({ tickets, ticketToEdit, onSave, onCancel, role }) => {
  const { showToast } = useToastContext();
  const { commandes, updateCommande } = useCommandes();
  const { addAppointment } = useAppointments();
  const [ticket, setTicket] = useState<Partial<RepairTicket>>(() => {
    const base: Partial<RepairTicket> = {
      ...initialTicketState,
      ...(ticketToEdit || {}),
      client: {
        ...initialTicketState.client,
        ...(ticketToEdit?.client || {})
      },
      costs: {
        ...initialTicketState.costs,
        ...(ticketToEdit?.costs || {})
      },
      customFields: {
        ...initialTicketState.customFields,
        ...(ticketToEdit?.customFields || {})
      },
      services: ticketToEdit?.services ? [...ticketToEdit.services] : [],
      attachments: ticketToEdit?.attachments ? [...ticketToEdit.attachments] : [],
      history: ticketToEdit?.history ? [...ticketToEdit.history] : [],
      ligneVentes: ticketToEdit?.ligneVentes ? [...ticketToEdit.ligneVentes] : [],
      paymentsList: ticketToEdit?.paymentsList ? [...ticketToEdit.paymentsList] : []
    };
        
    // Use decompileServicesToLignesVente helper to convert old services into sales lines if the ticket has services but missing or empty sales lines.
    if (ticketToEdit && ticketToEdit.services && ticketToEdit.services.length > 0 && (!ticketToEdit.ligneVentes || ticketToEdit.ligneVentes.length === 0)) {
      base.ligneVentes = decompileServicesToLignesVente(
        ticketToEdit.services,
        ticketToEdit.id || '',
        ticketToEdit.macModel || ''
      );
    }
        
    return base;
  });

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
  
  const [fullTicketId, setFullTicketId] = useState<string>(() => {
    if (ticketToEdit?.id) return ticketToEdit.id;
    return generateNextTicketSequence(tickets, false);
  });
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const signaturePadRef = useRef<{ getSignature: () => string; clear: () => void }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const { isTouch } = useDeviceProfile();

  // Clients récurrents & identification machine (Règle utilisateur: ≥ 2 fiches pour suggestion, comparaison même Mac / nouveau Mac)
  const [selectedRecurrentClient, setSelectedRecurrentClient] = useState<ClientRecurrenceProfile | null>(null);
  const [dismissedRecurrentPrompt, setDismissedRecurrentPrompt] = useState(false);
  
  // Règle métier : "Nouveau Mac pour ce client (Numéro distinct) est le choix par défaut"
  const [sameMacHandlingMode, setSameMacHandlingMode] = useState<'distinct_new' | 'reintervention_same_id' | 'new_service_same_id'>('distinct_new');

  // Initialisation du client récurrent si ticket en édition ou déjà connu
  useEffect(() => {
    if (ticketToEdit?.client?.name && tickets && tickets.length > 0) {
      const matches = findMatchingRecurrentClients(ticketToEdit.client.name, tickets);
      if (matches.length > 0) {
        setSelectedRecurrentClient(matches[0]);
      }
    }
  }, [ticketToEdit, tickets]);

  // Détection des clients récurrents (≥ 2 fiches enregistrées chez nous) lors de la saisie du nom ou téléphone
  const matchingRecurrentClients = useMemo(() => {
    if (dismissedRecurrentPrompt) return [];
    const nameQuery = ticket.client?.name || '';
    const phoneQuery = ticket.client?.phone || '';
    const activeQuery = nameQuery.trim().length >= 2 ? nameQuery : (phoneQuery.trim().length >= 4 ? phoneQuery : '');
    if (!activeQuery) return [];

    const matches = findMatchingRecurrentClients(activeQuery, tickets || []);
    // Si déjà sélectionné et nom correspond, ne pas spammer la popup
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
        diagnostic: isSub ? 0 : (prev.costs?.diagnostic ?? 15000)
      }
    }));
    setSelectedRecurrentClient(match);
    setSameMacHandlingMode('distinct_new');
    playTone(880, 150);
    showToast(`Coordonnées de ${match.clientName} reportées (${match.ticketCount} dossiers archivés). Choix par défaut : Nouveau Mac (Numéro distinct).`, "success");
  };

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

  // Détection lorsque le NOM + le NUMÉRO DE SÉRIE du MacBook existent déjà dans la base
  const matchingExistingMac = useMemo(() => {
    const currentName = (ticket.client?.name || '').trim().toLowerCase();
    const currentPhone = (ticket.client?.phone || '').replace(/\s+/g, '');
    const currentSn = (ticket.serialNumber || '').trim().toUpperCase();

    if (!currentSn || currentSn.length < 5 || (ticketToEdit && ticketToEdit.id)) {
      return null;
    }

    // 1. Chercher dans les tickets archivés existants
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

    // 2. Ou dans selectedRecurrentClient.uniqueMacs si concordance même Mac
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

  // Handlers pour les propositions utilisateur sur machine existante
  const handleSelectReinterventionSameId = (pastInfo: { ticketId: string; serialNumber: string; macModel?: string; modelNumber?: string }) => {
    setSameMacHandlingMode('reintervention_same_id');
    setFullTicketId(pastInfo.ticketId);
    setTicket(prev => ({
      ...prev,
      isReIntervention: true,
      reInterventionReceiptDate: new Date().toISOString().split('T')[0],
      reInterventionReason: `Réintervention / Retour SAV (S/N: ${pastInfo.serialNumber}, dossier initial #${pastInfo.ticketId})`,
      macModel: pastInfo.macModel || prev.macModel,
      modelNumber: pastInfo.modelNumber || prev.modelNumber,
      serialNumber: pastInfo.serialNumber || prev.serialNumber
    }));
    playTone(700, 120);
    showToast(`🔄 Dossier initial #${pastInfo.ticketId} conservé en Réintervention (Garantie/SAV).`, "success");
  };

  const handleSelectNewServiceSameId = (pastInfo: { ticketId: string; serialNumber: string; macModel?: string; modelNumber?: string }) => {
    setSameMacHandlingMode('new_service_same_id');
    setFullTicketId(pastInfo.ticketId);
    setTicket(prev => ({
      ...prev,
      isReIntervention: false,
      reInterventionReason: `Nouvelle prestation sur même machine (Dossier initial #${pastInfo.ticketId})`,
      macModel: pastInfo.macModel || prev.macModel,
      modelNumber: pastInfo.modelNumber || prev.modelNumber,
      serialNumber: pastInfo.serialNumber || prev.serialNumber
    }));
    playTone(750, 120);
    showToast(`🛠️ Dossier initial #${pastInfo.ticketId} conservé pour une Nouvelle Prestation.`, "success");
  };

  const handleSelectDistinctNewMac = () => {
    setSameMacHandlingMode('distinct_new');
    const targetYear = manualDate ? new Date(manualDate).getFullYear() : undefined;
    const nextDistinctSeq = generateNextTicketSequence(tickets, ticket.client?.isEnterprise || false, targetYear);
    setFullTicketId(nextDistinctSeq);
    setTicket(prev => ({
      ...prev,
      isReIntervention: false,
      reInterventionReason: ''
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

        // Compression performante 1200x1200px @ 0.72 : qualité visuelle nette pour les inscriptions tout en restant ~60-80KB
        const compressed = await compressImageBase64(rawBase64, 1200, 1200, 0.72);
        newCompressed.push(compressed);
      } catch (err) {
        console.error("Erreur lecture photo:", err);
      }
    }

    if (newCompressed.length === 0) return;

    const updated = [...currentImages, ...newCompressed].slice(0, 6);
    setTicket(prev => ({
      ...prev,
      intakeImages: updated
    }));

    showToast(`${newCompressed.length} photo(s) intégrée(s) et optimisée(s) !`, "success");
    playTone(700, 100);

    // Détection automatique intelligente du couvre arrière (peu importe l'ordre des photos)
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
      // Si un index spécifique est ciblé manuellement, on envoie cette image précise ; sinon on envoie toutes les photos pour scan global
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
        const messages: string[] = [];

        // Modèle Apple AXXXX
        if (data.modelNumber && /^A\d{4}$/i.test(data.modelNumber.trim())) {
          const cleanModel = data.modelNumber.trim().toUpperCase();
          updates.modelNumber = cleanModel;
          messages.push(`Modèle ${cleanModel}`);
          detectedCount++;
          
          const found = findMacByModel(cleanModel);
          if (found && !ticket.macModel) {
            updates.macModel = found.name;
          }
        }

        // Numéro de série Apple
        if (data.serialNumber && data.serialNumber.trim().length >= 8) {
          const cleanSerial = data.serialNumber.trim().toUpperCase();
          updates.serialNumber = cleanSerial;
          messages.push(`S/N: ${cleanSerial}`);
          detectedCount++;
        }

        // Code EMC (ex: EMC 3347)
        if (data.emc && data.emc.trim().length > 0) {
          let cleanEmc = data.emc.trim().toUpperCase();
          if (!cleanEmc.startsWith('EMC') && /^\d{4}$/.test(cleanEmc)) {
            cleanEmc = `EMC ${cleanEmc}`;
          }
          updates.emc = cleanEmc;
          messages.push(cleanEmc);
          detectedCount++;
        }

        // Couleur
        if (data.color && (!ticket.macColor || ticket.macColor.trim() === '')) {
          updates.macColor = data.color;
        }

        // Identification de la photo correspondant au Couvre Arrière
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
          const customFields = { ...(ticket.customFields || {}) };
          if (updates.modelNumber) customFields.modelA = updates.modelNumber;
          if (updates.emc) customFields.emc = updates.emc;
          if (updates.serialNumber) customFields.serialNumber = updates.serialNumber;
          updates.customFields = customFields;

          setTicket(prev => ({ 
            ...prev, 
            ...updates,
            customFields: { ...(prev.customFields || {}), ...customFields }
          }));

          const coverNote = targetIdx >= 0 ? ` [Photo #${targetIdx + 1} identifiée comme Couvre Arrière]` : '';
          showToast(`✨ Couvre arrière détecté automatiquement : ${messages.join(' | ')}${coverNote}`, "success");
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
    const currentId = (fullTicketId && fullTicketId.trim()) || ticketToEdit?.id || ticket.id || 'NOUVEAU';
    
    return {
      ...ticket,
      id: currentId,
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
        isEnterprise: ticket.client?.isEnterprise || false,
        customFields: ticket.client?.customFields || {}
      }
    } as RepairTicket;
  };

  const [manualDate, setManualDate] = useState<string>(() => {
    if (ticketToEdit?.createdAt) {
      try {
        const d = new Date(ticketToEdit.createdAt);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch { /* fallback below */ }
    }
    return new Date().toISOString().split('T')[0];
  });

  const foundMacInfo = useMemo(() => {
    if (ticket.modelNumber && ticket.modelNumber.length >= 3) {
      const searchCode = ticket.modelNumber.startsWith('A') ? ticket.modelNumber : `A${ticket.modelNumber}`;
      const found = findMacByModel(searchCode);
      if (found) return found;
    }
    if (ticket.macModel && ticket.macModel.length >= 4) {
      return findMacByModel(ticket.macModel);
    }
    return null;
  }, [ticket.modelNumber, ticket.macModel]);

  const handleApplyDetectedModel = () => {
    if (foundMacInfo) {
      setTicket(prev => ({
        ...prev,
        macModel: foundMacInfo.name,
        modelNumber: prev.modelNumber || foundMacInfo.model_number,
      }));
      playTone(880, 50);
    }
  };

  const availableColors = useMemo(() => {
    return foundMacInfo ? foundMacInfo.colors : [];
  }, [foundMacInfo]);

  const existingTechnicians = useMemo(() => {
    const techsMap = new Map<string, string>();
    tickets.forEach(t => {
      if (t.client?.clientType === 'subcontractor' && t.client?.technicianName) {
        const name = t.client.technicianName.trim().toUpperCase();
        const phone = t.client.technicianPhone?.trim() || '';
        if (!techsMap.has(name) || (phone && !techsMap.get(name))) {
          techsMap.set(name, phone);
        }
      }
    });
    return Array.from(techsMap.entries()).map(([name, phone]) => ({ name, phone }));
  }, [tickets]);

  useEffect(() => {
    if (ticketToEdit) {
      setFullTicketId(ticketToEdit.id);
    } else if (!isManualEdit) {
      const targetYear = manualDate ? new Date(manualDate).getFullYear() : undefined;
      const nextSeq = generateNextTicketSequence(tickets, false, targetYear);
      setFullTicketId(nextSeq);
    }
  }, [ticketToEdit, tickets, isManualEdit, manualDate]);

  const isDuplicateId = useMemo(() => {
      const cleanInput = (fullTicketId || '').trim().toUpperCase();
      const currentOriginalId = (ticketToEdit?.id || '').trim().toUpperCase();
      if (!cleanInput) return false;
      if (ticketToEdit && cleanInput === currentOriginalId) return false;
      return tickets.some(t => {
          const tid = (t.id || '').trim().toUpperCase();
          if (ticketToEdit && tid === currentOriginalId) return false;
          return tid === cleanInput;
      });
  }, [fullTicketId, tickets, ticketToEdit]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = [...(ticket.attachments || [])];
    const fileList = Array.from(files) as File[];
    for (const file of fileList) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => { reader.onload = (ev) => resolve(ev.target?.result as string); });
        reader.readAsDataURL(file);
        let data = await base64Promise;
        let type: Attachment['type'] = 'image';
        if (file.type.includes('video')) type = 'video';
        else if (file.type.includes('pdf')) type = 'pdf';
        else if (file.type.includes('audio')) type = 'audio';

        if (type === 'image') {
            data = await compressImageBase64(data);
        }

        newAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            type,
            data,
            createdAt: new Date().toISOString()
        });
    }
    setTicket(p => ({ ...p, attachments: newAttachments }));
  };

  const removeAttachment = (id: string) => { setTicket(p => ({ ...p, attachments: p.attachments?.filter(a => a.id !== id) })); };

  const matchingCommandes = useMemo(() => {
    if (!ticket.client?.name && !ticket.client?.phone && !ticket.macModel) return [];
    return (commandes || []).filter(c => {
        if (c.isLinkedToTicket) return false;
        
        const nameMatch = ticket.client?.name && c.clientName && c.clientName.toLowerCase().includes(ticket.client.name.toLowerCase());
        const phoneMatch = ticket.client?.phone && c.clientPhone && c.clientPhone.replace(/\s+/g, '') === ticket.client.phone.replace(/\s+/g, '');
        const modelMatch = ticket.macModel && c.macModel && c.macModel.toLowerCase().includes(ticket.macModel.toLowerCase());
        
        return nameMatch || phoneMatch || modelMatch;
    });
  }, [commandes, ticket.client?.name, ticket.client?.phone, ticket.macModel]);

  const handleAttachCommande = (cmd: Commande) => {
      setTicket(prev => {
          const importedLines = (cmd.items || []).map((item: { description?: string, designation?: string, quantity?: number, unitPrice?: number, price?: number }, idx: number) => ({
              id: `line-import-${Date.now()}-${idx}`,
              fiche_id: fullTicketId,
              type_ligne: 'article_hors_stock' as const,
              article_stock_id: null,
              designation: `[PIÈCE CMD #${cmd.numero}] ${item.description || item.designation}`,
              modele_compatible: cmd.macModel,
              categorie: 'Pièce',
              quantite: item.quantity || 1,
              prix_unitaire_standard: item.unitPrice || item.price || 0,
              reduction_active: false,
              reduction_type: null,
              reduction_valeur: 0,
              prix_unitaire_final: item.unitPrice || item.price || 0,
              statut_ligne: cmd.status === 'Reçu' ? ('utilise' as const) : ('prevu' as const),
          }));

          const currentLines = prev.ligneVentes || [];
          const filteredLines = currentLines.filter(l => !l.designation.includes(`CMD #${cmd.numero}`));
          const updatedLines = [...filteredLines, ...importedLines];
          const syncedServices = syncSalesLinesToServices(updatedLines);

          return {
              ...prev,
              isWaitingForOrderedPart: true,
              isMountingDay: false,
              status: RepairStatus.EN_ATTENTE_DE_PIECES,
              linkedCommandeId: cmd.id,
              linkedCommandeNumber: cmd.numero,
              ligneVentes: updatedLines,
              services: syncedServices,
              costs: {
                  ...prev.costs!,
                  advance: cmd.advance
              }
          };
      });
      showToast(`Commande #${cmd.numero} rattachée avec succès !`, "success");
  };

  const handleDetachCommande = () => {
      const cmdNum = ticket.linkedCommandeNumber;
      setTicket(prev => {
          const currentLines = prev.ligneVentes || [];
          const filteredLines = currentLines.filter(l => !l.designation.includes(`CMD #${cmdNum}`));
          const syncedServices = syncSalesLinesToServices(filteredLines);

          return {
              ...prev,
              linkedCommandeId: undefined,
              linkedCommandeNumber: undefined,
              isWaitingForOrderedPart: false,
              isMountingDay: false,
              rendezVousDate: undefined,
              rendezVousTime: undefined,
              ligneVentes: filteredLines,
              services: syncedServices,
              costs: {
                  ...prev.costs!,
                  advance: 0
              }
          };
      });
      showToast(`Commande dissociée de la fiche.`, "info");
  };

  const handleSave = async (action: 'new' | 'close' | 'print') => {
      if (isDuplicateId) return showToast("Cet ID de fiche existe déjà.", "error");
      const clientName = ticket.client?.name?.trim();
      const clientPhone = ticket.client?.phone?.trim();
      if (!clientName) return showToast("Nom du client requis.", "error");
      if (!ticketToEdit && !clientPhone) return showToast("Numéro de téléphone requis pour un nouveau dossier.", "error");
      
      setIsSaving(true);
      try {
          const signature = signaturePadRef.current?.getSignature() || ticket.clientSignature;
          const servicesSum = (ticket.services && ticket.services.length > 0)
              ? ticket.services.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
              : (Number(ticket.costs?.repair) || 0);

          // Assurer un identifiant officiel valide et non vide
          let cleanTicketId = fullTicketId.trim().toUpperCase();
          if (!cleanTicketId || (!ticketToEdit && isFallbackTicketId(cleanTicketId))) {
              const targetYear = manualDate ? new Date(manualDate).getFullYear() : undefined;
              cleanTicketId = generateNextTicketSequence(tickets, ticket.client?.isEnterprise || false, targetYear);
              setFullTicketId(cleanTicketId);
          }

          let isoCreatedAt = new Date().toISOString();
          if (manualDate) {
              try {
                  const now = new Date();
                  const timePart = (ticketToEdit?.createdAt ? new Date(ticketToEdit.createdAt).toTimeString() : now.toTimeString()).split(' ')[0];
                  const d = new Date(`${manualDate}T${timePart}`);
                  if (!isNaN(d.getTime())) isoCreatedAt = d.toISOString();
                  else if (ticketToEdit?.createdAt) isoCreatedAt = ticketToEdit.createdAt;
              } catch {
                  if (ticketToEdit?.createdAt) isoCreatedAt = ticketToEdit.createdAt;
              }
          } else if (ticketToEdit?.createdAt) {
              try {
                  const d = new Date(ticketToEdit.createdAt);
                  if (!isNaN(d.getTime())) isoCreatedAt = d.toISOString();
              } catch { /* keep current */ }
          }

          const finalTicket = {
              ...ticket,
              id: cleanTicketId,
              costs: {
                  ...(ticket.costs || { diagnostic: 5000, repair: 0, advance: 0 }),
                  repair: servicesSum
              },
              createdAt: isoCreatedAt,
              updatedAt: new Date().toISOString(),
              clientSignature: signature,
              cancellationReturnDate: ticket.isReopenedAfterCancellation && !ticket.cancellationReturnDate
                  ? new Date().toISOString().split('T')[0]
                  : ticket.cancellationReturnDate,
              reInterventionReceiptDate: ticket.isReIntervention && !ticket.reInterventionReceiptDate
                  ? new Date().toISOString().split('T')[0]
                  : ticket.reInterventionReceiptDate
          };

          const generalHistoryEntry = {
              timestamp: new Date().toISOString(),
              user: role,
              action: ticketToEdit 
                  ? `Modification de la fiche (Statut : ${ticket.status}${ticket.rendezVousDate ? `, Rdv planifié le ${new Date(ticket.rendezVousDate).toLocaleDateString('fr-FR')} à ${ticket.rendezVousTime || '10:00'}` : ''})` 
                  : `Création de la fiche de réception`
          };

          finalTicket.history = [
              ...(finalTicket.history || []),
              generalHistoryEntry
          ];
          
          if (ticket.isReIntervention && !ticketToEdit?.isReIntervention) {
              finalTicket.history.push({
                  timestamp: new Date().toISOString(),
                  user: role,
                  action: `Marqué comme RÉ-INTERVENTION / RETOUR SAV. Motif: ${ticket.reInterventionReason || 'Non spécifié'}`
              });
          }

          if (ticket.isReopenedAfterCancellation && !ticketToEdit?.isReopenedAfterCancellation) {
              finalTicket.history.push({
                  timestamp: new Date().toISOString(),
                  user: role,
                  action: `Marqué comme RETOUR APRÈS ANNULATION. Appareil retourné le ${new Date(ticket.cancellationReturnDate || new Date().toISOString().split('T')[0]).toLocaleDateString('fr-FR')}. Notes: ${ticket.cancellationReturnNotes || 'Non spécifié'}`
              });
          }
          
          await onSave(finalTicket, action, ticketToEdit?.id);
          showToast(`Fiche ${fullTicketId} enregistrée avec succès`, 'success');

          // Mettre à jour la commande liée
          if (finalTicket.linkedCommandeId) {
              const selectedCmd = commandes.find(c => c.id === finalTicket.linkedCommandeId);
              if (selectedCmd) {
                  await updateCommande({
                      ...selectedCmd,
                      isLinkedToTicket: true,
                      linkedTicketId: finalTicket.id,
                      status: finalTicket.isMountingDay ? 'Payé' : selectedCmd.status
                  });
              }
          }
          
          // Détacher l'ancienne commande si elle a été changée
          if (ticketToEdit?.linkedCommandeId && ticketToEdit.linkedCommandeId !== finalTicket.linkedCommandeId) {
              const oldCmd = commandes.find(c => c.id === ticketToEdit.linkedCommandeId);
              if (oldCmd) {
                  await updateCommande({
                      ...oldCmd,
                      isLinkedToTicket: false,
                      linkedTicketId: undefined
                  });
              }
          }

          // Planifier automatiquement le rendez-vous si date de rdv présente
          if (finalTicket.rendezVousDate) {
              await addAppointment({
                  date: finalTicket.rendezVousDate,
                  time: finalTicket.rendezVousTime || '10:00',
                  clientName: finalTicket.client?.name || 'Client',
                  clientPhone: finalTicket.client?.phone || '',
                  reason: finalTicket.isMountingDay ? 'Récupération' : 'Diagnostic',
                  notes: `Rendez-vous de montage suite à la commande de pièce #${finalTicket.linkedCommandeNumber || ''}. Fiche #${finalTicket.id}`,
                  ticketId: finalTicket.id
              });
              showToast(`Rendez-vous de montage planifié au ${new Date(finalTicket.rendezVousDate).toLocaleDateString('fr-FR')} à ${finalTicket.rendezVousTime || '10:00'}`, 'success');
          }

          await learnFromData(finalTicket, { 
              problemDescription: 'problem_description',
              macModel: 'mac_models',
              macColor: 'mac_colors',
              bagDescription: 'bag_descriptions',
              caseColor: 'case_colors'
          });

          playTone(880, 150);
      } catch (err) {
          console.error(err);
      } finally {
          setIsSaving(false);
      }
  };

  const totalCost = (Number(ticket.costs?.diagnostic) || 0) + (
    ticket.services && ticket.services.length > 0
      ? ticket.services.reduce((sum, s) => sum + (Number(s?.price) || 0), 0)
      : (Number(ticket.costs?.repair) || 0)
  );

  const checkboxClass = "w-6 h-6 rounded border-white/10 bg-black/40 accent-apple-blue transition-all cursor-pointer";
  const labelSubStyle = "text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2";

  return (
    <div className="space-y-6 animate-fade-in pb-32">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 bg-apple-surface p-4 md:p-6 rounded-2xl md:rounded-[32px] sticky top-20 z-40 border border-white/10 glass shadow-2xl transition-all">
            <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                <div className="p-2 md:p-3 bg-apple-blue rounded-xl md:rounded-2xl shadow-lg shrink-0">
                    <MacbookIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-sm md:text-xl font-black text-white uppercase tracking-tighter italic truncate">Réception MacBook</h2>
                    <p className="text-[8px] md:text-[10px] text-apple-muted font-bold uppercase tracking-widest truncate">Atelier TGS - Côte d'Ivoire</p>
                </div>
            </div>
            <div className="hidden md:flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                <button type="button" onClick={() => setIsPreviewOpen(true)} className="px-4 py-2 md:px-6 md:py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all shrink-0 flex items-center gap-1.5 shadow-xl shadow-purple-900/40">
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    <span>Export PDF Rapide</span>
                </button>
                <button onClick={onCancel} className="px-4 py-2 md:px-6 md:py-3 text-slate-400 hover:text-white uppercase font-black text-[9px] md:text-[10px] tracking-widest transition-colors shrink-0">Annuler</button>
                <button onClick={() => handleSave('close')} disabled={isSaving || isDuplicateId} className="px-4 py-2 md:px-8 md:py-3 bg-white text-black rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all shadow-xl disabled:opacity-50 shrink-0">Enregistrer</button>
                <button onClick={() => handleSave('print')} disabled={isSaving || isDuplicateId} className="px-4 py-2 md:px-8 md:py-3 bg-apple-blue text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 shrink-0">Enr. & Imprimer</button>
            </div>
        </div>

        {/* Floating Action Bar - Fixed for all devices */}
        <div className="fixed bottom-0 left-0 right-0 md:bottom-8 md:right-8 md:left-auto p-4 md:p-0 bg-black/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-t md:border-none border-white/10 z-[110] flex flex-row md:flex-col gap-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:pb-0 justify-center md:justify-end pointer-events-auto">
            <button 
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-purple-900/40 group min-h-[48px] md:min-w-[180px] active:scale-95"
            >
                <DocumentArrowDownIcon className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                <span>PDF Rapide</span>
            </button>
            <button 
                onClick={() => handleSave('close')}
                disabled={isSaving || isDuplicateId}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-white text-black rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-white/10 group min-h-[48px] md:min-w-[180px] active:scale-95 disabled:opacity-50"
            >
                <ArrowPathIcon className={`w-5 h-5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>Enregistrer</span>
            </button>
            <button 
                onClick={() => handleSave('print')}
                disabled={isSaving || isDuplicateId}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-apple-blue text-white rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 group min-h-[48px] md:min-w-[180px] active:scale-95 disabled:opacity-50"
            >
                <PrinterIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Enr. & Imprimer</span>
            </button>
        </div>

        <div className={`grid grid-cols-1 ${isTouch ? 'gap-6' : 'lg:grid-cols-12 gap-8'}`}>
            <div className={`${isTouch ? 'w-full space-y-6' : 'lg:col-span-8 space-y-8'}`}>
                {/* DOSSIER & DATE */}
                {ticketToEdit && isFallbackTicketId(ticketToEdit.id) && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="text-xs font-black text-amber-300 uppercase tracking-wide">Numéro provisoire détecté ({ticketToEdit.id})</p>
                                <p className="text-[11px] text-amber-200/80">Ce dossier a été créé avec un identifiant temporaire. Vous pouvez lui attribuer un numéro séquentiel officiel ({new Date().getFullYear().toString().slice(-2)}-RM-XXXX).</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const nextOfficial = generateNextTicketSequence(tickets, ticket.client?.isEnterprise || false);
                                setFullTicketId(nextOfficial);
                                setIsManualEdit(true);
                                playTone(880, 50);
                                showToast(`Nouveau numéro officiel attribué : ${nextOfficial}`, "info");
                            }}
                            className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shrink-0 self-start sm:self-auto"
                        >
                            Attribuer N° officiel
                        </button>
                    </div>
                )}
                <div className="apple-card p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <div className="flex items-center justify-between mb-2 ml-1">
                            <label className="block text-[10px] font-black text-apple-blue uppercase tracking-widest">Numéro de Fiche</label>
                            <button
                                type="button"
                                onClick={() => {
                                    const targetYear = manualDate ? new Date(manualDate).getFullYear() : undefined;
                                    const nextId = generateNextTicketSequence(tickets, ticket.client?.isEnterprise || false, targetYear);
                                    setFullTicketId(nextId);
                                    setIsManualEdit(false);
                                    playTone(880, 50);
                                    showToast(`Numéro automatique régénéré : ${nextId}`, "info");
                                }}
                                className="text-[9px] font-bold text-slate-400 hover:text-apple-blue flex items-center gap-1 transition-colors"
                                title="Calculer le prochain numéro séquentiel disponible"
                            >
                                <ArrowPathIcon className="w-3 h-3" /> N° auto
                            </button>
                        </div>
                        <div className={`flex items-center bg-black/40 border rounded-xl px-4 py-2.5 transition-all ${isDuplicateId ? 'border-red-500' : 'border-white/10 focus-within:border-apple-blue'}`}>
                            <input 
                                type="text" 
                                value={fullTicketId} 
                                onChange={(e) => { setFullTicketId(e.target.value.toUpperCase()); setIsManualEdit(true); }} 
                                placeholder="ex: 26-RM-0001"
                                className="bg-transparent border-none outline-none font-mono font-black text-white text-lg w-full" 
                            />
                            {isDuplicateId && <span className="ml-2 text-[9px] font-black text-red-500 uppercase animate-pulse">Doublon</span>}
                            {isFallbackTicketId(fullTicketId) && !isDuplicateId && (
                                <span className="ml-2 text-[8px] font-black text-amber-400 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">
                                    Provisoire
                                </span>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-apple-blue uppercase tracking-widest mb-2 ml-1">Date de dépôt</label>
                        <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-apple-blue transition-all">
                            <CalendarDaysIcon className="w-5 h-5 text-apple-muted" />
                            <input 
                                type="date" 
                                value={manualDate} 
                                onChange={e => setManualDate(e.target.value)} 
                                className="bg-transparent border-none outline-none text-white text-sm w-full font-mono font-bold" 
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 justify-end">
                        <label className="flex items-center gap-3 p-3 bg-red-600/5 border border-red-500/20 rounded-xl cursor-pointer hover:bg-red-600/10 transition-all">
                            <input 
                                type="checkbox" 
                                checked={ticket.isReIntervention} 
                                onChange={e => {
                                    const checked = e.target.checked;
                                    setTicket(prev => ({
                                        ...prev,
                                        isReIntervention: checked,
                                        reInterventionReceiptDate: checked && !prev.reInterventionReceiptDate
                                            ? new Date().toISOString().split('T')[0]
                                            : prev.reInterventionReceiptDate
                                    }));
                                }}
                                className="w-5 h-5 accent-red-600"
                            />
                            <div>
                                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Ré-intervention (SAV)</p>
                                <p className="text-[8px] text-slate-500 font-bold uppercase">Retour SAV / Garantie</p>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-amber-600/5 border border-amber-500/20 rounded-xl cursor-pointer hover:bg-amber-600/10 transition-all">
                            <input 
                                type="checkbox" 
                                checked={ticket.isReopenedAfterCancellation || false} 
                                onChange={e => {
                                    const checked = e.target.checked;
                                    setTicket(prev => ({
                                        ...prev,
                                        isReopenedAfterCancellation: checked,
                                        cancellationReturnDate: checked && !prev.cancellationReturnDate
                                            ? new Date().toISOString().split('T')[0]
                                            : prev.cancellationReturnDate
                                    }));
                                }}
                                className="w-5 h-5 accent-amber-600"
                            />
                            <div>
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Retour après Annulation</p>
                                <p className="text-[8px] text-slate-500 font-bold uppercase">Reprise d'une fiche annulée</p>
                            </div>
                        </label>
                    </div>
                    {/* CHAMP RAISON DU RETOUR SAV (VISIBLE SI COCHÉ) */}
                    {ticket.isReIntervention && (
                        <div className="md:col-span-3 bg-red-950/20 border border-red-500/20 p-5 rounded-2xl space-y-4 animate-slide-up mt-3">
                            <h4 className="text-xs font-black text-red-400 uppercase tracking-wider">Formulaire de Ré-intervention SAV / Garantie</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-red-300 uppercase tracking-widest mb-1.5 ml-1">Date de Réception SAV *</label>
                                    <input 
                                        type="date"
                                        value={ticket.reInterventionReceiptDate || new Date().toISOString().split('T')[0]}
                                        onChange={e => setTicket(p => ({...p, reInterventionReceiptDate: e.target.value}))}
                                        className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all font-mono"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-red-300 uppercase tracking-widest mb-1.5 ml-1">Motif du Retour Déclaré par le Client *</label>
                                    <input 
                                        type="text"
                                        value={ticket.reInterventionReason || ''}
                                        onChange={e => setTicket(p => ({...p, reInterventionReason: e.target.value}))}
                                        placeholder="Ex: L'écran scintille toujours, la batterie ne charge pas..."
                                        className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all"
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-red-300 uppercase tracking-widest mb-1.5 ml-1">Diagnostic SAV & Cause de la Nouvelle Intervention</label>
                                    <textarea 
                                        value={ticket.savDiagnosis || ''}
                                        onChange={e => setTicket(p => ({...p, savDiagnosis: e.target.value}))}
                                        placeholder="Décrivez le diagnostic SAV et la cause de ce retour..."
                                        rows={2}
                                        className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-red-300 uppercase tracking-widest mb-1.5 ml-1">Nouvelle date de RDV</label>
                                    <input 
                                        type="date"
                                        value={ticket.savNewRdvDate || ''}
                                        onChange={e => setTicket(p => ({...p, savNewRdvDate: e.target.value}))}
                                        className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-red-300 uppercase tracking-widest mb-1.5 ml-1">Prochain rendez-vous (Facultatif / Attente de pièce)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="date"
                                            value={ticket.savNextRdvDate || ''}
                                            onChange={e => setTicket(p => ({...p, savNextRdvDate: e.target.value}))}
                                            className="p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all font-mono text-xs w-1/2"
                                        />
                                        <input 
                                            type="text"
                                            value={ticket.savNextRdvNotes || ''}
                                            onChange={e => setTicket(p => ({...p, savNextRdvNotes: e.target.value}))}
                                            placeholder="Ex: Attente écran"
                                            className="p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all text-xs w-1/2"
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-red-300 uppercase tracking-widest mb-1.5 ml-1">Actions Correctives (Technicien)</label>
                                    <textarea 
                                        value={ticket.warrantyInterventionReport || ''}
                                        onChange={e => setTicket(p => ({...p, warrantyInterventionReport: e.target.value}))}
                                        placeholder="Détaillez les actions correctives effectuées pour résoudre le problème..."
                                        rows={3}
                                        className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CHAMP RETOUR APRÈS ANNULATION (VISIBLE SI COCHÉ) */}
                    {ticket.isReopenedAfterCancellation && (
                        <div className="md:col-span-3 bg-amber-950/20 border border-amber-500/20 p-5 rounded-2xl space-y-4 animate-slide-up mt-3">
                            <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">Informations de Retour après Annulation</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1.5 ml-1">Date de Retour de l'appareil *</label>
                                    <input 
                                        type="date"
                                        value={ticket.cancellationReturnDate || new Date().toISOString().split('T')[0]}
                                        onChange={e => setTicket(p => ({...p, cancellationReturnDate: e.target.value}))}
                                        className="w-full p-3 bg-black/40 border border-amber-500/30 rounded-xl text-white outline-none focus:border-amber-500 transition-all font-mono"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1.5 ml-1">Motif / Notes de Retour Déclarées par le Client</label>
                                    <input 
                                        type="text"
                                        value={ticket.cancellationReturnNotes || ''}
                                        onChange={e => setTicket(p => ({...p, cancellationReturnNotes: e.target.value}))}
                                        placeholder="Ex: Le client a changé d'avis et souhaite finalement réparer la machine..."
                                        className="w-full p-3 bg-black/40 border border-amber-500/30 rounded-xl text-white outline-none focus:border-amber-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* PROPRIÉTAIRE */}
                    <div className="apple-card p-8">
                        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                            <h3 className="text-[10px] font-black text-apple-blue uppercase tracking-[0.2em] flex items-center gap-3"><UserIcon className="w-5 h-5"/> Propriétaire</h3>
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                (!ticket.client?.clientType || ticket.client?.clientType === 'direct')
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                                {(!ticket.client?.clientType || ticket.client?.clientType === 'direct') ? 'Client Direct' : 'Sous-traitance'}
                            </span>
                        </div>
                        <div className="space-y-5">
                            {/* Toggle Type de Client */}
                            <div className="space-y-1.5">
                                <label className="block text-[9px] font-black text-slate-500 uppercase ml-1">Type de relation *</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, client: {...p.client!, clientType: 'direct'}}))}
                                        className={`flex-1 py-2.5 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                            (!ticket.client?.clientType || ticket.client?.clientType === 'direct')
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-black shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                                                : 'bg-black/20 border-white/5 text-slate-500 hover:text-slate-400 hover:bg-black/30'
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Client direct
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, client: {...p.client!, clientType: 'subcontractor'}}))}
                                        className={`flex-1 py-2.5 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                            ticket.client?.clientType === 'subcontractor'
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-black shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                                                : 'bg-black/20 border-white/5 text-slate-500 hover:text-slate-400 hover:bg-black/30'
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                        Sous-traitance
                                    </button>
                                </div>
                            </div>

                            {/* Section Sous-traitance Technicien */}
                            {ticket.client?.clientType === 'subcontractor' && (
                                <div className="p-4 bg-amber-500/[0.03] border border-amber-500/20 rounded-2xl space-y-4">
                                    <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                                        Configuration Sous-traitance
                                    </h4>
                                    
                                    {/* Choisir Technicien */}
                                    <div className="space-y-1">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase ml-1">Sélectionner Technicien *</label>
                                        <select
                                            value={ticket.client?.technicianName || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '__NEW__') {
                                                    setTicket(p => ({
                                                        ...p,
                                                        client: {
                                                            ...p.client!,
                                                            technicianName: '',
                                                            technicianPhone: ''
                                                        }
                                                    }));
                                                } else {
                                                    const found = existingTechnicians.find(t => t.name === val);
                                                    setTicket(p => ({
                                                        ...p,
                                                        client: {
                                                            ...p.client!,
                                                            technicianName: val,
                                                            technicianPhone: found?.phone || ''
                                                        }
                                                    }));
                                                }
                                            }}
                                            className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-amber-500"
                                        >
                                            <option value="" className="bg-zinc-900 text-slate-500">Choisir parmi les techniciens existants...</option>
                                            {existingTechnicians.map(tech => (
                                                <option key={tech.name} value={tech.name} className="bg-zinc-900 text-white font-bold">
                                                    {tech.name} {tech.phone ? `(${tech.phone})` : ''}
                                                </option>
                                            ))}
                                            <option value="__NEW__" className="bg-zinc-900 text-amber-400 font-black">+ Créer un nouveau profil...</option>
                                        </select>
                                    </div>

                                    {/* Saisie Technicien */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-black text-slate-400 uppercase ml-1 mb-1">Nom Technicien *</label>
                                            <input
                                                placeholder="NOM DE L'ENTREPRISE OU DU TECH"
                                                value={ticket.client?.technicianName || ''}
                                                onChange={e => setTicket(p => ({
                                                    ...p,
                                                    client: {
                                                        ...p.client!,
                                                        technicianName: e.target.value.toUpperCase()
                                                    }
                                                }))}
                                                className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black text-slate-400 uppercase ml-1 mb-1">Téléphone Technicien</label>
                                            <input
                                                placeholder="07 XX XX XX XX"
                                                value={ticket.client?.technicianPhone || ''}
                                                onChange={e => setTicket(p => ({
                                                    ...p,
                                                    client: {
                                                        ...p.client!,
                                                        technicianPhone: e.target.value
                                                    }
                                                }))}
                                                className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white font-mono font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
                                            />
                                        </div>
                                    </div>

                                    {/* Client Final / D'origine */}
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase ml-1 mb-1">Nom du client final / Client d'origine (Optionnel)</label>
                                        <input
                                            placeholder="Ex: Machine de M. Coulibaly"
                                            value={ticket.client?.finalClientName || ''}
                                            onChange={e => setTicket(p => ({
                                                ...p,
                                                client: {
                                                    ...p.client!,
                                                    finalClientName: e.target.value
                                                }
                                            }))}
                                            className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
                                        />
                                    </div>

                                    {/* Problème ou conflit rencontré */}
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase ml-1 mb-1">Incident ou conflit documenté (Optionnel)</label>
                                        <textarea
                                            placeholder="Décrivez tout incident, retard de paiement ou désaccord sur ce dossier..."
                                            value={ticket.subcontractorIncident || ''}
                                            onChange={e => setTicket(p => ({
                                                ...p,
                                                subcontractorIncident: e.target.value
                                            }))}
                                            rows={2}
                                            className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 ml-1">
                                    {ticket.client?.clientType === 'subcontractor' ? "Nom du contact principal pour facturation/SMS *" : "Nom complet *"}
                                </label>
                                <input placeholder="NOM ET PRÉNOM" value={ticket.client?.name} onChange={e => setTicket(p => ({...p, client: {...p.client!, name: e.target.value.toUpperCase()}}))} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-apple-blue transition-all" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 ml-1">Numéro WhatsApp *</label>
                                    <input placeholder="07 XX XX XX XX" value={ticket.client?.phone} onChange={e => setTicket(p => ({...p, client: {...p.client!, phone: e.target.value}}))} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-mono font-bold outline-none focus:border-apple-blue transition-all" />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 ml-1">Numéro pour SMS (facultatif)</label>
                                    <div className="flex items-center gap-2">
                                        {!ticket.client?.useWhatsAppForSms && (
                                            <input 
                                                placeholder="07 XX XX XX XX" 
                                                value={ticket.client?.smsPhone || ''} 
                                                onChange={e => setTicket(p => ({...p, client: {...p.client!, smsPhone: e.target.value}}))} 
                                                className="flex-1 p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-mono font-bold outline-none focus:border-apple-blue transition-all" 
                                            />
                                        )}
                                        <label className={`flex items-center gap-2 p-3 ${ticket.client?.useWhatsAppForSms ? 'bg-emerald-500/10 border-emerald-500/30 font-black' : 'bg-black/20 border-white/5'} border rounded-xl cursor-pointer transition-all flex-1`}>
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
                                                className="w-4 h-4 accent-emerald-500"
                                            />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">SMS sur WhatsApp</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* BANNIÈRE DE CONFIRMATION SI CLIENT RÉCURRENT DÉJÀ SÉLECTIONNÉ */}
                            {selectedRecurrentClient && (
                                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">👤</span>
                                        <span className="text-xs font-black text-blue-300 uppercase">Client Récurrent :</span>
                                        <span className="text-xs font-bold text-white">{selectedRecurrentClient.clientName}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                            {selectedRecurrentClient.ticketCount} machines enregistrées
                                        </span>
                                        {selectedRecurrentClient.isSubcontractor && (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                ⚡ Sous-traitant Partenaire (Diag: 0 F CFA)
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

                            {/* PROMPT CLIENT RÉCURRENT (RÈGLE STRICTE UTILISATEUR : AU MOINS 2 MACHINES ENREGISTRÉES) */}
                            {matchingRecurrentClients.length > 0 && !selectedRecurrentClient && (
                                <div className="p-4 bg-gradient-to-r from-blue-950/50 via-indigo-950/40 to-purple-950/40 border border-blue-500/40 rounded-2xl space-y-3 animate-slide-up shadow-xl">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">❓</span>
                                            <div>
                                                <p className="text-xs font-black uppercase text-blue-300 tracking-wider m-0">
                                                    S'agit-il de la même personne déjà enregistrée chez nous ?
                                                </p>
                                                <p className="text-[11px] text-zinc-300 mt-0.5">
                                                    Ce nom ou contact a été enregistré au moins 2 fois dans nos registres ({matchingRecurrentClients[0].ticketCount} machines). Vous pouvez reporter ses informations en un clic.
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
                                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-black/50 hover:bg-black/70 border border-white/10 hover:border-blue-500/50 rounded-xl transition-all"
                                            >
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs font-black text-white">{match.clientName}</span>
                                                        <span className="text-[11px] font-mono text-zinc-300 font-bold">{match.phone}</span>
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                            {match.ticketCount} dossiers
                                                        </span>
                                                        {match.isSubcontractor && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                                ⚡ Sous-traitant Partenaire (Diagnostic Offert)
                                                            </span>
                                                        )}
                                                    </div>
                                                    {match.uniqueMacs.length > 0 && (
                                                        <p className="text-[10px] text-zinc-400 mt-1">
                                                            Machines connues : {match.uniqueMacs.map(m => m.macModel || m.modelNumber || m.serialNumber).filter(Boolean).join(' • ')}
                                                        </p>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectRecurrentClient(match)}
                                                    className="px-3.5 py-2 bg-apple-blue hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <span>✓ Oui, reporter nom & numéro</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* NOUVEAU : MODE DE RÉCEPTION DE L'ORDINATEUR (DÉPÔT ATELIER VS YANGO) */}
                            <div className="pt-2">
                                <ReceptionModeField
                                    receptionMode={ticket.receptionMode || 'depot_atelier'}
                                    yangoDetails={ticket.yangoDetails}
                                    onChangeMode={(mode) => setTicket(p => ({ ...p, receptionMode: mode }))}
                                    onChangeYangoDetails={(details) => setTicket(p => ({ ...p, yangoDetails: details }))}
                                    clientName={ticket.client?.name}
                                    clientPhone={ticket.client?.phone}
                                />
                            </div>

                            {/* SECTION PHOTOS DE L'APPAREIL & IDENTIFICATION PHYSIQUE */}
                            <div className="pt-4 border-t border-white/5 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <label className="text-[10px] font-black text-apple-blue uppercase tracking-widest flex items-center gap-2">
                                            <CameraIcon className="w-4 h-4 text-apple-blue" />
                                            Photos de l'appareil (Max 6)
                                        </label>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                            Face fermée, face ouverte et coque arrière avec N° de série et Modèle
                                        </p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/5 border border-white/10 text-slate-300 self-start sm:self-auto">
                                        {(ticket.intakeImages?.length || 0)} / 6
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
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        disabled={(ticket.intakeImages?.length || 0) >= 6}
                                        className="flex-1 min-w-[130px] px-3 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30"
                                        title="Ouvre directement la caméra sur tablette iPad, Android ou smartphone"
                                    >
                                        <CameraIcon className="w-4 h-4" />
                                        Prendre photo
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => galleryInputRef.current?.click()}
                                        disabled={(ticket.intakeImages?.length || 0) >= 6}
                                        className="flex-1 min-w-[130px] px-3 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-200 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                                        title="Importer depuis la galerie photos ou les fichiers"
                                    >
                                        <PhotoIcon className="w-4 h-4 text-slate-400" />
                                        Parcourir / Galerie
                                    </button>
                                </div>

                                {isAnalyzingPhoto && (
                                    <div className="p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl flex items-center gap-3 animate-pulse text-blue-300 text-xs font-bold">
                                        <SparklesIcon className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                                        <span>Détection automatique en cours : analyse du couvre arrière (Modèle AXXXX, Numéro de série et EMC peu importe l'ordre)...</span>
                                    </div>
                                )}

                                {/* Bandeau récapitulatif Couvre Arrière détecté */}
                                {ticket.backCoverImage && (
                                    <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-teal-950/40 border border-emerald-500/40 rounded-xl flex flex-wrap items-center justify-between gap-2 text-emerald-300 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">🛡️</span>
                                            <span className="font-bold">
                                                Couvre arrière identifié et intégré à la fiche numérique !
                                                {ticket.modelNumber ? ` · Modèle: ${ticket.modelNumber}` : ''}
                                                {ticket.serialNumber ? ` · S/N: ${ticket.serialNumber}` : ''}
                                                {ticket.emc ? ` · ${ticket.emc}` : ''}
                                            </span>
                                        </div>
                                        <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/50 rounded font-black text-[9px] uppercase tracking-wider text-emerald-200">
                                            ✓ Zone Renseignée
                                        </span>
                                    </div>
                                )}

                                {/* Grille des photos enregistrées */}
                                {(ticket.intakeImages && ticket.intakeImages.length > 0) && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
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

                                                    <div className={`p-1.5 flex items-center justify-between gap-1 text-[8.5px] ${isBackCover ? 'bg-emerald-950/80 border-t border-emerald-500/30' : 'bg-zinc-900/90'}`}>
                                                        <span className={`font-bold truncate ${isBackCover ? 'text-emerald-300 font-black' : 'text-slate-300'}`} title={label}>
                                                            {label}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); autoDetectBackCoverAndDeviceInfo(ticket.intakeImages || [], idx); }}
                                                                className={`p-1 rounded transition-colors ${
                                                                    isBackCover 
                                                                        ? 'text-emerald-300 hover:text-white hover:bg-emerald-600/40' 
                                                                        : 'text-blue-400 hover:text-white hover:bg-blue-600/30'
                                                                }`}
                                                                title="Analyser cette photo pour détecter le couvre arrière, modèle, série et EMC"
                                                            >
                                                                <SparklesIcon className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveIntakeImage(idx); }}
                                                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded transition-colors"
                                                                title="Supprimer cette photo"
                                                            >
                                                                <TrashIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* APPAREIL AVEC DÉTECTION AXXXX */}
                    <div className="apple-card p-8">
                        <h3 className="text-[10px] font-black text-apple-blue uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><MacbookIcon className="w-5 h-5"/> Appareil</h3>
                        <div className="space-y-5">
                            {/* PROPOSITION LORSQUE LE NOM + NUMÉRO DE SÉRIE DU MACBOOK EXISTENT DÉJÀ */}
                            {matchingExistingMac && (
                                <div className="p-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border-2 border-blue-500/40 rounded-2xl space-y-3.5 animate-slide-up shadow-xl">
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xl">💻</span>
                                            <div>
                                                <h4 className="text-xs font-black text-white uppercase tracking-wider m-0">
                                                    Machine déjà enregistrée pour ce client !
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
                                                    Nouvelle prise en charge indépendante avec numéro séquentiel propre.
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
                                                    Retour SAV / Garantie en conservant l'identifiant initial du dossier.
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
                                                    Nouvelle intervention / devis sur la même machine sous le même numéro.
                                                </p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* BANNIÈRE PAR DÉFAUT : NOUVEAU MAC POUR CE CLIENT (NUMÉRO DISTINCT) */}
                            {sameMacHandlingMode === 'distinct_new' && (
                                <div className="p-3.5 bg-gradient-to-r from-emerald-950/30 to-zinc-900 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-base">✨</span>
                                        <div>
                                            <p className="text-xs font-black text-emerald-400 uppercase tracking-wider m-0">
                                                Nouveau Mac pour ce client (Numéro distinct)
                                            </p>
                                            <p className="text-[10px] text-zinc-400 mt-0.5">
                                                Cette machine n'a pas été identifiée parmi les précédentes. Photos de réception et prise en charge standard actives.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase border border-emerald-500/30 shrink-0">
                                        Choix par défaut
                                    </span>
                                </div>
                            )}

                            {/* SÉLECTEUR DE PARC : MACHINES PRÉCÉDEMMENT ENREGISTRÉES POUR CE CLIENT */}
                            {selectedRecurrentClient && selectedRecurrentClient.uniqueMacs.length > 0 && (
                                <div className="p-4 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs">💻</span>
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                                                Parc de machines enregistrées chez nous ({selectedRecurrentClient.uniqueMacs.length} Mac{selectedRecurrentClient.uniqueMacs.length > 1 ? 's' : ''})
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-zinc-500">
                                            Cliquez pour basculer en réintervention ou configurez un nouveau Mac
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {selectedRecurrentClient.uniqueMacs.map((pastMac, idx) => {
                                            const isSelected = (ticket.serialNumber && ticket.serialNumber === pastMac.serialNumber) ||
                                                (ticket.modelNumber && ticket.modelNumber === pastMac.modelNumber && ticket.isReIntervention);
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
                                                                <span className="text-[9px] font-mono text-blue-400 font-bold">
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
                                            className="text-[10px] font-black uppercase tracking-wider text-apple-blue hover:text-blue-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>✨ C'est un Nouveau Mac pour ce client (Nouvelle identification & photos)</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 ml-1">Model Number (A2485)</label>
                                    <div className="relative">
                                        <input 
                                            placeholder="ex: A2485" 
                                            value={ticket.modelNumber} 
                                            onChange={e => setTicket(p => ({ ...p, modelNumber: e.target.value.toUpperCase() }))}
                                            className={`w-full p-3 bg-black/40 border rounded-xl text-sm text-white font-black outline-none transition-all placeholder:text-slate-700 ${foundMacInfo ? 'border-green-500/50' : 'border-white/10 focus:border-apple-blue'}`} 
                                        />
                                        {foundMacInfo && (
                                            <div className="absolute right-3 top-3 animate-fade-in">
                                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {foundMacInfo && (
                                        <div className="mt-2 animate-slide-up">
                                            <button 
                                                type="button"
                                                onClick={handleApplyDetectedModel}
                                                className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-500/30 transition-all group"
                                            >
                                                <SparklesIcon className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                                                Utiliser : {foundMacInfo.name}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1 ml-1">
                                        <label className="block text-[9px] font-black text-slate-500 uppercase">Couleur</label>
                                        {ticket.macColor && (
                                            <span className="text-[9px] font-bold text-blue-400">
                                                {ticket.macColor}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <select 
                                            value={ticket.macColor} 
                                            onChange={e => setTicket(p => ({...p, macColor: e.target.value}))}
                                            className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-apple-blue transition-all appearance-none"
                                        >
                                            <option value="">-- Choisir --</option>
                                            {availableColors.length > 0 ? (
                                                availableColors.map(c => <option key={c} value={c}>{c}</option>)
                                            ) : (
                                                <>
                                                    <option value="Silver">Silver</option>
                                                    <option value="Blush">Blush</option>
                                                    <option value="Citrus">Citrus</option>
                                                    <option value="Indigo">Indigo</option>
                                                    <option value="Gris sidéral">Gris sidéral</option>
                                                    <option value="Argent">Argent</option>
                                                    <option value="Minuit">Minuit</option>
                                                    <option value="Or">Or</option>
                                                    <option value="Noir sidéral">Noir sidéral</option>
                                                    <option value="Lumière stellaire">Lumière stellaire</option>
                                                </>
                                            )}
                                            <option value="Autre">Autre...</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 pointer-events-none opacity-40">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>

                                    {/* Palette visuelle interactive Colors avec pastilles rondes */}
                                    {availableColors.length > 0 && (
                                        <div className="mt-2.5 flex items-center flex-wrap gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Colors :</span>
                                            {availableColors.map(c => {
                                                const colorClass = COLOR_CLASSES[c] || 'bg-slate-400 border-slate-300';
                                                const isSelected = ticket.macColor?.trim().toLowerCase() === c.toLowerCase();
                                                return (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => {
                                                            setTicket(p => ({ ...p, macColor: c }));
                                                            playTone(700, 30);
                                                        }}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                                                            isSelected 
                                                                ? 'bg-blue-600/30 border-blue-400 text-white shadow-sm ring-1 ring-blue-400 scale-[1.02]' 
                                                                : 'bg-black/30 border-white/10 text-slate-300 hover:text-white hover:border-white/30 hover:bg-black/50'
                                                        }`}
                                                        title={`Sélectionner la couleur ${c}`}
                                                    >
                                                        <span className={`w-3.5 h-3.5 rounded-full border shadow-inner ${colorClass} shrink-0`} />
                                                        <span>{c}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 ml-1">Désignation du Modèle *</label>
                                <SmartAutocompleteInput 
                                    category="mac_models" 
                                    value={ticket.macModel || ''} 
                                    onChange={v => setTicket(p => ({...p, macModel: v}))} 
                                    placeholder="ex: MacBook Air 13" 
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-apple-blue transition-all" 
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <div className="flex items-center justify-between mb-1 ml-1">
                                        <label className="block text-[9px] font-black text-slate-500 uppercase">Numéro de série (S/N)</label>
                                        {ticket.serialNumber && ticket.backCoverImage && (
                                            <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                                ✨ Détecté couvre arrière
                                            </span>
                                        )}
                                    </div>
                                    <input 
                                        placeholder="ex: C02XXXXXXXXX" 
                                        value={ticket.serialNumber} 
                                        onChange={e => setTicket(p => ({...p, serialNumber: e.target.value.toUpperCase()}))} 
                                        className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-mono font-bold outline-none focus:border-apple-blue transition-all" 
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1 ml-1">
                                        <label className="block text-[9px] font-black text-slate-500 uppercase">Code EMC (Gravure dos)</label>
                                        {ticket.emc && (
                                            <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                                ✨ Détecté couvre arrière
                                            </span>
                                        )}
                                    </div>
                                    <input 
                                        placeholder="ex: EMC 3347" 
                                        value={ticket.emc || ''} 
                                        onChange={e => {
                                            const val = e.target.value.toUpperCase();
                                            setTicket(p => ({
                                                ...p, 
                                                emc: val,
                                                customFields: { ...(p.customFields || {}), emc: val }
                                            }));
                                        }} 
                                        className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-mono font-bold outline-none focus:border-apple-blue transition-all" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LIAISON COMMANDE DE PIÈCES */}
                <div className="apple-card p-8 bg-amber-500/[0.01] border border-dashed border-amber-500/15">
                    <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <ShoppingCartIcon className="w-5 h-5 text-amber-500" /> Liaison Commande de Pièces
                    </h3>
                    
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Checkbox 1: En attente de pièce de rechange */}
                            <label className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer border transition-all ${ticket.isWaitingForOrderedPart ? 'bg-amber-500/10 border-amber-500/30' : 'bg-black/20 border-white/5 hover:bg-black/30'}`}>
                                <input 
                                    type="checkbox"
                                    checked={ticket.isWaitingForOrderedPart || false}
                                    onChange={e => {
                                        const checked = e.target.checked;
                                        setTicket(prev => ({
                                            ...prev,
                                            isWaitingForOrderedPart: checked,
                                            isMountingDay: checked ? false : prev.isMountingDay
                                        }));
                                    }}
                                    className="mt-1 w-5 h-5 accent-amber-500 animate-pulse"
                                />
                                <div>
                                    <span className="text-xs font-black text-white uppercase tracking-wider block">En attente de pièce de rechange</span>
                                    <span className="text-[10px] text-slate-400 font-bold block mt-1">Rattacher une commande en cours pour remplacer la pièce commandée sur cette machine déposée.</span>
                                </div>
                            </label>

                            {/* Checkbox 2: Montage après réception */}
                            <label className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer border transition-all ${ticket.isMountingDay ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/20 border-white/5 hover:bg-black/30'}`}>
                                <input 
                                    type="checkbox"
                                    checked={ticket.isMountingDay || false}
                                    onChange={e => {
                                        const checked = e.target.checked;
                                        setTicket(prev => ({
                                            ...prev,
                                            isMountingDay: checked,
                                            isWaitingForOrderedPart: checked ? false : prev.isWaitingForOrderedPart
                                        }));
                                    }}
                                    className="mt-1 w-5 h-5 accent-emerald-500"
                                />
                                <div>
                                    <span className="text-xs font-black text-white uppercase tracking-wider block">Montage direct de pièce reçue</span>
                                    <span className="text-[10px] text-slate-400 font-bold block mt-1">Fiche créée après réception de la pièce, le jour de son montage effectif sur la machine.</span>
                                </div>
                            </label>
                        </div>

                        {/* If either option is selected, or a matching/linked command is detected, show link UI */}
                        {(ticket.isWaitingForOrderedPart || ticket.isMountingDay || matchingCommandes.length > 0 || ticket.linkedCommandeId) && (
                            <div className="bg-black/30 p-6 rounded-2xl border border-white/5 space-y-4 animate-slide-up">
                                {!ticket.linkedCommandeId ? (
                                    <>
                                        {/* List suggested matching orders */}
                                        <div>
                                            <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-3">Commandes suggérées (Correspondance client/modèle)</h4>
                                            
                                            {matchingCommandes.length > 0 ? (
                                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                                    {matchingCommandes.map(cmd => (
                                                        <div key={cmd.id} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-black text-white font-mono">CMD #{cmd.numero}</span>
                                                                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-md text-[9px] font-bold">{cmd.status}</span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-300 font-bold mt-1">Client : {cmd.clientName || 'STOCK'} ({cmd.clientPhone}) | Modèle : {cmd.macModel}</p>
                                                                <p className="text-[10px] text-slate-400 font-mono mt-1">Total : {(Number(cmd.total) || 0).toLocaleString()} F | Avance payée : {(Number(cmd.advance) || 0).toLocaleString()} F</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAttachCommande(cmd)}
                                                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black uppercase rounded-lg tracking-wider transition-all shadow-md active:scale-95 shrink-0"
                                                            >
                                                                Associer
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500 italic">Aucune commande correspondante trouvée pour ce client ou ce modèle de machine.</p>
                                            )}
                                        </div>

                                        {/* Manual Dropdown of all unlinked active orders */}
                                        <div className="border-t border-white/5 pt-4">
                                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-2 ml-1">Associer une autre commande manuellement</label>
                                            <div className="flex gap-2">
                                                <select
                                                    onChange={e => {
                                                        const selectedId = e.target.value;
                                                        if (selectedId) {
                                                            const cmd = commandes.find(c => c.id === selectedId);
                                                            if (cmd) handleAttachCommande(cmd);
                                                        }
                                                    }}
                                                    className="flex-1 p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-amber-500 transition-all appearance-none"
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>-- Sélectionner une commande en cours --</option>
                                                    {commandes
                                                        .filter(c => !c.isLinkedToTicket && c.status !== 'Payé' && c.status !== 'Annulé')
                                                        .map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                CMD #{c.numero} - {c.clientName || 'Interne'} - {c.macModel} (Total: {(Number(c.total) || 0).toLocaleString()} F | Avance: {(Number(c.advance) || 0).toLocaleString()} F)
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* Attached Commande Display */
                                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-4 animate-fade-in">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    <span className="text-xs font-black text-white uppercase tracking-wider">Commande rattachée : CMD #{ticket.linkedCommandeNumber}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold mt-1">Détails de la commande rattachés directement au devis de cette fiche pour éviter les doublons.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleDetachCommande}
                                                className="px-2.5 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-[10px] font-black uppercase rounded-lg border border-red-500/20 transition-all active:scale-95 shrink-0"
                                            >
                                                Dissocier
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-black/40 p-3 rounded-xl border border-white/5">
                                            <div>
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Avance transférée</span>
                                                <span className="text-xs font-black text-emerald-400 font-mono mt-1 block">{(ticket.costs?.advance || 0).toLocaleString()} F CFA</span>
                                            </div>
                                            <div>
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Statut cible de la Fiche</span>
                                                <span className="text-xs font-black text-amber-400 uppercase mt-1 block">
                                                    {ticket.isMountingDay ? "Réparation en cours" : "En attente de pièces"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Date de rdv montage</span>
                                                <span className="text-xs font-black text-blue-400 font-mono mt-1 block">
                                                    {ticket.rendezVousDate ? `${new Date(ticket.rendezVousDate).toLocaleDateString('fr-FR')} à ${ticket.rendezVousTime || '10:00'}` : "Non planifiée"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Dropdown de calcul de délai pour fiche liée */}
                                        <div className="pt-2">
                                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Calculer automatiquement selon le délai</label>
                                            <select
                                                onChange={e => {
                                                    const opt = e.target.value;
                                                    if (opt) {
                                                        const computedDate = calculateFutureDate(new Date(), opt);
                                                        const yyyy = computedDate.getFullYear();
                                                        const mm = String(computedDate.getMonth() + 1).padStart(2, '0');
                                                        const dd = String(computedDate.getDate()).padStart(2, '0');
                                                        const dateString = `${yyyy}-${mm}-${dd}`;
                                                        
                                                        let minutesVal = Math.round(computedDate.getMinutes() / 30) * 30;
                                                        let hrVal = computedDate.getHours();
                                                        if (minutesVal >= 60) {
                                                            minutesVal = 0;
                                                            hrVal += 1;
                                                        }
                                                        const finalHr = String(hrVal).padStart(2, '0');
                                                        const finalMin = String(minutesVal).padStart(2, '0');
                                                        const timeString = `${finalHr}:${finalMin}`;

                                                        setTicket(p => ({
                                                            ...p,
                                                            rendezVousDate: dateString,
                                                            rendezVousTime: timeString
                                                        }));
                                                    }
                                                }}
                                                className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-emerald-500 transition-all font-sans"
                                                defaultValue=""
                                            >
                                                <option value="">-- Choisir un délai (Calcul automatique) --</option>
                                                <optgroup label="Réparation / Prestation (Hors dimanches & jours fériés)">
                                                    <option value="30mn">30 Minutes</option>
                                                    <option value="1h">1 Heure</option>
                                                    <option value="2h">2 Heures</option>
                                                    <option value="3h">3 Heures</option>
                                                    <option value="4h">4 Heures</option>
                                                    <option value="6h">6 Heures</option>
                                                    <option value="24h">24 Heures (1 jour)</option>
                                                    <option value="48h">48 Heures (2 jours)</option>
                                                    <option value="72h">72 Heures (3 jours)</option>
                                                    <option value="5 jours">5 Jours</option>
                                                    <option value="7 jours">7 Jours</option>
                                                    <option value="10 jours">10 Jours</option>
                                                    <option value="15 jours">15 Jours</option>
                                                    <option value="20 jours">20 Jours</option>
                                                    <option value="30 jours">30 Jours</option>
                                                </optgroup>
                                                <optgroup label="Commande (5 jours sur 7 - Ouvrables uniquement)">
                                                    <option value="15 jours ouvrables">15 Jours ouvrables</option>
                                                    <option value="20 jours ouvrables">20 Jours ouvrables</option>
                                                    <option value="25 jours ouvrables">25 Jours ouvrables</option>
                                                </optgroup>
                                            </select>
                                        </div>

                                        {/* Date and Time selectors for appointment */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                            <div>
                                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Planifier Date de Rendez-vous</label>
                                                <input 
                                                    type="date" 
                                                    value={ticket.rendezVousDate || ''} 
                                                    onChange={e => setTicket(p => ({...p, rendezVousDate: e.target.value}))}
                                                    className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-emerald-500 transition-all font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Heure de Rendez-vous</label>
                                                <input 
                                                    type="time" 
                                                    value={ticket.rendezVousTime || '10:00'} 
                                                    onChange={e => setTicket(p => ({...p, rendezVousTime: e.target.value}))}
                                                    className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white font-mono font-bold outline-none focus:border-emerald-500 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ÉTAT TECHNIQUE DÉTAILLÉ */}
                <div className="apple-card p-8 bg-apple-blue/[0.02]">
                    <h3 className="text-[10px] font-black text-apple-blue uppercase tracking-[0.2em] mb-6">État à la réception & Inventaire</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            {/* Allumage */}
                            <div>
                                <label className={labelSubStyle}>L'appareil s'allume-t-il ?</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, powersOn: true}))}
                                        className={`p-3 rounded-xl text-[10px] font-black uppercase transition-all border ${ticket.powersOn ? 'bg-apple-blue border-apple-blue text-white shadow-lg' : 'bg-black/40 border-white/5 text-slate-500'}`}
                                    >Oui</button>
                                    <button
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, powersOn: false, powerOnStatus: 'non'}))}
                                        className={`p-3 rounded-xl text-[10px] font-black uppercase transition-all border ${!ticket.powersOn ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-black/40 border-white/5 text-slate-500'}`}
                                    >Non</button>
                                </div>
                                {!ticket.powersOn && (
                                    <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-fade-in">
                                        <p className="text-[10px] text-red-400 font-bold leading-tight">
                                            ⚠️ Attention : Le diagnostic basique de 5.000 F CFA ne permet pas de savoir ce qui fonctionne ou pas sur les reste des elements (ecran, clavier, batterie, touchbar, trackpad, etc) tant que la carte mère ne démarre pas.
                                             <br /><br />
                                             • C'est uniquement lorsque la carte mère pourra démarrer et charger que nous pourrons vérifier l'état réel de la batterie, ecran, clavier, carte mere, trackpad, etc.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {ticket.powersOn && (
                                <div className="space-y-2 animate-fade-in">
                                    <label className={labelSubStyle}>Comportement à l'allumage</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            {id: 'charge_systeme', label: "Charge le système"},
                                            {id: 'ne_charge_pas', label: "Ne charge pas le système"},
                                            {id: 'bootloop', label: "Affiche mais redémarre en boucle"},
                                            {id: 'ecran_casse', label: "Écran cassé"},
                                            {id: 'ecran_non_fonctionnel', label: "Écran non fonctionnel"},
                                            {id: 'rien_ne_saffiche', label: "Rien ne s'affiche à l'écran"}
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setTicket(p => ({...p, powerOnStatus: opt.id as PowerOnStatus}))}
                                                className={`p-3 text-left rounded-xl text-[10px] font-black uppercase transition-all border ${ticket.powerOnStatus === opt.id ? 'bg-white text-black border-white' : 'bg-black/20 border-white/5 text-slate-400'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className={labelSubStyle}>Santé Batterie déclarée</label>
                                <select 
                                    value={ticket.batteryFunctional} 
                                    onChange={e => setTicket(p => ({...p, batteryFunctional: e.target.value as 'unknown' | 'yes' | 'no'}))}
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none"
                                >
                                    <option value="unknown">Inconnu / À tester</option>
                                    <option value="yes">Fonctionnelle (Bonne)</option>
                                    <option value="no">Dégradée / HS</option>
                                </select>
                                {ticket.batteryFunctional === 'unknown' && (
                                    <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl animate-fade-in">
                                        <p className="text-[10px] text-yellow-400 font-bold leading-tight">
                                            ℹ️ C'est uniquement lorsque la carte mère pourra démarrer et charger que nous pourrons vérifier l'état réel de la batterie, ecran, clavier, carte mere, trackpad, etc.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Accessoires */}
                            <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                                <label className="text-[10px] font-black uppercase text-slate-300">Chargeur inclus ?</label>
                                <div className="flex items-center gap-3">
                                    {ticket.chargerIncluded && <span className="text-[8px] font-black text-yellow-500 uppercase animate-pulse">À Tester</span>}
                                    <input type="checkbox" checked={ticket.chargerIncluded} onChange={e => setTicket(p => ({...p, chargerIncluded: e.target.checked}))} className={checkboxClass} />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                                    <label className="text-[10px] font-black uppercase text-slate-300">Sac de transport ?</label>
                                    <input type="checkbox" checked={ticket.bagIncluded} onChange={e => setTicket(p => ({...p, bagIncluded: e.target.checked}))} className={checkboxClass} />
                                </div>
                                {ticket.bagIncluded && (
                                    <input
                                        placeholder="Décrire le sac (marque, couleur...)"
                                        value={ticket.bagDescription || ''}
                                        onChange={e => setTicket(p => ({...p, bagDescription: e.target.value}))}
                                        className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-apple-blue"
                                    />
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                                    <label className="text-[10px] font-black uppercase text-slate-300">Coque de protection ?</label>
                                    <input type="checkbox" checked={ticket.caseIncluded} onChange={e => setTicket(p => ({...p, caseIncluded: e.target.checked}))} className={checkboxClass} />
                                </div>
                                {ticket.caseIncluded && (
                                    <SmartAutocompleteInput
                                        category="case_colors"
                                        value={ticket.caseColor || ''}
                                        onChange={v => setTicket(p => ({...p, caseColor: v}))}
                                        placeholder="Couleur de la coque (ex: Transparent, Noir)"
                                        className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="apple-card p-8">
                    <DeclaredSymptomsManager 
                        details={ticket.declaredSymptomsDetails}
                        problemDescription={ticket.problemDescription || ''}
                        onChange={(updatedDetails, autoSummary) => {
                            setTicket(prev => {
                                const currentDesc = prev.problemDescription || '';
                                const shouldAutoUpdate = !currentDesc.trim() || currentDesc.startsWith('• PANNE') || currentDesc.startsWith('• CONTACT') || currentDesc.startsWith('• AFFICHAGE') || currentDesc.startsWith('• BATTERIE') || currentDesc.startsWith('• COMPORTEMENT') || currentDesc.startsWith('• AUTRE');
                                return {
                                    ...prev,
                                    declaredSymptomsDetails: updatedDetails,
                                    problemDescription: (shouldAutoUpdate && autoSummary) ? autoSummary : currentDesc
                                };
                            });
                        }}
                        onDescriptionChange={(newDesc) => {
                            setTicket(prev => ({
                                ...prev,
                                problemDescription: newDesc
                            }));
                        }}
                        powersOn={ticket.powersOn}
                    />
                </div>

                {/* DÉTAILS DEVIS & PRESTATIONS - IMPUTATION INVENTAIRE ET VENTE */}
                <div className="apple-card p-8">
                    <LignesVenteManager 
                        ticket={ticket} 
                        onChange={(lines) => {
                            const syncedServices = syncSalesLinesToServices(lines);
                            setTicket(p => ({
                                ...p,
                                ligneVentes: lines,
                                services: syncedServices
                            }));
                        }}
                    />
                </div>
            </div>

            <div className={`${isTouch ? 'w-full space-y-6' : 'lg:col-span-4 space-y-8'}`}>
                {/* FINANCE */}
                <div className="apple-card p-8 bg-apple-blue/5 border-apple-blue/20">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                        <h3 className="text-[10px] font-black text-apple-blue uppercase tracking-widest">Synthèse Financière</h3>
                        {(ticket.status === RepairStatus.ANNULE || ticket.isInfacturable) && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-black uppercase tracking-wider">
                                🚫 INFACTURABLE (0 F AU POINT)
                            </span>
                        )}
                    </div>
                    {(ticket.status === RepairStatus.ANNULE || ticket.isInfacturable) && (
                        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1">
                            <p className="font-black uppercase tracking-wide text-rose-300 flex items-center gap-1.5">
                                <span>⚠️</span> Dossier Annulé — Mentionné comme Infacturable
                            </p>
                            <p className="text-[11px] leading-relaxed text-rose-200/90">
                                Cette fiche est annulée : toute avance enregistrée ({ticket.costs?.advance || 0} F CFA) ou solde est automatiquement mentionnée comme <strong>infacturable</strong>. Aucun fond n'est intégrable dans notre point de caisse / comptabilité.
                            </p>
                        </div>
                    )}
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between ml-1 mb-1">
                                <label className="block text-[9px] font-black text-slate-500 uppercase">Expertise fixe (F CFA)</label>
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
                                className={`w-full p-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono font-bold outline-none focus:border-apple-blue transition-all ${ticket.client?.clientType === 'subcontractor' ? 'opacity-60 cursor-not-allowed text-amber-300' : ''}`} 
                            />
                        </div>
                        <div className="flex justify-between items-center py-4 border-y border-white/5">
                            <span className="text-xs font-black text-white uppercase tracking-widest">Total Estimé</span>
                            <span className="text-2xl font-black text-apple-blue font-mono">{totalCost.toLocaleString()} F</span>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2 ml-1">
                                <label className="block text-[9px] font-black text-emerald-500 uppercase tracking-widest">Acompte perçu</label>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Max: {totalCost.toLocaleString('fr-FR')} F</span>
                            </div>
                            <input 
                                type="number" 
                                min="0"
                                max={totalCost}
                                step="500"
                                value={ticket.costs?.advance ?? ''} 
                                onKeyDown={(e) => {
                                    if (['e', 'E', '+', '-'].includes(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    if (raw === '') {
                                        setTicket(p => ({
                                            ...p,
                                            costs: {
                                                ...(p.costs || { diagnostic: 0, repair: 0, advance: 0 }),
                                                advance: 0
                                            }
                                        }));
                                        return;
                                    }
                                    let num = parseInt(raw, 10);
                                    if (isNaN(num) || num < 0) num = 0;
                                    if (num > totalCost) {
                                        num = totalCost;
                                        showToast(`L'acompte ne peut pas excéder le total facturable (${totalCost.toLocaleString('fr-FR')} F CFA).`, "warning");
                                    }
                                    setTicket(p => ({
                                        ...p, 
                                        costs: {
                                            ...(p.costs || { diagnostic: 0, repair: 0, advance: 0 }), 
                                            advance: num
                                        }
                                    }));
                                }} 
                                className="w-full p-4 bg-black/60 border border-emerald-500/30 rounded-2xl text-2xl font-black text-emerald-400 font-mono outline-none" 
                            />
                        </div>
                        <div className="bg-white p-6 rounded-[24px] shadow-2xl flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reste à régler</span>
                            <span className="text-3xl font-black text-black font-mono tracking-tighter">{Math.max(0, totalCost - (ticket.costs?.advance || 0)).toLocaleString()} F CFA</span>
                        </div>
                    </div>
                </div>

                {/* SIGNATURE */}
                <div className="apple-card p-8">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Signature Client</h3>
                    <div className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden mb-4 shadow-inner">
                        <SignaturePad ref={signaturePadRef} />
                    </div>
                </div>

                {/* PHOTOS */}
                <div className="apple-card p-8">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Preuves Visuelles</h3>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {ticket.attachments?.map(att => (
                            <div key={att.id} className="relative aspect-square rounded-xl overflow-hidden bg-black border border-white/5 group">
                                <img src={att.data} className="w-full h-full object-cover" />
                                <button onClick={() => removeAttachment(att.id)} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                    <TrashIcon className="w-6 h-6 text-white"/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-black uppercase text-slate-400 hover:text-white transition-all flex items-center justify-center gap-3"
                    >
                        <CloudArrowDownIcon className="w-5 h-5 text-apple-blue" />
                        Ajouter Photos Appareil
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileUpload} />
                </div>
            </div>
        </div>

        {isPreviewOpen && (
            <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileName={`fiche_rapide_${getPreviewTicket().id}.pdf`}>
                <div className="flex flex-col text-black">
                    <PrintableTicket ticket={getPreviewTicket()} />
                    {getPreviewTicket().client?.isEnterprise && <PrintableEnterpriseBon ticket={getPreviewTicket()} />}
                </div>
            </PreviewModal>
        )}

        {previewImageModal && (
            <div 
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
                onClick={() => setPreviewImageModal(null)}
            >
                <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                    <button 
                        type="button" 
                        onClick={() => setPreviewImageModal(null)}
                        className="self-end mb-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase transition-colors"
                    >
                        ✕ Fermer
                    </button>
                    <img 
                        src={previewImageModal} 
                        alt="Zoom photo" 
                        className="max-h-[80vh] w-auto max-w-full rounded-2xl border border-white/20 shadow-2xl object-contain" 
                    />
                </div>
            </div>
        )}
    </div>
  );
};

export default RepairForm;
