import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Cache persistant : après un redémarrage, seules les modifications sont téléchargées
// (au lieu de toutes les fiches), ce qui accélère l'ouverture sur téléphone.
const createDb = (): Firestore => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    }, firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    console.warn('[Firebase] Cache persistant indisponible, mode mémoire.', e);
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
};
export const db = createDb();
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Circuit-breaker de quota Firestore ---
// Évite de marteler Firestore quand le quota journalier gratuit de lectures est atteint.
let quotaCooldownUntil = 0;
let lastQuotaErrorMessage: string | null = null;
let lastQuotaEventAt = 0;

export const isQuotaExceededError = (error: unknown): boolean => {
  if (!error) return false;
  const code = typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code).toLowerCase() : '';
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('free daily read units') ||
    msg.includes('too many requests') ||
    msg.includes('429')
  );
};

export const isQuotaCooldownActive = (): boolean => Date.now() < quotaCooldownUntil;

export const getQuotaStatus = () => ({
  active: Date.now() < quotaCooldownUntil,
  until: quotaCooldownUntil,
  message: lastQuotaErrorMessage,
});

export const clearQuotaCooldown = () => {
  quotaCooldownUntil = 0;
  lastQuotaErrorMessage = null;
};

export const reportQuotaExceeded = (error?: unknown, cooldownMs = 5 * 60_000) => {
  const now = Date.now();
  quotaCooldownUntil = Math.max(quotaCooldownUntil, now + cooldownMs);
  lastQuotaErrorMessage =
    "Quota journalier Cloud Firestore temporairement atteint (lectures). Vos fiches restent sauvegardées en local et seront envoyées automatiquement dès la réinitialisation du quota.";

  if (typeof window !== 'undefined' && now - lastQuotaEventAt > 30_000) {
    lastQuotaEventAt = now;
    const rawError = error instanceof Error ? error.message : String(error || '');
    window.dispatchEvent(
      new CustomEvent('syncquotaexceeded', {
        detail: {
          message: lastQuotaErrorMessage,
          rawError,
          until: quotaCooldownUntil,
        },
      })
    );
  }
};

