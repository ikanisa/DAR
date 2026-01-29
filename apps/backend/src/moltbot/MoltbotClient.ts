/**
 * Moltbot Gateway Client
 * Communicates with Moltbot gateway via HTTP
 */

import { getConfig } from '../config.js';
import { logger } from '../observability/logger.js';

export interface MoltbotMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface MoltbotSendOptions {
    agentId: string;
    sessionId: string;
    message: string;
    context?: Record<string, unknown>;
}

export interface MoltbotResponse {
    success: boolean;
    response?: string;
    sessionId: string;
    error?: string;
}

export class MoltbotClient {
    private baseUrl: string;
    private token: string;

    constructor() {
        const config = getConfig();
        this.baseUrl = config.MOLTBOT_GATEWAY_URL || 'http://localhost:18789';
        this.token = config.MOLTBOT_GATEWAY_TOKEN || '';
    }

    /**
     * Send a message to an agent
     */
    async sendMessage(options: MoltbotSendOptions): Promise<MoltbotResponse> {
        const { agentId, sessionId, message, context } = options;

        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    session_id: sessionId,
                    message,
                    context,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error({ agentId, sessionId, status: response.status, error }, 'Moltbot request failed');
                return {
                    success: false,
                    sessionId,
                    error: `Moltbot error: ${response.status}`,
                };
            }

            const data = await response.json() as { response: string };

            logger.info({ agentId, sessionId }, 'Moltbot message sent successfully');

            return {
                success: true,
                response: data.response,
                sessionId,
            };
        } catch (err) {
            logger.error({ err, agentId, sessionId }, 'Failed to communicate with Moltbot');
            return {
                success: false,
                sessionId,
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    /**
     * Get session history
     */
    async getSession(sessionId: string): Promise<MoltbotMessage[] | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json() as { messages: MoltbotMessage[] };
            return data.messages;
        } catch (err) {
            logger.error({ err, sessionId }, 'Failed to get Moltbot session');
            return null;
        }
    }

    /**
     * End a session
     */
    async endSession(sessionId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            return response.ok;
        } catch (err) {
            logger.error({ err, sessionId }, 'Failed to end Moltbot session');
            return false;
        }
    }

    /**
     * Notify admin agent of a new listing requiring review
     */
    async notifyAdminNewListing(listingId: string): Promise<MoltbotResponse> {
        logger.info({ listingId }, 'Notifying admin of new listing');

        return this.sendMessage({
            agentId: 'admin-agent',
            sessionId: `listing-review-${listingId}`,
            message: `New listing submitted for review: ${listingId}`,
            context: {
                action: 'review_requested',
                listing_id: listingId,
            },
        });
    }

    /**
     * Send notification to poster via their preferred channel
     */
    async notifyPoster(
        peerId: string,
        message: string,
        channel: 'whatsapp' | 'telegram' = 'whatsapp'
    ): Promise<boolean> {
        // In production, this would call the actual notification service
        // For now, we log and simulate success
        logger.info({ peerId, channel, message }, 'Notification sent to poster');

        // Could integrate with actual WhatsApp/Telegram APIs here
        // Example: await this.post(`/hooks/${channel}/send`, { peer_id: peerId, message });

        return true;
    }
}

// Singleton instance
let client: MoltbotClient | null = null;

export function getMoltbotClient(): MoltbotClient {
    if (!client) {
        client = new MoltbotClient();
    }
    return client;
}
