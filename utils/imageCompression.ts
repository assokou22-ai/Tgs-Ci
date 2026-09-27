import { RepairTicket, Attachment } from '../types.ts';

/**
 * Compresses an image Base64 string to be smaller (under ~100KB typical, max width/height 1024px, jpeg quality 0.7)
 * If the input is not an image or is already small, returns it unchanged.
 */
export const compressImageBase64 = (base64Str: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image/')) {
            resolve(base64Str);
            return;
        }

        // Check size of base64 - if it's already less than 50KB, don't compress
        if (base64Str.length < 50000) {
            resolve(base64Str);
            return;
        }

        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(base64Str);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG with specified quality
            const compressed = canvas.toDataURL('image/jpeg', quality);
            
            // Only use compressed if it's actually smaller
            if (compressed.length < base64Str.length) {
                resolve(compressed);
            } else {
                resolve(base64Str);
            }
        };

        img.onerror = () => {
            resolve(base64Str);
        };

        img.src = base64Str;
    });
};

/**
 * Helper to compress an entire RepairTicket's images and attachments
 */
export const compressTicketImages = async (ticket: RepairTicket): Promise<RepairTicket> => {
    const updated = { ...ticket };
    
    try {
        // 1. Compress clientSignature
        if (updated.clientSignature) {
            updated.clientSignature = await compressImageBase64(updated.clientSignature, 600, 300, 0.6);
        }
        
        // 2. Compress diagnosticImages
        if (updated.diagnosticImages && updated.diagnosticImages.length > 0) {
            updated.diagnosticImages = await Promise.all(
                updated.diagnosticImages.map(img => compressImageBase64(img, 800, 800, 0.6))
            );
        }
        
        // 3. Compress diagnosticSheetB images
        if (updated.diagnosticSheetB && updated.diagnosticSheetB.images && updated.diagnosticSheetB.images.length > 0) {
            const bImages = await Promise.all(
                updated.diagnosticSheetB.images.map(img => compressImageBase64(img, 800, 800, 0.6))
            );
            updated.diagnosticSheetB = {
                ...updated.diagnosticSheetB,
                images: bImages
            };
        }
        
        // 4. Compress attachments (only if type is image)
        if (updated.attachments && updated.attachments.length > 0) {
            updated.attachments = await Promise.all(
                updated.attachments.map(async (att: Attachment) => {
                    if (att.type === 'image' && att.data) {
                        const compressedData = await compressImageBase64(att.data, 800, 800, 0.6);
                        return {
                            ...att,
                            data: compressedData
                        };
                    }
                    return att;
                })
            );
        }
    } catch (error) {
        console.error("Error during image compression of ticket:", error);
    }
    
    return updated;
};

/**
 * Validates and optimizes a full ticket for Firestore to strictly stay under the 1MB limit.
 * It will compress more aggressively and drop heavy attachment payloads for cloud sync if necessary.
 */
export const optimizeTicketForFirestore = async (ticket: RepairTicket): Promise<RepairTicket> => {
    // Start with default compression
    const optimized = await compressTicketImages(ticket);
    
    // Check total character length (roughly corresponds to byte size)
    let serialized = JSON.stringify(optimized);
    const LIMIT = 900000; // Under 900KB to be safe with overhead
    
    if (serialized.length < LIMIT) {
        return optimized;
    }
    
    console.warn(`Ticket ${ticket.id} is too large (${serialized.length} chars). Applying aggressive image compression...`);
    
    // Apply more aggressive compression
    if (optimized.clientSignature) {
        optimized.clientSignature = await compressImageBase64(optimized.clientSignature, 400, 200, 0.4);
    }
    if (optimized.diagnosticImages && optimized.diagnosticImages.length > 0) {
        optimized.diagnosticImages = await Promise.all(
            optimized.diagnosticImages.map(img => compressImageBase64(img, 600, 600, 0.5))
        );
    }
    if (optimized.diagnosticSheetB && optimized.diagnosticSheetB.images && optimized.diagnosticSheetB.images.length > 0) {
        const bImages = await Promise.all(
            optimized.diagnosticSheetB.images.map(img => compressImageBase64(img, 600, 600, 0.5))
        );
        optimized.diagnosticSheetB = {
            ...optimized.diagnosticSheetB,
            images: bImages
        };
    }
    if (optimized.attachments && optimized.attachments.length > 0) {
        optimized.attachments = await Promise.all(
            optimized.attachments.map(async (att: Attachment) => {
                if (att.type === 'image' && att.data) {
                    const compressedData = await compressImageBase64(att.data, 600, 600, 0.5);
                    return {
                        ...att,
                        data: compressedData
                    };
                }
                return att;
            })
        );
    }
    
    serialized = JSON.stringify(optimized);
    if (serialized.length < LIMIT) {
        return optimized;
    }
    
    console.warn(`Ticket ${ticket.id} is still too large (${serialized.length} chars). Truncating heavy attachments for Cloud Sync...`);
    
    // Truncate/replace heaviest attachment payloads to stay under limit
    if (optimized.attachments && optimized.attachments.length > 0) {
        const sortedAttachments = [...optimized.attachments].map((att, idx) => ({ 
            att, 
            idx, 
            len: att.data ? att.data.length : 0 
        }));
        
        // Sort by size descending
        sortedAttachments.sort((a, b) => b.len - a.len);
        
        for (const item of sortedAttachments) {
            if (item.len > 20000) { // Anything over ~20KB
                const target = optimized.attachments[item.idx];
                if (target.data && !target.data.startsWith('[Fichier')) {
                    target.data = `[Fichier lourd stocké localement uniquement - taille: ${Math.round(item.len / 1024)}KB]`;
                    
                    serialized = JSON.stringify(optimized);
                    if (serialized.length < LIMIT) {
                        break;
                    }
                }
            }
        }
    }
    
    return optimized;
};

