/**
 * web.create_or_get_session
 * 
 * Creates a persistent anonymous session or retrieves the existing one.
 * Stores in localStorage and syncs to Supabase 'web_sessions'.
 */

import { supabase } from '../lib/supabase';
// Using native crypto.randomUUID() or fallback

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export async function createOrGetSession(): Promise<string> {
    const STORAGE_KEY = 'dar_anon_session_id';
    let sessionId = localStorage.getItem(STORAGE_KEY);

    if (!sessionId) {
        sessionId = generateUUID();
        localStorage.setItem(STORAGE_KEY, sessionId);

        // Sync to DB (Best effort, ignore error if offline/no-permission yet)
        try {
            await supabase.from('web_sessions').insert({
                anon_user_id: sessionId,
                user_agent: navigator.userAgent,
                language: navigator.language
            });
        } catch (e) {
            console.warn('Failed to sync session to DB', e);
        }
    } else {
        // Update last seen
        try {
            await supabase.from('web_sessions').update({
                last_seen_at: new Date().toISOString()
            }).eq('anon_user_id', sessionId);
        } catch (e) {
            // ignore
        }
    }

    return sessionId;
}
