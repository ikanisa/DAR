/**
 * Rate Limiter
 * 
 * Sliding window rate limiting for abuse prevention.
 * Uses localStorage for client-side tracking + DB for persistence.
 * 
 * Limits per spec:
 * - Messages: 20/min
 * - Posts: 10/hr
 * - Listings: 10/hr
 */

// =============================================================================
// TYPES
// =============================================================================

export type RateLimitAction = 'message' | 'post' | 'listing';

export interface RateLimitConfig {
    maxCount: number;
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfterMs?: number;
}

interface RateLimitEntry {
    timestamps: number[];
    lastCleanup: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
    message: {
        maxCount: 20,       // 20 per minute
        windowMs: 60_000,   // 1 minute
    },
    post: {
        maxCount: 10,       // 10 per hour
        windowMs: 3_600_000, // 1 hour
    },
    listing: {
        maxCount: 10,       // 10 per hour
        windowMs: 3_600_000, // 1 hour
    },
};

// =============================================================================
// STORAGE HELPERS
// =============================================================================

function getStorageKey(sessionId: string, action: RateLimitAction): string {
    return `rate_limit:${sessionId}:${action}`;
}

function getEntry(sessionId: string, action: RateLimitAction): RateLimitEntry {
    const key = getStorageKey(sessionId, action);
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('[RateLimit] Failed to read entry:', e);
    }
    return { timestamps: [], lastCleanup: Date.now() };
}

function setEntry(sessionId: string, action: RateLimitAction, entry: RateLimitEntry): void {
    const key = getStorageKey(sessionId, action);
    try {
        localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
        console.warn('[RateLimit] Failed to save entry:', e);
    }
}

// =============================================================================
// RATE LIMIT CHECK
// =============================================================================

/**
 * Check if an action is allowed under rate limits.
 * Does NOT record the action - use recordAction after success.
 */
export function checkRateLimit(
    sessionId: string,
    action: RateLimitAction
): RateLimitResult {
    const config = RATE_LIMITS[action];
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing timestamps and filter to window
    const entry = getEntry(sessionId, action);
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);

    const count = validTimestamps.length;
    const allowed = count < config.maxCount;
    const remaining = Math.max(0, config.maxCount - count);

    // Calculate reset time (when oldest entry expires)
    const resetAt = validTimestamps.length > 0
        ? validTimestamps[0] + config.windowMs
        : now + config.windowMs;

    // Calculate retry delay if blocked
    let retryAfterMs: number | undefined;
    if (!allowed && validTimestamps.length > 0) {
        retryAfterMs = validTimestamps[0] + config.windowMs - now;
    }

    return { allowed, remaining, resetAt, retryAfterMs };
}

/**
 * Record an action for rate limiting.
 * Call this AFTER successfully completing the action.
 */
export function recordAction(
    sessionId: string,
    action: RateLimitAction
): void {
    const config = RATE_LIMITS[action];
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const entry = getEntry(sessionId, action);

    // Clean old timestamps
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);

    // Add new timestamp
    validTimestamps.push(now);

    // Save
    setEntry(sessionId, action, {
        timestamps: validTimestamps,
        lastCleanup: now,
    });
}

/**
 * Check and record in one call.
 * Returns result, records action if allowed.
 */
export function checkAndRecord(
    sessionId: string,
    action: RateLimitAction
): RateLimitResult {
    const result = checkRateLimit(sessionId, action);

    if (result.allowed) {
        recordAction(sessionId, action);
    }

    return result;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get all rate limit statuses for a session.
 */
export function getAllLimits(sessionId: string): Record<RateLimitAction, RateLimitResult> {
    return {
        message: checkRateLimit(sessionId, 'message'),
        post: checkRateLimit(sessionId, 'post'),
        listing: checkRateLimit(sessionId, 'listing'),
    };
}

/**
 * Clear rate limit data for a session (admin only).
 */
export function clearLimits(sessionId: string): void {
    const actions: RateLimitAction[] = ['message', 'post', 'listing'];

    for (const action of actions) {
        const key = getStorageKey(sessionId, action);
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('[RateLimit] Failed to clear:', e);
        }
    }
}

/**
 * Format remaining time for display.
 */
export function formatRetryAfter(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.ceil(minutes / 60);
    return `${hours}h`;
}
