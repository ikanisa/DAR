/**
 * Moderation Service
 * 
 * Logging, enforcement, and risk scoring for abuse prevention.
 */

import { supabase } from './supabase';
import { checkRateLimit, RateLimitAction, getAllLimits } from './rateLimiter';

// =============================================================================
// TYPES
// =============================================================================

export type ModerationEventType =
    | 'rate_limit_exceeded'
    | 'spam_detected'
    | 'content_flagged'
    | 'user_reported'
    | 'action_blocked'
    | 'warning_issued';

export type ModerationAction =
    | 'none'
    | 'warn'
    | 'block_action'
    | 'block_session'
    | 'flag_for_review';

export interface ModerationEvent {
    id: string;
    session_id: string;
    event_type: ModerationEventType;
    details: Record<string, unknown>;
    risk_score: number;
    action_taken: ModerationAction;
    created_at: string;
}

export interface RiskAssessment {
    score: number;           // 0-100
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    recommended_action: ModerationAction;
}

// =============================================================================
// LOGGING
// =============================================================================

/**
 * Log a moderation event to the database.
 */
export async function logModerationEvent(
    sessionId: string,
    eventType: ModerationEventType,
    details: Record<string, unknown>,
    riskScore: number = 0,
    actionTaken: ModerationAction = 'none'
): Promise<boolean> {
    const { error } = await supabase
        .from('moderation_events')
        .insert({
            session_id: sessionId,
            event_type: eventType,
            details,
            risk_score: riskScore,
            action_taken: actionTaken,
        });

    if (error) {
        console.error('[Moderation] Failed to log event:', error);
        return false;
    }

    console.log('[Moderation] Event logged:', eventType, actionTaken);
    return true;
}

/**
 * Get recent moderation events for a session.
 */
export async function getModerationHistory(
    sessionId: string,
    limit: number = 20
): Promise<ModerationEvent[]> {
    const { data, error } = await supabase
        .from('moderation_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[Moderation] Failed to fetch history:', error);
        return [];
    }

    return data || [];
}

// =============================================================================
// RISK SCORING
// =============================================================================

/**
 * Calculate risk score for a session based on behavior patterns.
 */
export async function getRiskScore(sessionId: string): Promise<RiskAssessment> {
    const factors: string[] = [];
    let score = 0;

    // Factor 1: Check rate limit status
    const limits = getAllLimits(sessionId);

    if (!limits.message.allowed) {
        score += 30;
        factors.push('Message rate limit exceeded');
    } else if (limits.message.remaining < 5) {
        score += 10;
        factors.push('Near message rate limit');
    }

    if (!limits.post.allowed) {
        score += 25;
        factors.push('Post rate limit exceeded');
    }

    if (!limits.listing.allowed) {
        score += 25;
        factors.push('Listing rate limit exceeded');
    }

    // Factor 2: Check recent moderation events
    const history = await getModerationHistory(sessionId, 10);
    const recentBlocks = history.filter(
        e => e.action_taken === 'block_action' || e.action_taken === 'block_session'
    );

    if (recentBlocks.length > 0) {
        score += recentBlocks.length * 15;
        factors.push(`${recentBlocks.length} recent blocks`);
    }

    const recentWarnings = history.filter(e => e.action_taken === 'warn');
    if (recentWarnings.length >= 2) {
        score += 20;
        factors.push('Multiple warnings');
    }

    // Factor 3: Check for spam patterns
    const spamEvents = history.filter(e => e.event_type === 'spam_detected');
    if (spamEvents.length > 0) {
        score += spamEvents.length * 20;
        factors.push('Spam detected previously');
    }

    // Clamp score to 0-100
    score = Math.min(100, Math.max(0, score));

    // Determine level and recommended action
    let level: RiskAssessment['level'] = 'low';
    let recommended_action: ModerationAction = 'none';

    if (score >= 80) {
        level = 'critical';
        recommended_action = 'block_session';
    } else if (score >= 60) {
        level = 'high';
        recommended_action = 'block_action';
    } else if (score >= 30) {
        level = 'medium';
        recommended_action = 'warn';
    }

    return { score, level, factors, recommended_action };
}

// =============================================================================
// ENFORCEMENT
// =============================================================================

/**
 * Enforce a moderation action on a session.
 */
export async function enforceAction(
    sessionId: string,
    action: ModerationAction,
    reason: string
): Promise<{ success: boolean; message: string }> {
    // Log the enforcement
    await logModerationEvent(
        sessionId,
        'action_blocked',
        { reason },
        action === 'block_session' ? 100 : 50,
        action
    );

    switch (action) {
        case 'warn':
            // Create warning notification
            await supabase.from('web_notifications').insert({
                session_id: sessionId,
                type: 'moderation_warning',
                title: 'Rate Limit Warning',
                message: reason,
                read: false,
            });
            return { success: true, message: 'Warning issued' };

        case 'block_action':
            return {
                success: true,
                message: 'Action blocked. Please slow down.'
            };

        case 'block_session':
            // In a real system, this would invalidate the session
            return {
                success: true,
                message: 'Session blocked due to abuse.'
            };

        case 'flag_for_review':
            return {
                success: true,
                message: 'Flagged for admin review.'
            };

        default:
            return { success: true, message: 'No action taken' };
    }
}

// =============================================================================
// COMBINED CHECKS
// =============================================================================

/**
 * Check if an action should be allowed and handle moderation.
 * Returns { allowed, message } - use before performing any action.
 */
export async function checkAndModerate(
    sessionId: string,
    action: RateLimitAction
): Promise<{ allowed: boolean; message?: string }> {
    // Check rate limit
    const limitResult = checkRateLimit(sessionId, action);

    if (!limitResult.allowed) {
        // Log rate limit violation
        await logModerationEvent(
            sessionId,
            'rate_limit_exceeded',
            { action, retryAfterMs: limitResult.retryAfterMs },
            40,
            'block_action'
        );

        // Check risk and potentially escalate
        const risk = await getRiskScore(sessionId);

        if (risk.level === 'critical') {
            await enforceAction(sessionId, 'block_session', 'Repeated abuse detected');
            return {
                allowed: false,
                message: 'Your session has been blocked due to abuse.'
            };
        }

        const seconds = Math.ceil((limitResult.retryAfterMs || 60000) / 1000);
        return {
            allowed: false,
            message: `Rate limit exceeded. Please wait ${seconds}s before trying again.`
        };
    }

    return { allowed: true };
}

/**
 * Report content for moderation review.
 */
export async function reportContent(
    sessionId: string,
    contentType: 'listing' | 'post' | 'message',
    contentId: string,
    reason: string
): Promise<boolean> {
    return await logModerationEvent(
        sessionId,
        'user_reported',
        { contentType, contentId, reason },
        30,
        'flag_for_review'
    );
}
