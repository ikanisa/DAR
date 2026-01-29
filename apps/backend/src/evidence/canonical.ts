/**
 * Canonical Stringify + Cryptographic Hashing
 * Ensures deterministic JSON output for consistent pack hashes
 */

import crypto from 'crypto';

/**
 * Recursively sort object keys for deterministic JSON output
 */
function sortObjectKeys(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }

    if (typeof obj === 'object' && obj !== null) {
        const sorted: Record<string, unknown> = {};
        const keys = Object.keys(obj as Record<string, unknown>).sort();
        for (const key of keys) {
            sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
        }
        return sorted;
    }

    return obj;
}

/**
 * Canonical JSON stringify with sorted keys
 * Same input always produces same output string
 */
export function canonicalStringify(obj: unknown): string {
    return JSON.stringify(sortObjectKeys(obj));
}

/**
 * Compute SHA-256 hash of input string
 */
export function sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Compute SHA-256 hash of object using canonical stringify
 */
export function hashObject(obj: unknown): string {
    return sha256(canonicalStringify(obj));
}
