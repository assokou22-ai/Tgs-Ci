/**
 * Service dédié à l'intégration de Google People API pour la gestion de contacts.
 * Google Contacts est traité comme un service externe entièrement facultatif.
 * Ce service est découplé de syncService et ne bloque pas l'enregistrement principal.
 */

import { RepairTicket } from '../types.ts';

/**
 * Fonction utilitaire unique de normalisation systématique des numéros de téléphone.
 * Nettoie le numéro en supprimant les espaces, parenthèses, tirets et autres bruits de syntaxe,
 * tout en conservant le code d'appel international '+' s'il est présent au début.
 */
export const normalizePhoneSystematic = (phone: string): string => {
    if (!phone) return '';
    return phone.replace(/[^0-9+]/g, '').trim();
};

/**
 * Vérifie de manière défensive si deux numéros de téléphone sont équivalents (doublons potentiels),
 * même avec des formats ou des codes de pays différents (+22507..., 22507... et 07...).
 */
export const arePhoneNumbersEquivalent = (phone1: string, phone2: string): boolean => {
    const norm1 = normalizePhoneSystematic(phone1).replace(/^\+/, '');
    const norm2 = normalizePhoneSystematic(phone2).replace(/^\+/, '');
    
    if (!norm1 || !norm2) return false;
    if (norm1 === norm2) return true;

    // Si l'un des numéros termine par l'autre sur les 8 derniers chiffres significatifs ou vice-versa,
    // on conclut de manière défensive à l'existence d'un doublon.
    const minSigLength = 8;
    if (norm1.length >= minSigLength && norm2.length >= minSigLength) {
        const suffix1 = norm1.slice(-minSigLength);
        const suffix2 = norm2.slice(-minSigLength);
        if (suffix1 === suffix2) return true;
    }
    
    return false;
};

/**
 * Recherche si un contact Google existe déjà avec le même numéro de téléphone principal.
 * Utilise la normalisation systématique et une recherche à tolérance élargie.
 */
export const findGoogleContactByPhone = async (
    accessToken: string,
    phoneNumber: string
): Promise<boolean> => {
    if (!phoneNumber) return false;
    try {
        const normalized = normalizePhoneSystematic(phoneNumber);
        const searchQueries: string[] = [phoneNumber.trim()];

        if (normalized && normalized !== phoneNumber.trim()) {
            searchQueries.push(normalized);
        }

        // Requête purement numérique sans l'indicatif '+'
        const numericOnly = normalized.replace(/^\+/, '');
        if (numericOnly && !searchQueries.includes(numericOnly)) {
            searchQueries.push(numericOnly);
        }

        // Si le numéro est très long (avec code pays), on cherche aussi sur la fin locale
        const minSigLength = 8;
        if (numericOnly.length > minSigLength) {
            const localSuffix = numericOnly.slice(-minSigLength);
            if (!searchQueries.includes(localSuffix)) {
                searchQueries.push(localSuffix);
            }
        }

        // On interroge Google pour chaque variation de recherche afin d'être paré contre les délais d'indexation
        for (const query of searchQueries) {
            const url = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(query)}&readMask=names,phoneNumbers`;
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                }
            });

            if (!response.ok) {
                console.warn(`[Google Contacts Search] Retour API code ${response.status} pour la requête "${query}"`);
                continue;
            }

            const data = await response.json();
            const results = data.results || [];

            for (const res of results) {
                const person = res.person;
                if (person?.phoneNumbers) {
                    for (const phoneItem of person.phoneNumbers) {
                        if (phoneItem.value) {
                            if (arePhoneNumbersEquivalent(phoneNumber, phoneItem.value)) {
                                console.log(`[Google Contacts] Doublon détecté pour ${phoneNumber} avec ${phoneItem.value}`);
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    } catch (error) {
        console.error('[Google Contacts Search] Échec de la recherche de doublon:', error);
        return false;
    }
};

/**
 * Crée un contact Google à partir d'une fiche client (Repair Ticket).
 * Ne bloque jamais l'enregistrement principal en cas d'erreur.
 */
export const createGoogleContactFromRepairTicket = async (
    ticket: RepairTicket,
    accessToken: string
): Promise<{ success: boolean; message: string; contactId?: string }> => {
    try {
        const client = ticket.client;
        if (!client || !client.name) {
            return { success: false, message: "Nom de client non configuré ou manquant." };
        }

        const primaryPhone = client.phone;
        const secondaryPhone = client.smsPhone || client.secondaryPhone || '';

        // Protection anti-doublon active
        if (primaryPhone) {
            const exists = await findGoogleContactByPhone(accessToken, primaryPhone);
            if (exists) {
                return { 
                    success: true, 
                    message: `Le contact existe déjà avec le numéro ${primaryPhone} (création ignorée).` 
                };
            }
        }

        // Création de l'array de numéros de téléphone pour Google Contacts en normalisant systématiquement
        const phoneNumbers = [];
        if (primaryPhone) {
            phoneNumbers.push({
                value: normalizePhoneSystematic(primaryPhone),
                type: 'mobile',
                formattedType: 'WhatsApp'
            });
        }
        if (secondaryPhone) {
            phoneNumbers.push({
                value: normalizePhoneSystematic(secondaryPhone),
                type: 'home',
                formattedType: 'SMS'
            });
        }

        // Formatage des détails techniques dans la note du contact
        const noteDetails = [
            `Fiche N°: ${ticket.id}`,
            `Désignation du modèle: ${ticket.macModel || 'Non spécifiée'}`,
            `Model Number: ${ticket.modelNumber || 'Non spécifié'}`,
            `S/N Original: ${ticket.serialNumber || 'Non spécifié'}`,
            `Synchronisé automatiquement de l'atelier TGS-CI le: ${new Date().toLocaleDateString('fr-FR')}`
        ];
        const noteValue = noteDetails.join('\n');

        // Modèle de requête pour representer un contact Google People
        const body = {
            names: [
                {
                    givenName: client.name
                }
            ],
            phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
            biographies: [
                {
                    value: noteValue,
                    contentType: 'TEXT_PLAIN'
                }
            ],
            userDefined: [
                {
                    key: 'Numéro de Fiche',
                    value: ticket.id
                }
            ]
        };

        const createUrl = 'https://people.googleapis.com/v1/people:createContact';
        const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            return { success: false, message: `Erreur People API : ${errText}` };
        }

        const contact = await response.json();
        return { 
            success: true, 
            message: `Contact synchronisé avec succès pour : ${client.name}`,
            contactId: contact.resourceName 
        };
    } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('[Google Contacts Sync] Erreur lors de la création du contact:', e);
        return { success: false, message: errorMsg };
    }
};
