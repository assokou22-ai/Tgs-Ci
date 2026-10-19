/**
 * Utilitaires pour le téléversement, la compression et l'aperçu de fichiers (images JPG/PNG/WebP et documents PDF)
 */

export const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error("Échec de lecture en chaîne Base64"));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
};

/**
 * Compresse une image pour limiter la taille mémoire tout en préservant la netteté des gravures/textes
 */
export const compressImage = async (
    file: File,
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82
): Promise<string> => {
    if (file.type === 'application/pdf') {
        // Ne pas compresser les PDF, les renvoyer directement en Base64 natif
        return readFileAsBase64(file);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                // Fallback direct
                readFileAsBase64(file).then(resolve).catch(reject);
                return;
            }

            // Amélioration de l'interpolation
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const mimeType = file.type === 'image/png' ? 'image/jpeg' : (file.type || 'image/jpeg');
            const dataUrl = canvas.toDataURL(mimeType, quality);
            resolve(dataUrl);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            readFileAsBase64(file).then(resolve).catch(reject);
        };

        img.src = objectUrl;
    });
};

export const isPdfDataUrl = (url?: string): boolean => {
    if (!url) return false;
    return url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf');
};
