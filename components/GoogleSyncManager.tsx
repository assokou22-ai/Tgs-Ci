import React, { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { 
    backupData, 
    compileFullBackupData, 
    restoreFullDatabase, 
    mergeDatabaseFromFile, 
    getDatabaseSummary 
} from '../services/backupService.ts';
import { 
    uploadBackupToDrive, 
    listBackupsFromDrive, 
    downloadBackupFromDrive, 
    sendBackupEmail, 
    DriveBackupFile 
} from '../services/googleWorkspaceService.ts';
import useDeviceHistory from '../hooks/useDeviceHistory.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { 
    addSyncLog, 
    getSyncLogs, 
    clearSyncLogs, 
    SyncLogEntry 
} from '../utils/syncLogHelper.ts';
import { 
    Cloud, 
    Mail, 
    Download, 
    Upload, 
    History, 
    RefreshCw, 
    User, 
    FileJson, 
    Smartphone, 
    MapPin, 
    CheckCircle,
    HardDrive,
    Trash,
    Edit2,
    Tag,
    Check
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { 
    getBackupAppIdentifier, 
    setBackupAppIdentifier, 
    DEFAULT_BACKUP_APP_NAME, 
    formatBackupFileName,
    formatAppIdentifierDisplay
} from '../utils/backupIdentifier.ts';

const GoogleSyncManager: React.FC = () => {
    const { showToast } = useToastContext();
    const { 
        user, 
        googleAccessToken, 
        driveSyncStatus, 
        driveMetadata, 
        signInWithGoogle, 
        switchGoogleAccount, 
        signOutUser, 
        disableGoogleSync, 
        toggleAutoSync 
    } = useFirebase();
    const { sessions, loading: loadingSessions } = useDeviceHistory();

    const [activeTab, setActiveTab] = useState<'sync' | 'security' | 'logs'>('sync');
    const { settings, updateSettings } = useAppSettings();
    const emailsList = settings.syncEmails || ['contact@tgs-ci.com'];

    const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
    const [localStats, setLocalStats] = useState({ tickets: 0, stock: 0, finance: 0, documents: 0 });
    const [backupEmail, setBackupEmail] = useState('');
    const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
    
    // Email management states
    const [editingEmailIndex, setEditingEmailIndex] = useState<number | null>(null);
    const [editingEmailValue, setEditingEmailValue] = useState('');
    const [newEmailValue, setNewEmailValue] = useState('');
    const [showAddNewEmail, setShowAddNewEmail] = useState(false);

    // Status Trackers
    const [isSavingToDrive, setIsSavingToDrive] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isLoadingDriveList, setIsLoadingDriveList] = useState(false);
    const [isLocalDownloading, setIsLocalDownloading] = useState(false);
    const [isProcessingRestore, setIsProcessingRestore] = useState(false);
    const [actionProgressMsg, setActionProgressMsg] = useState('');

    // Modal Confirmation Trackers
    const [restoreTargetFile, setRestoreTargetFile] = useState<DriveBackupFile | null>(null);
    const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite' | null>(null);

    // Application Backup Identifier (ex: INVESTISSEMENT)
    const [appIdentifier, setAppIdentifier] = useState<string>(() => getBackupAppIdentifier());
    const [isEditingIdentifier, setIsEditingIdentifier] = useState<boolean>(false);
    const [tempIdentifier, setTempIdentifier] = useState<string>(() => getBackupAppIdentifier());

    // Load Local Data Stats and Recipient Email on Mount
    useEffect(() => {
        refreshLocalStats();
        
        const savedEmail = localStorage.getItem('tgs_backup_recipient_email');
        const currentEmails = settings.syncEmails || ['contact@tgs-ci.com'];
        if (savedEmail) {
            setBackupEmail(savedEmail);
        } else if (currentEmails.length > 0) {
            setBackupEmail(currentEmails[0]);
            localStorage.setItem('tgs_backup_recipient_email', currentEmails[0]);
        }
        
        // Initial load of logs
        setSyncLogs(getSyncLogs());
        
        // Listen to log changes
        const handleLogsUpdated = () => {
            setSyncLogs(getSyncLogs());
        };
        window.addEventListener('synclogs_updated', handleLogsUpdated);

        // Listen to backup identifier updates
        const handleIdentifierUpdated = (e: Event) => {
            const ce = e as CustomEvent<string>;
            if (ce.detail) {
                setAppIdentifier(ce.detail);
                setTempIdentifier(ce.detail);
            }
        };
        window.addEventListener('backup-identifier-changed', handleIdentifierUpdated);

        return () => {
            window.removeEventListener('synclogs_updated', handleLogsUpdated);
            window.removeEventListener('backup-identifier-changed', handleIdentifierUpdated);
        };
    }, [user, refreshLocalStats, settings.syncEmails]);

    // Track active token to reload Google Drive backups list automatically
    useEffect(() => {
        if (googleAccessToken) {
            fetchDriveBackupsList();
        } else {
            setDriveBackups([]);
        }
    }, [googleAccessToken, fetchDriveBackupsList]);

    const refreshLocalStats = useCallback(async () => {
        try {
            const stats = await getDatabaseSummary();
            setLocalStats(stats);
        } catch (e) {
            console.error("Failed to fetch database summary", e);
        }
    }, []);

    const fetchDriveBackupsList = useCallback(async () => {
        if (!googleAccessToken) return;
        setIsLoadingDriveList(true);
        try {
            const list = await listBackupsFromDrive(googleAccessToken, appIdentifier);
            setDriveBackups(list);
        } catch (e: unknown) {
            console.error("Failed to list Google Drive backups:", e);
            showToast("Échec de la récupération de la liste des sauvegardes Drive", "error");
        } finally {
            setIsLoadingDriveList(false);
        }
    }, [googleAccessToken, appIdentifier, showToast]);

    const handleAddSyncEmail = () => {
        if (!newEmailValue.trim()) return;
        const email = newEmailValue.trim().toLowerCase();
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast("Veuillez saisir une adresse email de synchronisation valide.", "error");
            return;
        }
        if (emailsList.includes(email)) {
            showToast("Cette adresse email figure déjà dans la liste.", "warning");
            return;
        }

        const newList = [...emailsList, email];
        updateSettings('syncEmails', newList);
        setNewEmailValue('');
        setShowAddNewEmail(false);
        showToast("Adresse de synchronisation ajoutée !", "success");
    };

    const handleStartEditEmail = (index: number) => {
        setEditingEmailIndex(index);
        setEditingEmailValue(emailsList[index]);
    };

    const handleSaveEditEmail = (index: number) => {
        if (!editingEmailValue.trim()) return;
        const email = editingEmailValue.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast("Veuillez saisir une adresse email de synchronisation valide.", "error");
            return;
        }

        const newList = [...emailsList];
        newList[index] = email;
        updateSettings('syncEmails', newList);
        
        // Update recipient email if we edited the active one
        if (backupEmail === emailsList[index]) {
            setBackupEmail(email);
            localStorage.setItem('tgs_backup_recipient_email', email);
        }

        setEditingEmailIndex(null);
        showToast("Adresse e-mail mise à jour !", "success");
    };

    const handleDeleteSyncEmail = (index: number) => {
        if (emailsList.length === 1) {
            showToast("Vous devez conserver au moins une adresse de synchronisation.", "warning");
            return;
        }
        const newList = [...emailsList];
        const removed = newList.splice(index, 1)[0];
        updateSettings('syncEmails', newList);

        // Update the current active backupEmail if the deleted one was selected
        if (backupEmail === removed) {
            const fallback = newList[0];
            setBackupEmail(fallback);
            localStorage.setItem('tgs_backup_recipient_email', fallback);
        }

        showToast("Adresse de synchronisation retirée !", "success");
    };

    const handleSaveAppIdentifier = () => {
        const cleaned = setBackupAppIdentifier(tempIdentifier);
        setAppIdentifier(cleaned);
        setTempIdentifier(cleaned);
        setIsEditingIdentifier(false);
        showToast(`Nom de sauvegarde appliqué : ${cleaned}`, "success");
        if (googleAccessToken) {
            fetchDriveBackupsList();
        }
    };

    const handleResetAppIdentifier = () => {
        const cleaned = setBackupAppIdentifier(DEFAULT_BACKUP_APP_NAME);
        setAppIdentifier(cleaned);
        setTempIdentifier(cleaned);
        setIsEditingIdentifier(false);
        showToast(`Nom de sauvegarde réinitialisé sur : ${DEFAULT_BACKUP_APP_NAME}`, "info");
        if (googleAccessToken) {
            fetchDriveBackupsList();
        }
    };

    // 1. Google Drive Online Backup
    const handleBackupToDriveOnline = async () => {
        if (!googleAccessToken) {
            showToast("Veuillez connecter votre compte Google pour cette opération", "warning");
            return;
        }

        setIsSavingToDrive(true);
        setActionProgressMsg("Compilation de l'archive...");
        try {
            const backupPayload = await compileFullBackupData();
            
            // Format distinctive ISO sortable filename with application identifier
            const fileName = formatBackupFileName('FULL', appIdentifier);

            setActionProgressMsg("Téléversement sécurisé vers votre Google Drive...");
            await uploadBackupToDrive(googleAccessToken, backupPayload, fileName);
            showToast("Sauvegarde enregistrée avec succès sur votre Google Drive !", "success");
            
            addSyncLog(
                'Google Drive',
                'Téléversement (Backup)',
                'success',
                user?.email || 'Administrateur',
                `Fichier sauvegardé avec succès sur Drive: "${fileName}"`
            );

            // Refresh list
            fetchDriveBackupsList();
        } catch (e: unknown) {
            console.error("Google Drive upload error:", e);
            const errMsg = e instanceof Error ? e.message : String(e);
            showToast(`Erreur de sauvegarde en ligne : ${errMsg}`, "error");
            
            addSyncLog(
                'Google Drive',
                'Téléversement (Backup)',
                'error',
                user?.email || 'Administrateur',
                `Échec de la sauvegarde sur Drive: ${errMsg}`
            );
            window.dispatchEvent(new CustomEvent('syncerror', { detail: { message: `Échec Sauvegarde Drive : ${errMsg}` } }));
        } finally {
            setIsSavingToDrive(false);
            setActionProgressMsg('');
        }
    };

    // 2. Email Backup
    const handleSendBackupViaEmail = async () => {
        if (!googleAccessToken) {
            showToast("Veuillez connecter votre compte Google pour autoriser l'envoi d'emails", "warning");
            return;
        }
        if (!backupEmail || !backupEmail.includes('@')) {
            showToast("Veuillez spécifier une adresse email valide pour l'envoi", "error");
            return;
        }

        setIsSendingEmail(true);
        setActionProgressMsg("Création du pack de sauvegarde...");
        try {
            const backupPayload = await compileFullBackupData();
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
            const fileName = `${appIdentifier}_${dateStr}_${timeStr}_TGS-CI_FULL_ARCHIVE_MAIL.json`;

            setActionProgressMsg(`Envoi du mail de sauvegarde à ${backupEmail}...`);
            await sendBackupEmail(googleAccessToken, backupEmail, backupPayload, fileName);
            showToast(`La sauvegarde a été envoyée par email à ${backupEmail} !`, "success");

            addSyncLog(
                'Email',
                'Envoi Email',
                'success',
                user?.email || 'Administrateur',
                `E-mail envoyé avec succès avec la pièce jointe à ${backupEmail}`
            );
        } catch (e: unknown) {
            console.error("Gmail send backup error:", e);
            const errMsg = e instanceof Error ? e.message : String(e);
            showToast(`Erreur lors de l'envoi du mail : ${errMsg}`, "error");

            addSyncLog(
                'Email',
                'Envoi Email',
                'error',
                user?.email || 'Administrateur',
                `Échec de l'envoi d'email à ${backupEmail} : ${errMsg}`
            );
            window.dispatchEvent(new CustomEvent('syncerror', { detail: { message: `Échec Envoi Email : ${errMsg}` } }));
        } finally {
            setIsSendingEmail(false);
            setActionProgressMsg('');
        }
    };

    // 3. Offline Download
    const handleDownloadLocalFile = async () => {
        setIsLocalDownloading(true);
        try {
            await backupData('FULL');
            showToast("Fichier archive .json téléchargé localement.", "success");

            addSyncLog(
                'Offline JSON',
                'Fichier Local',
                'success',
                user?.email || 'Administrateur',
                `Téléchargement du fichier de sauvegarde locale réussi`
            );
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            showToast("Échec du téléchargement local", "error");

            addSyncLog(
                'Offline JSON',
                'Fichier Local',
                'error',
                user?.email || 'Administrateur',
                `Échec de la génération locale : ${errMsg}`
            );
            window.dispatchEvent(new CustomEvent('syncerror', { detail: { message: `Échec Génération JSON : ${errMsg}` } }));
        } finally {
            setIsLocalDownloading(false);
        }
    };

    // 4. Offline Restore Upload
    const handleLocalRestoreUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const rawParsed = JSON.parse(e.target?.result as string);
                
                // Confirm with user
                const go = window.confirm(`Fusionner l'archive sélectionnée "${file.name}" avec votre base locale actuelle ? (Recommandé : Fusion Delta)`);
                if (!go) return;

                setIsProcessingRestore(true);
                setActionProgressMsg("Intégration et fusion des fiches...");
                await mergeDatabaseFromFile(rawParsed, (status) => setActionProgressMsg(status));
                showToast("Base de données fusionnée avec succès à partir du fichier local !", "success");
                
                addSyncLog(
                    'Offline JSON',
                    'Restauration (Import)',
                    'success',
                    user?.email || 'Administrateur',
                    `Base restaurée/fusionnée à partir de l'archive locale: "${file.name}"`
                );

                refreshLocalStats();
                setTimeout(() => window.location.reload(), 1000);
            } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : String(err);
                showToast("Fichier invalide ou corrompu.", "error");
                
                addSyncLog(
                    'Offline JSON',
                    'Restauration (Import)',
                    'error',
                    user?.email || 'Administrateur',
                    `Échec d'importation d'archive locale "${file.name}": ${errMsg}`
                );
                window.dispatchEvent(new CustomEvent('syncerror', { detail: { message: `Échec Restauration locale: ${errMsg}` } }));
            } finally {
                setIsProcessingRestore(false);
                setActionProgressMsg('');
            }
        };
        reader.readAsText(file);
    };

    // 5. Google Drive Remote Restore Trigger
    const triggerDriveRestore = (file: DriveBackupFile, mode: 'merge' | 'overwrite') => {
        setRestoreTargetFile(file);
        setRestoreMode(mode);
    };

    const handleConfirmDriveRestore = async () => {
        if (!googleAccessToken || !restoreTargetFile || !restoreMode) return;
        
        const fileToRestore = restoreTargetFile;
        const mode = restoreMode;
        
        // Hide modal
        setRestoreTargetFile(null);
        setRestoreMode(null);

        setIsProcessingRestore(true);
        setActionProgressMsg("Téléchargement de l'archive depuis Drive...");
        try {
            const data = await downloadBackupFromDrive(googleAccessToken, fileToRestore.id);
            
            setActionProgressMsg(mode === 'merge' ? "Fusion et comparaison des dates..." : "Écrasement complet de la base...");
            
            if (mode === 'merge') {
                await mergeDatabaseFromFile(data, (m) => setActionProgressMsg(m));
                showToast("Fichiers synchronisés et fusionnés depuis Google Drive !", "success");
                
                addSyncLog(
                    'Google Drive',
                    'Restauration (Import)',
                    'success',
                    user?.email || 'Administrateur',
                    `Fusion Delta réussie à partir de Google Drive: "${fileToRestore.name}"`
                );
            } else {
                await restoreFullDatabase(data, (m) => setActionProgressMsg(m));
                showToast("Restauration totale exécutée avec succès depuis Google Drive !", "success");
                
                addSyncLog(
                    'Google Drive',
                    'Restauration (Import)',
                    'success',
                    user?.email || 'Administrateur',
                    `Restauration brute d'écrasement réussie à partir de Google Drive: "${fileToRestore.name}"`
                );
            }
            
            refreshLocalStats();
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: unknown) {
            console.error("Google Drive Restore Failed :", e);
            const errMsg = e instanceof Error ? e.message : String(e);
            showToast(`Erreur de restauration Drive : ${errMsg}`, "error");

            addSyncLog(
                'Google Drive',
                'Restauration (Import)',
                'error',
                user?.email || 'Administrateur',
                `Échec de restauration Google Drive pour "${fileToRestore.name}": ${errMsg}`
            );
            window.dispatchEvent(new CustomEvent('syncerror', { detail: { message: `Échec Restauration Google Drive : ${errMsg}` } }));
        } finally {
            setIsProcessingRestore(false);
            setActionProgressMsg('');
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            
            {/* Action Banner Loader */}
            {isProcessingRestore || isSavingToDrive || isSendingEmail ? (
                <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-6">
                    <div className="bg-gray-800 border border-gray-700 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl animate-fade-in">
                        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                        <h4 className="text-xl font-bold text-white">Opération en cours</h4>
                        <p className="text-sm text-gray-400 font-medium">{actionProgressMsg}</p>
                    </div>
                </div>
            ) : null}

            {/* Sub-header Navigation Tabs */}
            <div className="flex flex-wrap border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('sync')}
                    className={`flex items-center gap-2 px-6 py-4 font-bold text-sm uppercase tracking-wider border-b-2 transition-all ${
                        activeTab === 'sync' 
                            ? 'border-blue-500 text-blue-500' 
                            : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                    <Cloud className="w-4 h-4" />
                    Synchronisation & Google Drive
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 px-6 py-4 font-bold text-sm uppercase tracking-wider border-b-2 transition-all ${
                        activeTab === 'logs' 
                            ? 'border-amber-500 text-amber-500' 
                            : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                    <FileJson className="w-4 h-4" />
                    Journal de Bord (Sync Logs)
                </button>
                <button
                    onClick={() => setActiveTab('security')}
                    className={`flex items-center gap-2 px-6 py-4 font-bold text-sm uppercase tracking-wider border-b-2 transition-all ${
                        activeTab === 'security' 
                            ? 'border-red-500 text-red-500' 
                            : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                    <History className="w-4 h-4" />
                    Historique & Audit de Sécurité
                </button>
            </div>

            {activeTab === 'sync' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Column 1: Connection & Sync Profile */}
                    <div className="lg:col-span-1 space-y-6">
                        
                        {/* Application Backup Identifier Card */}
                        <div className="bg-gray-800/40 border border-blue-500/30 rounded-2xl p-6 space-y-4 shadow-lg">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-blue-400" /> Nom de sauvegarde dédié (RM Macbook) :
                                </h3>
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                    {formatAppIdentifierDisplay(appIdentifier)}
                                </span>
                            </div>

                            <p className="text-xs text-gray-300 leading-relaxed">
                                Préfixe distinctif appliqué à tous vos fichiers de sauvegarde sur Google Drive pour identifier immédiatement cette application d'atelier comme <strong>RM Macbook</strong> et la distinguer de vos autres applications.
                            </p>

                            <div className="p-3.5 bg-zinc-950/70 rounded-xl border border-white/5 space-y-2.5">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex justify-between items-center">
                                    <span>Identifiant actif :</span>
                                    {appIdentifier !== DEFAULT_BACKUP_APP_NAME && !isEditingIdentifier && (
                                        <button
                                            onClick={handleResetAppIdentifier}
                                            className="text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
                                            title="Rétablir RM Macbook"
                                        >
                                            Rétablir RM Macbook
                                        </button>
                                    )}
                                </div>

                                {isEditingIdentifier ? (
                                    <div className="space-y-2.5">
                                        <input
                                            type="text"
                                            value={tempIdentifier}
                                            onChange={(e) => setTempIdentifier(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '_'))}
                                            placeholder="Ex: RM_MACBOOK"
                                            className="w-full px-3 py-2 bg-gray-900 border border-blue-500/60 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-blue-400"
                                        />

                                        {/* Presets rapides */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Suggestions :</span>
                                            <button
                                                type="button"
                                                onClick={() => setTempIdentifier('RM_MACBOOK')}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                                    tempIdentifier === 'RM_MACBOOK'
                                                        ? 'bg-blue-600 text-white border border-blue-400'
                                                        : 'bg-zinc-900 hover:bg-zinc-800 text-gray-300 border border-white/10'
                                                }`}
                                            >
                                                RM Macbook (Dédié)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTempIdentifier('INVESTISSEMENT')}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                                    tempIdentifier === 'INVESTISSEMENT'
                                                        ? 'bg-emerald-600 text-white border border-emerald-400'
                                                        : 'bg-zinc-900 hover:bg-zinc-800 text-gray-300 border border-white/10'
                                                }`}
                                            >
                                                Investissement
                                            </button>
                                        </div>

                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={handleSaveAppIdentifier}
                                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1 transition-all"
                                            >
                                                <Check className="w-3.5 h-3.5" /> Enregistrer
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setTempIdentifier(appIdentifier);
                                                    setIsEditingIdentifier(false);
                                                }}
                                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-blue-400 font-mono tracking-wide">
                                                {appIdentifier}
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                ({formatAppIdentifierDisplay(appIdentifier)})
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setTempIdentifier(appIdentifier);
                                                setIsEditingIdentifier(true);
                                            }}
                                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-all"
                                        >
                                            <Edit2 className="w-3 h-3 text-blue-400" /> Modifier
                                        </button>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-white/5 space-y-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Aperçu du nom sur Google Drive :</span>
                                    <div className="p-2 bg-black/40 rounded-lg border border-blue-500/20 text-[11px] font-mono text-blue-300 break-all select-all">
                                        {formatBackupFileName('FULL', appIdentifier)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Account Status / Profile connection info */}
                        <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-6 space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Cloud className="w-4 h-4 text-blue-500" /> Paramètres Google Drive
                                </h3>
                                {/* Discrete Status Indicator */}
                                {driveSyncStatus === 'synced' && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                        Synchronisé
                                    </span>
                                )}
                                {driveSyncStatus === 'syncing' && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                        <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                                        Sync en cours
                                    </span>
                                )}
                                {driveSyncStatus === 'offline_pending' && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                        En attente hors ligne ({driveMetadata.pendingCount || 1})
                                    </span>
                                )}
                                {driveSyncStatus === 'action_required' && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                        Action requise
                                    </span>
                                )}
                            </div>

                            {user || driveMetadata.driveConnected ? (
                                <div className="space-y-4">
                                    {/* User card */}
                                    <div className="flex items-center gap-3.5 bg-gray-900/60 p-3 rounded-xl border border-gray-700/40">
                                        {user?.photoURL ? (
                                            <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" className="w-11 h-11 rounded-full border border-blue-500/40" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-blue-600/80 flex items-center justify-center font-bold text-white text-base">
                                                {user?.displayName?.[0] || driveMetadata.connectedEmail?.[0] || 'G'}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-white truncate">
                                                {user?.displayName || "Compte Google Connecté"}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">
                                                {user?.email || driveMetadata.connectedEmail || "Compte autorisé"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Last Sync Timestamp */}
                                    <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/5 space-y-1">
                                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                            <span>Dernière synchronisation :</span>
                                            <span className="text-blue-400 font-mono">
                                                {driveMetadata.lastSyncTime 
                                                    ? new Date(driveMetadata.lastSyncTime).toLocaleString('fr-FR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                    : 'En attente du premier cycle'
                                                }
                                            </span>
                                        </div>
                                        {driveMetadata.lastError && (
                                            <p className="text-[10px] text-amber-400/90 leading-tight pt-1 border-t border-white/5">
                                                Note : {driveMetadata.lastError}
                                            </p>
                                        )}
                                    </div>

                                    {/* Auto-Sync Toggle Switch */}
                                    <div className="flex items-center justify-between p-3 bg-zinc-950/60 rounded-xl border border-white/5">
                                        <div className="space-y-0.5 pr-2">
                                            <label htmlFor="auto-sync-toggle" className="text-xs font-bold text-white cursor-pointer select-none">
                                                Synchronisation automatique
                                            </label>
                                            <p className="text-[10px] text-gray-400 leading-tight">
                                                Envoi permanent et discret en arrière-plan à chaque modification et toutes les 8 min.
                                            </p>
                                        </div>
                                        <button
                                            id="auto-sync-toggle"
                                            type="button"
                                            role="switch"
                                            aria-checked={driveMetadata.autoSyncEnabled}
                                            onClick={() => toggleAutoSync(!driveMetadata.autoSyncEnabled)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                driveMetadata.autoSyncEnabled ? 'bg-blue-600' : 'bg-zinc-700'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                    driveMetadata.autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-2 pt-1">
                                        {/* Sync Now Button */}
                                        <button 
                                            id="gdrive-sync-now-btn"
                                            onClick={handleBackupToDriveOnline}
                                            disabled={isSavingToDrive}
                                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isSavingToDrive ? 'animate-spin' : ''}`} />
                                            {isSavingToDrive ? "Synchronisation en cours..." : "Synchroniser maintenant"}
                                        </button>

                                        {/* Action Required: Reauthorize / Connect button */}
                                        {driveSyncStatus === 'action_required' && (
                                            <button 
                                                id="gdrive-reauthorize-btn"
                                                onClick={() => signInWithGoogle(false)}
                                                className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
                                            >
                                                <RefreshCw className="w-4 h-4" /> Réautoriser Google Drive
                                            </button>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            {/* Change Account Button */}
                                            <button 
                                                id="gdrive-switch-account-btn"
                                                onClick={switchGoogleAccount}
                                                className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                title="Sélectionner un autre compte Google Drive"
                                            >
                                                <User className="w-3.5 h-3.5 text-blue-400" />
                                                Changer de compte
                                            </button>

                                            {/* Disconnect Google Drive Button */}
                                            <button 
                                                id="gdrive-disconnect-btn"
                                                onClick={disableGoogleSync}
                                                className="py-2 px-3 bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/40 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                title="Déconnecter la synchronisation Google Drive"
                                            >
                                                <Trash className="w-3.5 h-3.5 text-red-400" />
                                                Déconnecter
                                            </button>
                                        </div>

                                        {/* Atelier Sign out */}
                                        <button 
                                            id="logout-btn"
                                            onClick={signOutUser}
                                            className="w-full py-2 px-4 bg-gray-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-800/80 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                                        >
                                            Déconnecter de l&apos;Atelier
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 text-center py-4">
                                    <p className="text-sm text-gray-500">Aucun compte Google connecté pour la synchronisation en ligne.</p>
                                    <button
                                        onClick={() => signInWithGoogle(false)}
                                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Cloud className="w-4 h-4" /> Connexion Google Workspace
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Configuration de l'Email destinataire */}
                        <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-purple-500" /> Carnet d'Emails de Synchronisation
                                </h3>
                                <button
                                    onClick={() => setShowAddNewEmail(!showAddNewEmail)}
                                    className="text-[10px] font-black uppercase tracking-wider text-purple-400 hover:underline flex items-center gap-1"
                                >
                                    + Ajouter
                                </button>
                            </div>
                            <p className="text-xs text-gray-400">
                                Gérez les adresses de destination pour recevoir et synchroniser les sauvegardes. Cliquez sur une adresse pour la définir comme destinataire active.
                            </p>

                            {/* Add email form */}
                            {showAddNewEmail && (
                                <div className="p-3 bg-zinc-950/50 border border-gray-700 rounded-xl space-y-2 animate-fade-in">
                                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Nouvelle adresse de synchronisation</span>
                                    <div className="flex gap-2">
                                        <input 
                                            type="email" 
                                            value={newEmailValue}
                                            onChange={(e) => setNewEmailValue(e.target.value)}
                                            placeholder="Ex: sync@tgs-ci.com"
                                            className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 text-xs text-white rounded-lg outline-none focus:border-purple-500"
                                        />
                                        <button
                                            onClick={handleAddSyncEmail}
                                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider"
                                        >
                                            Sauver
                                        </button>
                                        <button
                                            onClick={() => { setShowAddNewEmail(false); setNewEmailValue(''); }}
                                            className="px-2.5 py-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-xs"
                                        >
                                            X
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Managed Emails list */}
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {emailsList.map((email, idx) => {
                                    const isActive = backupEmail === email;
                                    const isEditing = editingEmailIndex === idx;

                                    return (
                                        <div 
                                            key={idx}
                                            className={`p-3 bg-gray-900/40 border rounded-xl flex items-center justify-between gap-3 group transition-all ${
                                                isActive ? 'border-purple-500/55 bg-purple-500/5' : 'border-gray-800 hover:border-gray-700'
                                            }`}
                                        >
                                            {isEditing ? (
                                                <div className="flex-1 flex gap-2">
                                                    <input 
                                                        type="email"
                                                        value={editingEmailValue}
                                                        onChange={(e) => setEditingEmailValue(e.target.value)}
                                                        className="flex-1 px-2.5 py-1 bg-gray-950 border border-gray-700 text-xs text-white rounded-lg outline-none focus:border-purple-500"
                                                    />
                                                    <button 
                                                        onClick={() => handleSaveEditEmail(idx)}
                                                        className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[10px] font-bold uppercase"
                                                    >
                                                        Valider
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingEmailIndex(null)}
                                                        className="px-2 py-1 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-[10px]"
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button 
                                                        onClick={() => {
                                                            setBackupEmail(email);
                                                            localStorage.setItem('tgs_backup_recipient_email', email);
                                                            showToast(`Destinataire mis à jour : ${email}`, "success");
                                                        }}
                                                        className="flex-1 text-left flex items-center gap-2.5 min-w-0"
                                                    >
                                                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                                            isActive ? 'border-purple-500 text-purple-400' : 'border-gray-600'
                                                        }`}>
                                                            {isActive && <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />}
                                                        </div>
                                                        <span className={`text-xs truncate font-semibold tracking-tight ${isActive ? 'text-white font-extrabold' : 'text-gray-400'}`}>
                                                            {email}
                                                        </span>
                                                        {isActive && (
                                                            <span className="text-[8px] font-black uppercase text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/10">Active</span>
                                                        )}
                                                    </button>

                                                    <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            onClick={() => handleStartEditEmail(idx)}
                                                            className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-all"
                                                            title="Modifier l'email"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSyncEmail(idx)}
                                                            className="p-1 hover:bg-red-500/15 rounded text-gray-400 hover:text-rose-400 transition-all"
                                                            title="Supprimer l'email"
                                                        >
                                                            <Trash className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-3 pt-3 border-t border-gray-800/60">
                                <button
                                    disabled={isSendingEmail || !googleAccessToken || !backupEmail}
                                    onClick={handleSendBackupViaEmail}
                                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-45 disabled:hover:bg-purple-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                >
                                    <Mail className="w-4 h-4" /> Envoyer un mail de Backup à {backupEmail || '(Sélectionnez)'}
                                </button>
                                {!googleAccessToken && (
                                    <span className="block text-center text-[10px] text-gray-500 font-medium italic">
                                        * Nécessite un compte connecté
                                    </span>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Column 2: Synchronisation En Ligne & Google Drive */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Action buttons & Drive storage management */}
                        <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-6 space-y-6">
                            <div className="flex justify-between items-center border-b border-gray-700/50 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Cloud className="w-6 h-6 text-blue-500" /> Espace Google Drive et Cloud
                                    </h3>
                                    <p className="text-xs text-gray-400">Archiver vos données ou restaurer une version Cloud.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        disabled={isSavingToDrive || !googleAccessToken}
                                        onClick={handleBackupToDriveOnline}
                                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-1.5"
                                    >
                                        <Upload className="w-4 h-4" /> Nouveau Backup Cloud
                                    </button>
                                </div>
                            </div>

                            {/* Google Drive Files List */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Archives Drive de l'Application</span>
                                    <button 
                                        disabled={isLoadingDriveList || !googleAccessToken}
                                        onClick={fetchDriveBackupsList}
                                        className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700/50 transition-all"
                                        title="Rafraîchir"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isLoadingDriveList ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>

                                 {googleAccessToken ? (
                                    isLoadingDriveList ? (
                                        <p className="text-center py-8 text-sm text-gray-500 italic">Interrogation Google Drive en cours...</p>
                                    ) : driveBackups.length > 0 ? (
                                        <div className="border border-gray-700/30 rounded-xl overflow-hidden divide-y divide-gray-700/40 bg-gray-900/10">
                                            {driveBackups.map((file) => {
                                                const upperName = file.name.toUpperCase();
                                                const isRM = upperName.includes('RM_MACBOOK') || upperName.includes('MACBOOK');
                                                const isInvest = upperName.includes('INVESTISSEMENT');
                                                const isCurrentApp = upperName.startsWith(appIdentifier.toUpperCase());
                                                
                                                return (
                                                    <div key={file.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-700/20 transition-all">
                                                        <div className="space-y-1.5 min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {isRM ? (
                                                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1 shrink-0">
                                                                        <Tag className="w-3 h-3" /> RM Macbook
                                                                    </span>
                                                                ) : isInvest ? (
                                                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                                                                        <Tag className="w-3 h-3" /> Investissement
                                                                    </span>
                                                                ) : isCurrentApp ? (
                                                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shrink-0">
                                                                        <Tag className="w-3 h-3" /> {appIdentifier}
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-gray-700/40 text-gray-400 border border-gray-600/30 shrink-0">
                                                                        Archive générale
                                                                    </span>
                                                                )}
                                                                <p className="text-sm font-semibold text-white break-all">{file.name}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                                                                <span>Upload : {new Date(file.createdTime).toLocaleString('fr-FR')}</span>
                                                                {file.size && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span>Taille : {(parseInt(file.size, 10) / 1024).toFixed(1)} Ko</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 self-end sm:self-auto shrink-0">
                                                            <button
                                                                onClick={() => triggerDriveRestore(file, 'merge')}
                                                                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-bold uppercase transition-all"
                                                            >
                                                                Fusion Delta
                                                            </button>
                                                            <button
                                                                onClick={() => triggerDriveRestore(file, 'overwrite')}
                                                                className="px-3 py-1.5 bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-bold uppercase transition-all"
                                                            >
                                                                Restauration Écraser
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 bg-gray-900/10 border border-dashed border-gray-700/50 rounded-xl space-y-2">
                                            <Cloud className="w-8 h-8 text-gray-600 mx-auto" />
                                            <p className="text-sm text-gray-500">Aucun fichier de sauvegarde TGS-CI trouvé sur votre Drive.</p>
                                            <p className="text-[11px] text-gray-600">Cliquez sur « Nouveau Backup Cloud » pour l'archiver.</p>
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center py-10 bg-gray-900/10 border border-dashed border-gray-700/50 rounded-xl">
                                        <p className="text-sm text-gray-500 italic pb-2">Connectez votre compte pour afficher vos archives Drive.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Local Offline Controls */}
                        <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-6 space-y-4 text-left">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <HardDrive className="w-5 h-5 text-gray-400" /> Sauvegarde Hors Ligne & Locale (Directe)
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Archive locale actuelle : <strong className="text-blue-400">{localStats.tickets}</strong> fiches, <strong className="text-emerald-400">{localStats.stock}</strong> articles, <strong className="text-amber-400">{localStats.finance}</strong> écritures comptables, <strong className="text-purple-400">{localStats.documents}</strong> documents générés.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={handleDownloadLocalFile}
                                    disabled={isLocalDownloading}
                                    className="p-4 bg-gray-900/30 hover:bg-gray-900/60 disabled:opacity-50 border border-gray-700 rounded-xl text-left space-y-1.5 group transition-all"
                                >
                                    <div className="flex items-center gap-2">
                                        <Download className={`w-4 h-4 text-blue-400 ${isLocalDownloading ? 'animate-bounce' : 'group-hover:scale-110'} transition-transform`} />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                                            {isLocalDownloading ? 'Génération...' : `Télécharger archive (${appIdentifier})`}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-medium">Génère instantanément un fichier <code className="text-emerald-300 font-mono text-[10px]">{appIdentifier}_...json</code> dans vos téléchargements.</p>
                                </button>

                                <label className="p-4 bg-gray-900/30 hover:bg-gray-900/60 border border-gray-700 rounded-xl text-left space-y-1.5 group cursor-pointer transition-all">
                                    <div className="flex items-center gap-2">
                                        <Upload className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Restaurer fichier .json</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400">Sélectionnez un fichier .json local sur votre machine pour fusionner les fiches de dépôt.</p>
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        className="hidden" 
                                        onChange={handleLocalRestoreUpload} 
                                    />
                                </label>
                            </div>
                        </div>

                    </div>
                </div>
            ) : activeTab === 'logs' ? (
                /* Tab 3: Visual Sync Log Audit Trail */
                <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-6 space-y-5 animate-fade-in text-left">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FileJson className="w-5 h-5 text-amber-500" /> Journal de Bord & Statut de Synchronisation
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                Suivi en direct des sauvegardes et flux de synchronisation (Drive, Gmail, Sauvegardes Locales, Échanges Temps Réel).
                            </p>
                        </div>
                        {syncLogs.length > 0 && (
                            <button
                                onClick={() => {
                                    if(window.confirm("Voulez-vous vider l'historique complet du journal de synchronisation ?")) {
                                        clearSyncLogs();
                                        showToast("Le journal de synchronisation a été réinitialisé.", "success");
                                    }
                                }}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all self-start border border-red-500/20"
                            >
                                <Trash className="w-3.5 h-3.5" />
                                Vider le journal
                            </button>
                        )}
                    </div>

                    {syncLogs.length > 0 ? (
                        <div className="overflow-x-auto border border-gray-700/30 rounded-xl">
                            <table className="w-full text-sm text-left text-gray-300">
                                <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 font-black tracking-wider border-b border-gray-700/50 sticky top-0">
                                    <tr>
                                        <th className="px-5 py-3">Date / Heure</th>
                                        <th className="px-5 py-3">Canal</th>
                                        <th className="px-5 py-3">Opération</th>
                                        <th className="px-5 py-3">Statut</th>
                                        <th className="px-5 py-3">Opérateur</th>
                                        <th className="px-5 py-3">Détails de l'Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/30">
                                    {syncLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-700/20 transition-all font-medium">
                                            <td className="px-5 py-3.5 text-white whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString('fr-FR')}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className="text-xs text-slate-300 bg-gray-900/50 px-2.5 py-1 rounded-md border border-gray-700/40">
                                                    {log.type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-300 whitespace-nowrap">
                                                {log.action}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                {log.status === 'success' ? (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                        Réussite
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                                        Échec / Erreur
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-400 text-xs truncate max-w-[150px]">
                                                {log.operator}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-300 text-xs max-w-sm truncate" title={log.details}>
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-gray-950/20 border border-dashed border-gray-700/50 rounded-xl space-y-3">
                            <CheckCircle className="w-10 h-10 text-slate-600 mx-auto" />
                            <p className="text-sm text-gray-500 font-medium">Aucune opération enregistrée.</p>
                            <p className="text-[11px] text-gray-600">Les sauvegardes ou téléchargements que vous exécuterez s'afficheront ici en temps réel.</p>
                        </div>
                    )}
                </div>
            ) : (
                /* Tab 2: Security & Device History Viewer */
                <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-6 space-y-5 animate-fade-in">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <History className="w-5 h-5 text-red-500" /> Journal de Connexion & d'Audit Matériel
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                            Affichez l'ensemble des navigateurs, adresses IP, appareils connectés et géolocalorisations géographiques ayant accédé à votre instance.
                        </p>
                    </div>

                    {loadingSessions ? (
                        <p className="text-center py-10 text-sm text-gray-500 italic">Interrogation du registre sécurisé local...</p>
                    ) : sessions.length > 0 ? (
                        <div className="overflow-x-auto border border-gray-700/30 rounded-xl">
                            <table className="w-full text-sm text-left text-gray-300">
                                <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 font-black tracking-wider border-b border-gray-700/50 sticky top-0">
                                    <tr>
                                        <th className="px-5 py-3">Date & Heure</th>
                                        <th className="px-5 py-3">Opérateur (Email)</th>
                                        <th className="px-5 py-3">Système d'Exploitation</th>
                                        <th className="px-5 py-3">Navigateur</th>
                                        <th className="px-5 py-3">Adresse IP</th>
                                        <th className="px-5 py-3 col-span-2">Localisation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/30">
                                    {sessions.map((session) => (
                                        <tr key={session.id} className="hover:bg-gray-700/20 transition-all font-medium">
                                            <td className="px-5 py-3.5 text-white max-w-[150px] truncate">
                                                {new Date(session.timestamp).toLocaleString('fr-FR')}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-xs text-gray-300 bg-gray-900/40 px-2 py-0.5 rounded-md border border-gray-700/30">
                                                    {session.email || 'Opérateur Local'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 flex items-center gap-1.5 text-xs text-gray-200">
                                                <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                                                {session.os || 'Inconnu'}
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-gray-400">
                                                {session.browser || 'Inconnu'}
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-gray-250 font-mono text-blue-400">
                                                {session.ipAddress || 'Inconnue'}
                                            </td>
                                            <td className="px-5 py-3.5 max-w-[200px] truncate text-xs text-gray-400">
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                                    <span>{session.location || 'Indisponible'}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                {session.coordinates && session.coordinates !== 'Inconnues' && (
                                                    <a 
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.coordinates)}`} 
                                                        target="_blank" 
                                                        referrerPolicy="no-referrer"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] font-black uppercase text-blue-500 hover:underline hover:text-blue-400 bg-blue-500/10 px-2 py-1 rounded"
                                                    >
                                                        Google Map
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center py-10 bg-gray-950/20 rounded-xl text-sm text-gray-500 italic border border-dashed border-gray-700/50">
                            Aucune session de connexion enregistrée dans le journal.
                        </p>
                    )}
                </div>
            )}

            {/* Confirmation Modals for Google Drive Restore Actions */}
            <ConfirmationModal
                isOpen={restoreTargetFile !== null && restoreMode !== null}
                onClose={() => {
                    setRestoreTargetFile(null);
                    setRestoreMode(null);
                }}
                onConfirm={handleConfirmDriveRestore}
                title={restoreMode === 'merge' ? "Lancer une Fusion Delta ?" : "Confirmer la Restauration TOTALE ?"}
                message={restoreMode === 'merge' 
                    ? `Êtes-vous certain de vouloir importer la sauvegarde "${restoreTargetFile?.name}" ? Notre algorithme de fusion automatique synchronisera les modifications manquantes sans écraser vos modifications de fiches plus récentes.`
                    : `ATTENTION : Vous vous apprêtez à remplacer l'intégralité de la base de données locale par celle contenue dans "${restoreTargetFile?.name}". Toute modification locale non sauvegardée avant la restauration sera définitivement perdue.`
                }
                confirmText={restoreMode === 'merge' ? "Oui, Synchroniser et Fusionner" : "Oui, Écraser tout"}
            />
        </div>
    );
};

export default GoogleSyncManager;
