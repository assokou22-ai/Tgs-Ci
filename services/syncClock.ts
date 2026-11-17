// Horloge synchronisée sur le serveur Firestore + identifiant d'appareil.
// Évite qu'un PC ou un téléphone mal réglé fasse gagner (ou perdre) une modification.
import { doc, setDoc, getDocFromServer, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth, isQuotaCooldownActive, isQuotaExceededError, reportQuotaExceeded } from './firebase.ts';

const OFFSET_KEY = 'tgs_server_clock_offset_ms';
const DEVICE_KEY = 'tgs_device_id';
const CALIBRATION_INTERVAL_MS = 30 * 60_000;

let offsetMs = typeof localStorage !== 'undefined' ? (Number(localStorage.getItem(OFFSET_KEY) || '0') || 0) : 0;
let calibrating: Promise<void> | null = null;
let lastCalibratedAt = 0;

export const getDeviceId = (): string => {
    let id = typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_KEY) : null;
    if (!id) {
        const rnd = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
        const kind = (typeof window !== 'undefined' && (window as unknown as { __IS_ANDROID_APP__?: boolean }).__IS_ANDROID_APP__) ? 'android' : 'web';
        id = `${kind}-${rnd}`;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(DEVICE_KEY, id);
        }
    }
    return id;
};

/** Heure "serveur" estimée en millisecondes. */
export const serverNow = (): number => Date.now() + offsetMs;
export const serverNowIso = (): string => new Date(serverNow()).toISOString();

/** Calibre le décalage entre l'horloge locale et celle de Firestore (silencieux en cas d'échec, throttlé 30 min). */
export const calibrateServerClock = async (): Promise<void> => {
    if (calibrating) return calibrating;
    if (!navigator.onLine || !auth.currentUser || isQuotaCooldownActive()) return;
    if (lastCalibratedAt > 0 && Date.now() - lastCalibratedAt < CALIBRATION_INTERVAL_MS) return;

    calibrating = (async () => {
        try {
            const ref = doc(db, 'deviceSessions', `clock_${getDeviceId()}`);
            const t0 = Date.now();
            await setDoc(ref, { id: `clock_${getDeviceId()}`, ping: serverTimestamp(), device: getDeviceId(), email: auth.currentUser?.email || '' });
            const snap = await getDocFromServer(ref);
            const t1 = Date.now();
            const ts = snap.get('ping') as Timestamp | undefined;
            if (ts && typeof ts.toMillis === 'function') {
                const midLocal = (t0 + t1) / 2;
                offsetMs = Math.round(ts.toMillis() - midLocal);
                localStorage.setItem(OFFSET_KEY, String(offsetMs));
                lastCalibratedAt = Date.now();
                if (Math.abs(offsetMs) > 60_000) {
                    console.warn(`[Horloge] L'horloge de cet appareil est décalée de ${Math.round(offsetMs / 1000)} s par rapport au serveur (corrigé automatiquement).`);
                }
            }
        } catch (e) {
            if (isQuotaExceededError(e)) {
                reportQuotaExceeded(e);
            } else {
                console.warn('[Horloge] Calibration impossible (non bloquant):', e);
            }
        } finally {
            calibrating = null;
        }
    })();
    return calibrating;
};

