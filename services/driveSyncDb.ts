import { openDB, IDBPDatabase } from 'idb';

export type DriveSyncStatus = 'synced' | 'syncing' | 'offline_pending' | 'action_required';

export interface DriveMetadata {
    driveConnected: boolean;
    connectedEmail: string | null;
    lastSyncTime: string | null;
    autoSyncEnabled: boolean;
    lastError: string | null;
    syncStatus: DriveSyncStatus;
    pendingCount: number;
}

export interface DriveQueueItem {
    id: string;
    timestamp: string;
    type: 'initial' | 'data_change' | 'periodic' | 'manual';
    attempts: number;
    lastAttempt: string | null;
    error: string | null;
}

const DB_NAME = 'tgs_drive_sync_db';
const DB_VERSION = 1;
const META_STORE = 'meta';
const QUEUE_STORE = 'offlineQueue';
const LOCK_KEY = 'tgs_drive_sync_lock_ts';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(META_STORE)) {
                    db.createObjectStore(META_STORE);
                }
                if (!db.objectStoreNames.contains(QUEUE_STORE)) {
                    db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}

const DEFAULT_METADATA: DriveMetadata = {
    driveConnected: false,
    connectedEmail: null,
    lastSyncTime: null,
    autoSyncEnabled: true,
    lastError: null,
    syncStatus: 'action_required',
    pendingCount: 0,
};

// LocalStorage fallback helpers for non-sensitive data
const LS_META_KEY = 'tgs_gdrive_metadata_cache';

