/**
 * Utilitaire de gestion du nom distinctif de l'application pour les sauvegardes
 * (Google Drive, exports locaux JSON, emails et archives).
 * 
 * Permet de distinguer immédiatement sur Google Drive les sauvegardes de
 * cette application dédiée (RM Macbook) de celles d'autres applications.
 */

export const DEFAULT_BACKUP_APP_NAME = 'RM_MACBOOK';
export const STORAGE_KEY_BACKUP_APP_IDENTIFIER = 'tgs_backup_app_identifier';

/**
 * Récupère le nom d'identification actuel de l'application pour les sauvegardes.
 * Défaut : 'RM_MACBOOK' (RM Macbook)
 */
export const getBackupAppIdentifier = (): string => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return DEFAULT_BACKUP_APP_NAME;
        }

        const custom = localStorage.getItem(STORAGE_KEY_BACKUP_APP_IDENTIFIER);
        if (custom && custom.trim()) {
            const cleaned = custom.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
            // Si c'était l'ancien défaut provisoire "INVESTISSEMENT", on bascule sur "RM_MACBOOK" demandé
            if (cleaned === 'INVESTISSEMENT') {
                localStorage.setItem(STORAGE_KEY_BACKUP_APP_IDENTIFIER, DEFAULT_BACKUP_APP_NAME);
                return DEFAULT_BACKUP_APP_NAME;
            }
            return cleaned;
        }

        // Vérification éventuelle dans les appSettings
        const storedSettings = localStorage.getItem('mac-repair-app-appSettings') || localStorage.getItem('appSettings');
        if (storedSettings) {
            try {
                const parsed = JSON.parse(storedSettings);
                if (parsed.backupAppIdentifier && typeof parsed.backupAppIdentifier === 'string') {
                    const cleaned = parsed.backupAppIdentifier.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
                    if (cleaned === 'INVESTISSEMENT') return DEFAULT_BACKUP_APP_NAME;
                    return cleaned;
                }
            } catch {
                // Ignore parse errors
            }
        }
    } catch (e) {
        console.warn("Impossible de lire l'identifiant de sauvegarde:", e);
    }
    return DEFAULT_BACKUP_APP_NAME;
};

/**
 * Enregistre un nouveau nom d'identification de sauvegarde pour l'application.
 */
export const setBackupAppIdentifier = (name: string): string => {
    let sanitized = name.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    if (!sanitized) {
        sanitized = DEFAULT_BACKUP_APP_NAME;
    }

    try {
        localStorage.setItem(STORAGE_KEY_BACKUP_APP_IDENTIFIER, sanitized);
        window.dispatchEvent(new CustomEvent('backup-identifier-changed', { detail: sanitized }));
    } catch (e) {
        console.warn("Impossible d'enregistrer l'identifiant de sauvegarde:", e);
    }

    return sanitized;
};

/**
 * Formate un nom lisible pour l'interface (ex: 'RM_MACBOOK' -> 'RM Macbook')
 */
export const formatAppIdentifierDisplay = (id: string): string => {
    if (!id) return 'RM Macbook';
    if (id === 'RM_MACBOOK') return 'RM Macbook';
    if (id === 'INVESTISSEMENT') return 'Investissement';
    return id.replace(/_/g, ' ');
};

/**
 * Formate un nom de fichier standardisé et classable commençant par l'identifiant de l'application.
 * Ex: RM_MACBOOK_2026-09-22_10h45_TGS-CI_FULL_ARCHIVE_Macintosh.json
 */
export const formatBackupFileName = (
    type: 'FULL' | 'FINANCE' | 'TECH' | 'MAIL' = 'FULL',
    customIdentifier?: string
): string => {
    const id = (customIdentifier || getBackupAppIdentifier() || DEFAULT_BACKUP_APP_NAME)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '_');

    const now = new Date();
    const datePart = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timePart = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const deviceName = (typeof navigator !== 'undefined' && (navigator.userAgent.match(/(Macintosh|Windows|iPhone|Android)/) || ['Atelier'])[0]) || 'Atelier';

    return `${id}_${datePart}_${timePart}_TGS-CI_${type}_ARCHIVE_${deviceName}.json`;
};
