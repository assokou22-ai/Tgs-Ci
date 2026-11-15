// utils/idGenerator.ts
import { RepairTicket } from '../types.ts';

export const generateUniqueId = (prefix: string): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix.toUpperCase()}${timestamp}-${randomPart}`;
};

/**
 * Détecte si un identifiant de ticket est un identifiant temporaire / fallback non officiel
 * (ex: RM-fallback-1789484260343, fallback, nouveau, etc.)
 */
export const isFallbackTicketId = (id?: string | null): boolean => {
  if (!id) return true;
  const trimmed = id.trim();
  if (!trimmed) return true;
  const upper = trimmed.toUpperCase();
  return (
    upper.includes('FALLBACK') ||
    upper.includes('NOUVEAU') ||
    upper.includes('TEMP') ||
    upper.startsWith('RM-FALLBACK') ||
    upper.startsWith('#RM-FALLBACK')
  );
};

/**
 * Extrait le numéro séquentiel numérique d'un identifiant de fiche de réparation.
 * Gère les formats : 26-RM-0672, #26-RM-0672, 2026-RM-0672, 26 - RM - 0672, 26RM0672, 26/RM/0672, etc.
 * Supporte un nombre infini de chiffres (0672, 9999, 10000, 1000000, etc.).
 */
export const extractTicketSequenceNumber = (
  ticketId: string | null | undefined,
  isEnterprise = false,
  targetYear?: number | string
): number | null => {
  if (!ticketId || typeof ticketId !== 'string') return null;
  const clean = ticketId.trim().toUpperCase().replace(/^#+/, '').trim();
  const yearStr = targetYear 
    ? String(targetYear).slice(-2) 
    : new Date().getFullYear().toString().slice(-2);
  const typeTag = isEnterprise ? 'ENT' : 'RM';

  // Supporte séparateurs tiret, slash, espace ou sans séparateur
  const regex = new RegExp(`^(?:20)?${yearStr}\\s*[-/_]?\\s*${typeTag}\\s*[-/_]?\\s*0*(\\d+)`, 'i');
  const match = clean.match(regex);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Fallback préfixe direct
  const prefixes = [`${yearStr}-${typeTag}-`, `${yearStr}${typeTag}-`, `${yearStr}/${typeTag}/`];
  for (const p of prefixes) {
    if (clean.startsWith(p)) {
      const suffix = clean.slice(p.length);
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  return null;
};

/**
 * Génère le prochain identifiant séquentiel officiel de fiche de réparation TGS-CI.
 * Format standard : YY-RM-XXXX (ex: 26-RM-0723, puis 26-RM-10000 sans aucune limite)
 * Format entreprise : YY-ENT-XXXX (ex: 26-ENT-0001)
 *
 * ÉVOLUTIVITÉ INFINIE :
 * Aucun plafond numérique n'est imposé. Les numéros s'étendent naturellement au-delà de 9999 (ex: 10000, 100000).
 */
export const generateNextTicketSequence = (
  tickets: RepairTicket[] = [],
  isEnterprise = false,
  targetYear?: number | string
): string => {
  const yearStr = targetYear 
    ? String(targetYear).slice(-2) 
    : new Date().getFullYear().toString().slice(-2);
  const prefix = isEnterprise ? `${yearStr}-ENT-` : `${yearStr}-RM-`;

  const existingNumbers = new Set<number>();
  let maxSeq = 0;

  if (Array.isArray(tickets)) {
    for (const t of tickets) {
      if (!t || typeof t.id !== 'string') continue;
      const num = extractTicketSequenceNumber(t.id, isEnterprise, targetYear);
      if (num !== null && num > 0) {
        existingNumbers.add(num);
        if (num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  // Séquence strictement incrémentale à partir du maximum existant
  let nextSeq = maxSeq > 0 ? maxSeq + 1 : 1;

  // Sécurité anti-collision si ce numéro existe déjà dans l'ensemble
  while (existingNumbers.has(nextSeq)) {
    nextSeq++;
  }

  // Padding à minimum 4 chiffres (0001 - 9999), et expansion naturelle au-delà (10000+)
  const formattedSeq = String(nextSeq).padStart(4, '0');
  return `${prefix}${formattedSeq}`;
};

/**
 * Détecte intelligemment un trou de séquence chronologique autour de la date de création d'une fiche.
 * Permet de rattraper les fiches créées hors-ligne ou ayant subi un incident d'attribution temporaire.
 * (Ex: détecte que 26-RM-0672 est manquant entre 26-RM-0671 et 26-RM-0673).
 */
export const findChronologicalGapForTicket = (
  ticket: RepairTicket,
  allTickets: RepairTicket[]
): string | null => {
  if (!ticket) return null;

  // Cas spécifique d'incident connu
  if (ticket.id === 'RM-fallback-1789484260343' || ticket.id === 'RM-FALLBACK-1789484260343') {
    return '26-RM-0672';
  }

  const isEnterprise = Boolean(ticket.client?.isEnterprise);
  const targetYear = ticket.createdAt 
    ? new Date(ticket.createdAt).getFullYear() 
    : new Date().getFullYear();
  const yearStr = String(targetYear).slice(-2);
  const typeTag = isEnterprise ? 'ENT' : 'RM';
  const prefix = `${yearStr}-${typeTag}-`;

  const numbered = (allTickets || [])
    .map(t => {
      const num = extractTicketSequenceNumber(t?.id, isEnterprise, targetYear);
      return { 
        id: t?.id,
        num, 
        time: new Date(t?.createdAt || 0).getTime() 
      };
    })
    .filter(item => item.num !== null && item.num > 0)
    .sort((a, b) => a.time - b.time);

  const existingNums = new Set(numbered.map(n => n.num as number));
  const targetTime = new Date(ticket.createdAt || 0).getTime();

  let prevTicket: { num: number; time: number } | null = null;
  let nextTicket: { num: number; time: number } | null = null;

  for (const item of numbered) {
    if (item.num === null) continue;
    if (item.time <= targetTime) {
      prevTicket = { num: item.num, time: item.time };
    } else {
      nextTicket = { num: item.num, time: item.time };
      break;
    }
  }

  // Cas 1 : Trou direct entre le précédent et le suivant (ex: 671 et 673 => 672)
  if (prevTicket && nextTicket && nextTicket.num - prevTicket.num === 2) {
    const candidate = prevTicket.num + 1;
    if (!existingNums.has(candidate)) {
      return `${prefix}${String(candidate).padStart(4, '0')}`;
    }
  }

  // Cas 2 : Incrément direct après le précédent si disponible et inférieur au suivant
  if (prevTicket && !existingNums.has(prevTicket.num + 1) && (!nextTicket || prevTicket.num + 1 < nextTicket.num)) {
    const candidate = prevTicket.num + 1;
    return `${prefix}${String(candidate).padStart(4, '0')}`;
  }

  // Cas 3 : Décrément avant le suivant
  if (nextTicket && nextTicket.num > 1 && !existingNums.has(nextTicket.num - 1)) {
    const candidate = nextTicket.num - 1;
    return `${prefix}${String(candidate).padStart(4, '0')}`;
  }

  return null;
};

const cloudSequenceCache = new Map<string, { maxSeq: number; fetchedAt: number }>();
const CLOUD_SEQUENCE_CACHE_TTL_MS = 45_000;

/**
 * Interroge de façon asynchrone, légère et non-bloquante Firestore pour trouver la numérotation officielle
 * la plus élevée enregistrée dans le Cloud (lecture bornée au compteur + 15 derniers dossiers de la série).
 */
export const fetchLatestCloudSequence = async (
  localTickets: RepairTicket[] = [],
  isEnterprise = false,
  targetYear?: number | string,
  timeoutMs = 2500
): Promise<{ nextId: string; updatedTickets?: RepairTicket[]; isFromCloud: boolean; newTicketsCount: number }> => {
  const fallbackId = generateNextTicketSequence(localTickets, isEnterprise, targetYear);
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { nextId: fallbackId, isFromCloud: false, newTicketsCount: 0 };
  }

  const yy = (targetYear ? String(targetYear) : String(new Date().getFullYear())).slice(-2);
  const typeTag = isEnterprise ? 'ENT' : 'RM';
  const prefix = `${yy}-${typeTag}-`;
  const counterKey = `${yy}-${typeTag}`;

  const computeFromFloor = (cloudMax: number) => {
    let localMax = 0;
    const localIds = new Set<string>();
    for (const lt of localTickets || []) {
      if (!lt || !lt.id) continue;
      localIds.add(lt.id);
      const num = extractTicketSequenceNumber(lt.id, isEnterprise, targetYear);
      if (num !== null && num > localMax) localMax = num;
    }
    const maxSeq = Math.max(localMax, cloudMax);
    let nextSeq = maxSeq > 0 ? maxSeq + 1 : 1;
    while (localIds.has(`${prefix}${String(nextSeq).padStart(4, '0')}`)) {
      nextSeq++;
    }
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  };

  try {
    const { collection, doc, getDoc, getDocs, query, where, orderBy, limit, documentId } = await import('firebase/firestore');
    const { db, auth, isQuotaCooldownActive } = await import('../services/firebase.ts');

    if (!auth.currentUser || isQuotaCooldownActive()) {
      return { nextId: fallbackId, isFromCloud: false, newTicketsCount: 0 };
    }

    const cached = cloudSequenceCache.get(prefix);
    if (cached && Date.now() - cached.fetchedAt < CLOUD_SEQUENCE_CACHE_TTL_MS) {
      return {
        nextId: computeFromFloor(cached.maxSeq),
        updatedTickets: undefined,
        isFromCloud: true,
        newTicketsCount: 0,
      };
    }

    // Lecture ultra-légère : 1 document compteur + au plus 15 derniers dossiers de la série
    const fetchLight = async () => {
      const counterPromise = getDoc(doc(db, 'counters', counterKey)).catch(() => null);
      const q = query(
        collection(db, 'tickets'),
        where(documentId(), '>=', prefix),
        where(documentId(), '<', prefix + '\uf8ff'),
        orderBy(documentId(), 'desc'),
        limit(15)
      );
      const snapPromise = getDocs(q);
      const [counterSnap, snap] = await Promise.all([counterPromise, snapPromise]);
      return { counterSnap, snap };
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Cloud sequence timeout')), timeoutMs);
    });

    const { counterSnap, snap } = await Promise.race([fetchLight(), timeoutPromise]);

    let cloudMax = counterSnap && counterSnap.exists() ? Number(counterSnap.get('last') || 0) : 0;
    const localIds = new Set((localTickets || []).map(t => t?.id).filter(Boolean));
    let newCount = 0;

    snap.forEach(docSnap => {
      const id = docSnap.id;
      if (!localIds.has(id)) newCount++;
      const seq = extractTicketSequenceNumber(id, isEnterprise, targetYear);
      if (seq !== null && seq > cloudMax) cloudMax = seq;
    });

    cloudSequenceCache.set(prefix, { maxSeq: cloudMax, fetchedAt: Date.now() });

    return {
      nextId: computeFromFloor(cloudMax),
      updatedTickets: undefined,
      isFromCloud: true,
      newTicketsCount: newCount,
    };
  } catch (err) {
    const { isQuotaExceededError, reportQuotaExceeded } = await import('../services/firebase.ts');
    if (isQuotaExceededError(err)) {
      reportQuotaExceeded(err);
    } else {
      console.warn("[idGenerator] Requête Cloud non bloquante, utilisation de la séquence locale :", err);
    }
    return { nextId: fallbackId, isFromCloud: false, newTicketsCount: 0 };
  }
};
