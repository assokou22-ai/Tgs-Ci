import { getBackupAppIdentifier } from '../utils/backupIdentifier.ts';

/**
 * Service for Google Workspace Integrations (Google Drive and Gmail)
 * Handles backup uploading/downloading and sending backups via email.
 */

/**
 * Uploads a schema backup to Google Drive as a structured JSON file.
 */
export const uploadBackupToDrive = async (
    accessToken: string,
    backupData: unknown,
    fileName: string
): Promise<string> => {
    const boundary = 'tgs_backup_multipart_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const appTag = fileName.split('_')[0] || getBackupAppIdentifier();

    const metadata = {
        name: fileName,
        mimeType: 'application/json',
        description: `Sauvegarde [${appTag}] - TGS-CI Repair Management Database Archive V4`,
    };

    const content = JSON.stringify(backupData, null, 2);

    const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        closeDelimiter;

    const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: body,
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur Google Drive Upload: ${errorText}`);
    }

    const file = await response.json();
    return file.id;
};

/**
 * Lists the JSON backup files in the user's Google Drive.
 */
export interface DriveBackupFile {
    id: string;
    name: string;
    createdTime: string;
    size?: string;
}

export const listBackupsFromDrive = async (accessToken: string, customIdentifier?: string): Promise<DriveBackupFile[]> => {
    const id = (customIdentifier || getBackupAppIdentifier() || 'RM_MACBOOK').replace(/'/g, '');
    // Recherche les archives JSON de cette application (RM_MACBOOK, INVESTISSEMENT) ainsi que les archives historiques TGS
    const q = `mimeType = 'application/json' and trashed = false and (name contains '${id}' or name contains 'RM_MACBOOK' or name contains 'RM' or name contains 'INVESTISSEMENT' or name contains 'TGS-CI' or name contains '_ARCHIVE_')`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur Google Drive List: ${errorText}`);
    }

    const data = await response.json();
    return data.files || [];
};

/**
 * Downloads a backup file from Google Drive and returns its JSON value.
 */
export const downloadBackupFromDrive = async (
    accessToken: string,
    fileId: string
): Promise<unknown> => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur Google Drive Download: ${errorText}`);
    }

    return response.json();
};

/**
 * Sends a structured, multi-part backup email on behalf of the user containing
 * the JSON file attachment via Gmail API.
 */
export const sendBackupEmail = async (
    accessToken: string,
    toEmail: string,
    backupData: unknown,
    fileName: string
): Promise<void> => {
    const appTag = fileName.split('_')[0] || getBackupAppIdentifier();
    const subject = `[${appTag}] Sauvegarde Système : ${new Date().toLocaleDateString('fr-FR')}`;
    const boundary = 'tgs_gmail_multipart_boundary';

    const textPart = [
        `Bonjour,`,
        ``,
        `Veuillez trouver ci-joint l'archive de sauvegarde de l'application [${appTag}] (TGS-CI Repair Management Pro).`,
        ``,
        `- Application : ${appTag}`,
        `- Fichier de sauvegarde : ${fileName}`,
        `- Date d'exportation : ${new Date().toLocaleString('fr-FR')}`,
        ``,
        `Cette sauvegarde contient l'ensemble du registre technique (réparations), du catalogue de stock, des factures, devis proforma, bons de commande, et de la configuration du système.`,
        ``,
        `Cordialement,`,
        `Le Gestionnaire de Sauvegarde TGS-CI (${appTag})`
    ].join('\n');

    const fileContent = JSON.stringify(backupData, null, 2);
    // Securely convert JSON data to Base64
    const base64Content = btoa(unescape(encodeURIComponent(fileContent)));

    const emailLines = [
        `To: ${toEmail}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`,
        '',
        textPart,
        '',
        `--${boundary}`,
        `Content-Type: application/json; name="${fileName}"`,
        `Content-Disposition: attachment; filename="${fileName}"`,
        `Content-Transfer-Encoding: base64`,
        '',
        base64Content,
        '',
        `--${boundary}--`
    ];

    const rawMessage = emailLines.join('\r\n');

    // Base64url encode the message as required by the Gmail API
    const base64UrlMessage = btoa(unescape(encodeURIComponent(rawMessage)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: base64UrlMessage }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur Gmail Send: ${errorText}`);
    }
};
