/**
 * web.create_or_get_session
 * 
 * Creates a persistent anonymous session or retrieves the existing one using Supabase Auth.
 * This ensures we have a valid JWT for backend communication.
 */

import { supabase } from '../lib/supabase';

export async function createOrGetSession(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Failed to get session:', error);
        throw error;
    }

    if (data.session) {
        return data.session.user.id;
    }

    // No session, sign in anonymously
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

    if (authError) {
        console.error('Failed to sign in anonymously:', authError);
        throw authError;
    }

    if (!authData.user) {
        throw new Error('No user returned from anonymous sign in');
    }

    return authData.user.id;
}
