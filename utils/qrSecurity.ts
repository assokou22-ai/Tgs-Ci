/**
 * Safety and Security Utilities for QR Code Obfuscation in TGS-CI
 * Ensures that printed QR codes on equipment labels are ONLY readable and processable
 * by the authorized TGS-CI technician workspace app, displaying as meaningless
 * cipher texts on standard/generic phone camera scanners.
 */

// Custom secure string signature used for XOR-based cipher protection
const SECURE_CIPHER_SECRET = "TGS_CI_REPAIR_WORKSHOP_CRYPTO_KEY_2026_SECURE";
const SECURE_PREFIX = "TGS-SECURE-ID:";

/**
 * Encrypts/Obfuscates a repair ticket identifier so that it is secure and looks like gibberish.
 * @param ticketId The raw identifier of the repair ticket (e.g., TGS-2026-0014)
 * @returns An obfuscated base64 payload
 */
export const encodeTicketId = (ticketId: string): string => {
  if (!ticketId) return '';
  
  // Embed specific prefix for structure confirmation
  const rawPayload = `${SECURE_PREFIX}${ticketId}`;
  
  // Custom XOR encoder
  let cipheredBytes = '';
  for (let i = 0; i < rawPayload.length; i++) {
    const charCode = rawPayload.charCodeAt(i) ^ SECURE_CIPHER_SECRET.charCodeAt(i % SECURE_CIPHER_SECRET.length);
    cipheredBytes += String.fromCharCode(charCode);
  }
  
  // Multi-byte safe Base64 formatting
  try {
    return btoa(encodeURIComponent(cipheredBytes).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } catch (error) {
    console.error("Base64 encryption encoding error for QR:", error);
    return btoa(cipheredBytes);
  }
};

/**
 * Decrypts and retrieves the repair ticket identifier from an obfuscated source.
 * @param cipherText The scanned QR string payload
 * @returns The original ticket id, or null if invalid/not readable by this app
 */
export const decodeTicketId = (cipherText: string): string | null => {
  if (!cipherText) return null;
  
  let rawPayload = '';
  try {
    // Multi-byte safe Base64 decoding
    const decodedBytes = decodeURIComponent(
      atob(cipherText)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    // Reverse custom XOR encoder
    for (let i = 0; i < decodedBytes.length; i++) {
      const charCode = decodedBytes.charCodeAt(i) ^ SECURE_CIPHER_SECRET.charCodeAt(i % SECURE_CIPHER_SECRET.length);
      rawPayload += String.fromCharCode(charCode);
    }
  } catch {
    // If the scanned string is not base64 or doesn't match, return null.
    // This blocks standard unencrypted QRs from external sources or bad text scans.
    return null;
  }
  
  // Verify prefix presence and return clean original ID
  if (rawPayload.startsWith(SECURE_PREFIX)) {
    return rawPayload.slice(SECURE_PREFIX.length).trim();
  }
  
  return null;
};
