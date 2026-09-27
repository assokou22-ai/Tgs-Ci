
/**
 * Utility for formatting and normalizing phone numbers for Côte d'Ivoire (CI +225) 
 * and international WhatsApp & SMS channels.
 * 
 * Côte d'Ivoire numbering plan (10 digits):
 * - Mobile Orange : 07 XX XX XX XX -> International : +225 07 XX XX XX XX (wa.me/22507XXXXXXXX)
 * - Mobile MTN    : 05 XX XX XX XX -> International : +225 05 XX XX XX XX (wa.me/22505XXXXXXXX)
 * - Mobile Moov   : 01 XX XX XX XX -> International : +225 01 XX XX XX XX (wa.me/22501XXXXXXXX)
 * - Fixes         : 21, 25, 27...  -> International : +225 2X XX XX XX XX (wa.me/2252XXXXXXXXX)
 */

/**
 * Cleans any phone string to international WhatsApp format (digits only, no + or spaces).
 * Corrects CI 10-digit numbers and auto-repairs numbers where leading '0' was accidentally removed.
 */
export const formatWhatsAppPhone = (rawPhone: string | undefined | null): string => {
    if (!rawPhone) return '';

    // Strip all non-digit characters except leading '+'
    let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');

    // Remove leading '00' international prefix if present (e.g. 00225 -> 225)
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    }

    // Remove leading '+'
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }

    // Case 1: Local Côte d'Ivoire 10-digit number starting with 0 (e.g. '0749819582', '05...', '01...', '21...', '25...', '27...')
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
        return '225' + cleaned; // -> 2250749819582 (12 digits)
    }

    // Case 2: Local 10-digit landline without leading 0 (e.g. '2722440011', '25...', '21...')
    if (cleaned.length === 10 && (cleaned.startsWith('21') || cleaned.startsWith('25') || cleaned.startsWith('27'))) {
        return '225' + cleaned;
    }

    // Case 3: 11-digit number starting with '225' where the 4th digit is 7, 5, 1, 2 (e.g. '225749819582')
    // This is a truncated Ivorian 10-digit number missing the local leading '0'. We auto-repair it:
    if (cleaned.length === 11 && cleaned.startsWith('225') && ['1', '5', '7', '2'].includes(cleaned.charAt(3))) {
        return '2250' + cleaned.substring(3); // -> 2250749819582 (12 digits)
    }

    // Case 4: Already full 12-digit Côte d'Ivoire international number (e.g. '2250749819582')
    if (cleaned.length === 12 && cleaned.startsWith('225')) {
        return cleaned;
    }

    // Case 5: Old 8-digit Côte d'Ivoire number (e.g. '07123456')
    if (cleaned.length === 8 && (cleaned.startsWith('01') || cleaned.startsWith('05') || cleaned.startsWith('07'))) {
        return '2250' + cleaned;
    }

    // Case 6: Local 8-digit without 0 (e.g. '74981958')
    if (cleaned.length === 8 && (cleaned.startsWith('7') || cleaned.startsWith('5') || cleaned.startsWith('1'))) {
        return '2250' + cleaned.charAt(0) + cleaned;
    }

    // Case 7: If number starts with 0 and has 9-10 digits (non-CI or local standard), default to +225 prefix with 0 preserved
    if (cleaned.startsWith('0') && cleaned.length >= 9) {
        return '225' + cleaned;
    }

    // Fallback: return digits as is (international number e.g. 336..., 1555...)
    return cleaned;
};

/**
 * Standard formatPhone alias for backward compatibility across the app
 */
export const formatPhone = (phone: string): string => {
    return formatWhatsAppPhone(phone);
};

/**
 * Formats a phone number for user-friendly display in UI, PDF tickets and tables.
 * Example: '07 49 81 95 82' or '+225 07 49 81 95 82'
 */
export const formatDisplayPhone = (rawPhone: string | undefined | null): string => {
    if (!rawPhone) return 'N/A';
    const clean = rawPhone.trim().replace(/\s+/g, '');
    
    // If it's standard 10-digit starting with 0:
    if (clean.length === 10 && /^\d+$/.test(clean)) {
        return clean.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }

    // If it's 12-digit CI number with 225 prefix (e.g. 2250749819582):
    if (clean.length === 12 && clean.startsWith('225')) {
        const localPart = clean.substring(3);
        return `+225 ${localPart.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')}`;
    }

    // If starts with +225:
    if (clean.startsWith('+225')) {
        const digits = clean.substring(4);
        if (digits.length === 10) {
            return `+225 ${digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')}`;
        }
    }

    return rawPhone;
};

/**
 * Generates an official wa.me link with encoded text
 */
export const generateWhatsAppUrl = (phone: string | undefined | null, message: string): string => {
    const formattedPhone = formatWhatsAppPhone(phone);
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

