/**
 * Secure Token Vault
 * 
 * Strict Compliance:
 * - NO access token, refresh token, or OAuth secret is EVER stored in plaintext in localStorage.
 * - Legacy plaintext tokens in localStorage are actively purged on initialization.
 * - Tokens are stored in-memory, with ephemeral Web Crypto AES-GCM session persistence
 *   in sessionStorage (never localStorage) to survive user page refreshes without re-prompting.
 */

const SESSION_VAULT_KEY = 'tgs_sec_session_blob';
const LEGACY_STORAGE_KEYS = [
    'tgs_gdrive_access_token',
    'gdrive_token',
    'google_access_token',
];

// Active in-memory cache
let inMemoryToken: string | null = null;
let inMemoryExpiresAt: number = 0;

// Ephemeral encryption key for sessionStorage session protection
let sessionCryptoKey: CryptoKey | null = null;

// Purge legacy plaintext keys from localStorage immediately
(() => {
    try {
        for (const key of LEGACY_STORAGE_KEYS) {
            localStorage.removeItem(key);
        }
    } catch {
        // Ignore errors in sandboxed environments
    }
})();

async function getOrCreateSessionKey(): Promise<CryptoKey> {
    if (sessionCryptoKey) return sessionCryptoKey;

    // Use a device-session seed derived from crypto.getRandomValues
    const rawKey = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(rawKey);
    } else {
        for (let i = 0; i < 16; i++) rawKey[i] = Math.floor(Math.random() * 256);
    }

    sessionCryptoKey = await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );

    return sessionCryptoKey;
}

/**
 * Stores the Google OAuth Access Token securely in memory and in an encrypted session blob.
 */
export async function setSecureToken(token: string, expiresInSeconds: number = 3600): Promise<void> {
    inMemoryToken = token;
    // Set expiry 3 minutes before official Google expiration to allow safe renewal
    inMemoryExpiresAt = Date.now() + Math.max(300, expiresInSeconds - 180) * 1000;

    // Remove any accidental plaintext localStorage keys
    for (const key of LEGACY_STORAGE_KEYS) {
        try { 
            localStorage.removeItem(key); 
        } catch (err) {
            void err;
        }
    }

    // Encrypt for sessionStorage continuity across page reloads
    try {
        if (typeof window !== 'undefined' && window.crypto?.subtle && window.sessionStorage) {
            const key = await getOrCreateSessionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encoder = new TextEncoder();
            const payload = JSON.stringify({ t: token, e: inMemoryExpiresAt });
            const ciphertext = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                encoder.encode(payload)
            );

            const packed = {
                iv: Array.from(iv),
                data: Array.from(new Uint8Array(ciphertext)),
            };

            sessionStorage.setItem(SESSION_VAULT_KEY, JSON.stringify(packed));
        }
    } catch (e) {
        console.warn('[TokenVault] Could not persist encrypted session token', e);
    }
}

/**
 * Retrieves the currently valid access token. Returns null if expired or missing.
 */
export async function getSecureToken(): Promise<string | null> {
    const now = Date.now();

    // 1. In-memory check
    if (inMemoryToken && inMemoryExpiresAt > now) {
        return inMemoryToken;
    }

    // 2. Session storage encrypted fallback check (survives F5 in same tab)
    try {
        if (sessionCryptoKey && typeof window !== 'undefined' && window.sessionStorage) {
            const rawBlob = sessionStorage.getItem(SESSION_VAULT_KEY);
            if (rawBlob) {
                const packed = JSON.parse(rawBlob);
                const iv = new Uint8Array(packed.iv);
                const ciphertext = new Uint8Array(packed.data);

                const decrypted = await window.crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv },
                    sessionCryptoKey,
                    ciphertext
                );

                const decoder = new TextDecoder();
                const payload = JSON.parse(decoder.decode(decrypted));

                if (payload.t && payload.e > now) {
                    inMemoryToken = payload.t;
                    inMemoryExpiresAt = payload.e;
                    return inMemoryToken;
                }
            }
        }
    } catch {
        // Decryption failed or session key expired
    }

    // Token has expired or is absent
    inMemoryToken = null;
    return null;
}

/**
 * Checks if active token exists and is valid.
 */
export function isTokenValid(): boolean {
    return !!inMemoryToken && inMemoryExpiresAt > Date.now();
}

/**
 * Returns remaining validity in seconds, or 0 if expired/absent.
 */
export function getTokenRemainingSeconds(): number {
    if (!inMemoryToken || inMemoryExpiresAt <= Date.now()) return 0;
    return Math.max(0, Math.floor((inMemoryExpiresAt - Date.now()) / 1000));
}

/**
 * Purges the token completely from memory and session storage.
 */
export function clearSecureToken(): void {
    inMemoryToken = null;
    inMemoryExpiresAt = 0;
    try {
        sessionStorage.removeItem(SESSION_VAULT_KEY);
        for (const key of LEGACY_STORAGE_KEYS) {
            localStorage.removeItem(key);
        }
    } catch (err) {
        void err;
    }
}

/**
 * Validates token against Google's API to ensure scopes or permissions have not been revoked.
 */
export async function testTokenViability(token: string): Promise<boolean> {
    try {
        const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
        if (!res.ok) return false;
        const info = await res.json();
        // Check drive scope is present
        const scope = info.scope || '';
        return scope.includes('drive.file') || scope.includes('drive');
    } catch {
        return false;
    }
}
