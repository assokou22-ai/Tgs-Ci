// Construit un fichier JSON volumineux (sauvegardes avec photos) morceau par morceau :
// évite de créer une seule chaîne géante en mémoire, cause de plantage sur téléphone.
export const buildJsonBlob = (value: unknown, depth = 0): BlobPart[] => {
    if (depth >= 3 || value === null || typeof value !== 'object') return [JSON.stringify(value ?? null)];
    const parts: BlobPart[] = [];
    if (Array.isArray(value)) {
        parts.push('[');
        value.forEach((item, i) => {
            if (i) parts.push(',');
            parts.push(JSON.stringify(item ?? null));
        });
        parts.push(']');
        return parts;
    }
    parts.push('{');
    let first = true;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined) continue;
        if (!first) parts.push(',');
        first = false;
        parts.push(JSON.stringify(k), ':', ...buildJsonBlob(v, depth + 1));
    }
    parts.push('}');
    return parts;
};

export const jsonToBlob = (value: unknown) => new Blob(buildJsonBlob(value), { type: 'application/json' });
