/**
 * Redaction Helpers
 * Privacy-compliant data masking for evidence packs
 */

/**
 * Redact phone number - show only last 3 digits
 * @example "+35699123456" → "***-***-456"
 */
export function redactPhone(phone: string | null | undefined): string {
    if (!phone) return '[none]';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 3) return '***';
    return `***-***-${cleaned.slice(-3)}`;
}

/**
 * Redact email - show first 2 chars + domain
 * @example "john.doe@example.com" → "jo***@example.com"
 */
export function redactEmail(email: string | null | undefined): string {
    if (!email) return '[none]';
    const atIndex = email.indexOf('@');
    if (atIndex < 1) return '[invalid]';
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    return `${local.slice(0, 2)}***${domain}`;
}

/**
 * Redact peer/telegram/whatsapp ID - show first 4 + last 4
 * @example "1234567890abcdef" → "1234****cdef"
 */
export function redactPeerId(id: string | null | undefined): string {
    if (!id) return '[none]';
    if (id.length < 8) return '****';
    return `${id.slice(0, 4)}****${id.slice(-4)}`;
}

/**
 * Sensitive keys to redact from payloads
 */
const SENSITIVE_KEYS = [
    'phone',
    'email',
    'password',
    'token',
    'secret',
    'api_key',
    'apikey',
    'authorization',
    'auth',
    'credential',
    'private_key',
    'privatekey',
];

/**
 * Check if a key is sensitive
 */
function isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return SENSITIVE_KEYS.some(s => lowerKey.includes(s));
}

/**
 * Redact sensitive fields from payload object
 * Recursively processes nested objects
 */
export function redactPayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
        return {};
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
        if (isSensitiveKey(key)) {
            result[key] = '[REDACTED]';
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = redactPayload(value);
        } else if (Array.isArray(value)) {
            result[key] = value.map(item =>
                typeof item === 'object' ? redactPayload(item) : item
            );
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Redact user ID for display
 * Uses same logic as peer ID
 */
export function redactUserId(id: string | null | undefined): string {
    return redactPeerId(id);
}
