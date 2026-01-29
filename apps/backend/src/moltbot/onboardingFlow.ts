/**
 * Onboarding Flow
 * Orchestrates new user onboarding via any channel
 */

import { getMoltbotClient, type MoltbotResponse } from './MoltbotClient.js';
import { query, transaction } from '../db.js';
import { audit } from '../audit.js';
import { logger } from '../observability/logger.js';

export type UserRole = 'seeker' | 'poster';
export type Channel = 'webchat' | 'telegram' | 'whatsapp';

export interface OnboardingData {
    name?: string;
    email?: string;
    phone?: string;
    role: UserRole;
    channel: Channel;
    channelPeerId: string;
}

/**
 * Start onboarding flow for a new user
 */
export async function startOnboardingFlow(
    sessionId: string,
    channel: Channel,
    peerId: string,
    initialMessage: string
): Promise<MoltbotResponse> {
    const client = getMoltbotClient();

    // Determine agent based on channel
    const agentId = channel === 'whatsapp' ? 'poster-agent'
        : channel === 'telegram' ? 'seeker-agent'
            : 'admin-agent';

    const context = {
        flow: 'onboarding',
        step: 'identify',
        channel,
        peerId,
    };

    return client.sendMessage({
        agentId,
        sessionId,
        message: initialMessage,
        context,
    });
}

/**
 * Complete onboarding and create user account
 */
export async function completeOnboarding(
    sessionId: string,
    data: OnboardingData
): Promise<{ userId: string; isNew: boolean }> {
    const { name, email, phone, role, channel, channelPeerId } = data;

    // Determine which channel ID field to use
    const channelIdField = channel === 'telegram' ? 'telegram_id'
        : channel === 'whatsapp' ? 'whatsapp_id'
            : null;

    // Check if user already exists
    let existingUser = null;

    if (channelIdField) {
        const existing = await query(
            `SELECT id FROM users WHERE ${channelIdField} = $1`,
            [channelPeerId]
        );
        if (existing.rows.length > 0) {
            existingUser = existing.rows[0];
        }
    }

    if (email && !existingUser) {
        const existing = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        if (existing.rows.length > 0) {
            existingUser = existing.rows[0];
        }
    }

    if (existingUser) {
        // Update existing user
        const updates: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (name) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }
        if (phone) {
            updates.push(`phone = $${paramIndex++}`);
            params.push(phone);
        }
        if (channelIdField && channelPeerId) {
            updates.push(`${channelIdField} = $${paramIndex++}`);
            params.push(channelPeerId);
        }

        if (updates.length > 0) {
            params.push(existingUser.id);
            await query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                params
            );
        }

        logger.info({ userId: existingUser.id, channel }, 'Existing user linked to channel');

        return { userId: existingUser.id, isNew: false };
    }

    // Create new user
    const insertFields = ['role'];
    const insertValues = ['$1'];
    const insertParams: unknown[] = [role];
    let idx = 2;

    if (name) {
        insertFields.push('name');
        insertValues.push(`$${idx++}`);
        insertParams.push(name);
    }
    if (email) {
        insertFields.push('email');
        insertValues.push(`$${idx++}`);
        insertParams.push(email);
    }
    if (phone) {
        insertFields.push('phone');
        insertValues.push(`$${idx++}`);
        insertParams.push(phone);
    }
    if (channelIdField) {
        insertFields.push(channelIdField);
        insertValues.push(`$${idx++}`);
        insertParams.push(channelPeerId);
    }

    const result = await query<{ id: string }>(
        `INSERT INTO users (${insertFields.join(', ')}) 
     VALUES (${insertValues.join(', ')}) 
     RETURNING id`,
        insertParams
    );

    const userId = result.rows[0].id;

    await audit({
        actorType: 'system',
        actorId: 'onboarding',
        action: 'user.create',
        entity: 'users',
        entityId: userId,
        payload: { channel, role, sessionId },
    });

    logger.info({ userId, channel, role }, 'New user created via onboarding');

    return { userId, isNew: true };
}

/**
 * Handle pairing request from Moltbot
 */
export async function handlePairingRequest(
    channel: Channel,
    peerId: string,
    pairingCode: string
): Promise<{ approved: boolean; reason?: string }> {
    // In a real implementation, this would:
    // 1. Store the pairing code temporarily
    // 2. Send verification to user
    // 3. Wait for confirmation

    // For now, auto-approve all pairings in dev
    logger.info({ channel, peerId, pairingCode }, 'Pairing request received');

    // In production, implement proper verification
    return { approved: true };
}
