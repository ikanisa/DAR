import { supabase } from '../lib/supabase';
import { createOrGetSession } from './web.create_or_get_session';

export async function createDraftPost(type: 'buy' | 'sell') {
    const sessionId = await createOrGetSession();

    // Optimistic UI or actual call
    try {
        const { data, error } = await supabase.from('market_posts').insert({
            session_id: sessionId, // In real RLS this might be auto-inferred or passed
            type,
            status: 'draft',
            title: 'New Listing', // Default
        }).select().single();

        if (error) throw error;
        return data.id;
    } catch (e) {
        console.error('Error creating draft post', e);
        // Fallback for demo without DB
        return `mock-post-${Date.now()}`;
    }
}
