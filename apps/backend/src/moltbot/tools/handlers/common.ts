/**
 * Common Tool Handlers
 *
 * Handlers shared between seeker and admin agents.
 */

import type { SeekerOutput, AdminOutput } from '../../contracts.js';

export interface ToolResult {
    success: boolean;
    data?: Record<string, unknown>;
    message?: string;
    error?: string;
}

/**
 * Handle 'ask_user' action - just passes through the message
 * This action doesn't modify any state, just returns the message to display
 */
export async function handleAskUser(
    params: SeekerOutput['params'] | AdminOutput['params']
): Promise<ToolResult> {
    return {
        success: true,
        data: {
            message: params.message || '',
        },
        message: 'Message ready to display',
    };
}

/**
 * Handle 'show_listing_details' action
 * Returns listing details for display (seeker action)
 */
export async function handleShowListingDetails(
    params: SeekerOutput['params']
): Promise<ToolResult> {
    return {
        success: true,
        data: {
            message: params.message || '',
            listingId: params.listing_id,
        },
        message: 'Listing details ready to display',
    };
}