function getLocalMetaFallback(): Partial<DriveMetadata> {
    try {
        const raw = localStorage.getItem(LS_META_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveLocalMetaFallback(meta: DriveMetadata): void {
    try {
        localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
    } catch (e) {
        console.warn('Could not save meta fallback to localStorage', e);
    }
}

/**
 * Retrieves non-sensitive Drive sync metadata from IndexedDB (with localStorage fallback).
 */
export async function getDriveMetadata(): Promise<DriveMetadata> {
    try {
        const db = await getDb();
        const stored = await db.get(META_STORE, 'current');
        const queueCount = await getQueueCount();
        const fallback = getLocalMetaFallback();

        const merged: DriveMetadata = {
            ...DEFAULT_METADATA,
            ...fallback,
            ...(stored || {}),
            pendingCount: queueCount,
        };

        return merged;
    } catch (error) {
        console.warn('IndexedDB unavailable for Drive metadata, using fallback', error);
        const fallback = getLocalMetaFallback();
        return {
            ...DEFAULT_METADATA,
            ...fallback,
            pendingCount: 0,
        };
    }
}

/**
 * Saves non-sensitive Drive sync metadata to IndexedDB and broadcasts change.
 */
export async function saveDriveMetadata(patch: Partial<DriveMetadata>): Promise<DriveMetadata> {
    try {
        const current = await getDriveMetadata();
        const updated: DriveMetadata = {
            ...current,
            ...patch,
        };

        const db = await getDb();
        await db.put(META_STORE, updated, 'current');
        saveLocalMetaFallback(updated);

        // Notify app components
        window.dispatchEvent(new CustomEvent('gdrive-meta-changed', { detail: updated }));

        return updated;
    } catch (error) {
        console.warn('Failed to save metadata to IndexedDB, saving to fallback', error);
        const current = getLocalMetaFallback();
        const updated: DriveMetadata = {
            ...DEFAULT_METADATA,
            ...current,
            ...patch,
        };
        saveLocalMetaFallback(updated);
        window.dispatchEvent(new CustomEvent('gdrive-meta-changed', { detail: updated }));
        return updated;
    }
}

/**
 * Enqueues a synchronization operation into IndexedDB offline queue.
 * Prevents redundant duplicates of the same type within a short window.
 */
export async function enqueueDriveOperation(type: 'initial' | 'data_change' | 'periodic' | 'manual'): Promise<string> {
    const id = `gdrive_op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const item: DriveQueueItem = {
        id,
        timestamp: new Date().toISOString(),
        type,
        attempts: 0,
        lastAttempt: null,
        error: null,
    };

    try {
        const db = await getDb();
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        
        // If there's already a pending operation of same type (data_change or periodic), don't balloon the queue
        const allItems: DriveQueueItem[] = await store.getAll();
        const existingRecent = allItems.find(it => it.type === type && it.attempts === 0);
        if (existingRecent && type !== 'manual') {
            await tx.done;
            return existingRecent.id;
        }

        await store.put(item);
        await tx.done;

        const count = await getQueueCount();
        await saveDriveMetadata({ 
            pendingCount: count,
            syncStatus: count > 0 && !navigator.onLine ? 'offline_pending' : undefined
        });

        return id;
    } catch (error) {
        console.warn('Failed to enqueue to IndexedDB queue', error);
        return id;
    }
}

/**
 * Returns all pending operations from the offline queue.
 */
export async function getDriveQueue(): Promise<DriveQueueItem[]> {
    try {
        const db = await getDb();
        const items = await db.getAll(QUEUE_STORE);
        return (items || []).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch {
        return [];
    }
}

export async function getQueueCount(): Promise<number> {
    try {
        const db = await getDb();
        return await db.count(QUEUE_STORE);
    } catch {
        return 0;
    }
}

/**
 * Removes a completed operation from the queue.
 */
export async function removeDriveQueueItem(id: string): Promise<void> {
    try {
        const db = await getDb();
        await db.delete(QUEUE_STORE, id);
        const remaining = await getQueueCount();
        await saveDriveMetadata({ pendingCount: remaining });
    } catch (error) {
        console.warn('Error removing item from queue', error);
    }
}

/**
 * Updates an operation in the queue (e.g. attempt count or error message).
 */
export async function updateDriveQueueItem(id: string, patch: Partial<DriveQueueItem>): Promise<void> {
    try {
        const db = await getDb();
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const existing: DriveQueueItem | undefined = await store.get(id);
        if (existing) {
            await store.put({ ...existing, ...patch });
        }
        await tx.done;
    } catch (error) {
        console.warn('Error updating queue item', error);
    }
}

/**
 * Clears all operations from the offline queue.
 */
export async function clearDriveQueue(): Promise<void> {
    try {
        const db = await getDb();
        await db.clear(QUEUE_STORE);
        await saveDriveMetadata({ pendingCount: 0 });
    } catch (error) {
        console.warn('Error clearing queue', error);
    }
}

/**
 * Multi-tab synchronization lock to prevent simultaneous concurrent uploads.
 * Uses Web Locks API (`navigator.locks`) with an IndexedDB/localStorage fallback.
 */
export async function withDriveSyncLock<T>(action: () => Promise<T>): Promise<T | null> {
    // 1. Check navigator.locks if available
    if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks?.request) {
        try {
            return await navigator.locks.request(
                'tgs_gdrive_sync_mutex',
                { ifAvailable: true },
                async (lock) => {
                    if (!lock) {
                        console.log('[DriveSync] Another tab holds the lock. Skipping redundant sync.');
                        return null;
                    }
                    return await action();
                }
            );
        } catch (e) {
            console.warn('[DriveSync] Web Lock error, using timestamp lock fallback', e);
        }
    }

    // 2. Fallback: Timestamp-based lock with 45-second expiry
    const now = Date.now();
    try {
        const rawLock = localStorage.getItem(LOCK_KEY);
        if (rawLock) {
            const lockTs = parseInt(rawLock, 10);
            if (now - lockTs < 45000) {
                console.log('[DriveSync] Fallback lock active. Skipping concurrent sync.');
                return null;
            }
        }
        localStorage.setItem(LOCK_KEY, String(now));
        try {
            return await action();
        } finally {
            localStorage.removeItem(LOCK_KEY);
        }
    } catch {
        return await action();
    }
}
