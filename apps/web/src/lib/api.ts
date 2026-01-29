/**
 * API Client Helper
 * 
 * Handles authenticated requests to the backend API.
 * Automatically injects the Supabase session token.
 */

import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
    params?: Record<string, string>;
}

export async function fetchWithAuth(path: string, options: FetchOptions = {}) {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error('No active session');
    }

    const token = session.access_token;

    // Construct URL
    const url = new URL(`${API_URL}${path}`);
    if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }

    // Default headers
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url.toString(), {
        ...options,
        headers,
    });

    // Handle 401 (token expired/invalid) - could trigger re-auth here
    if (response.status === 401) {
        // Option: try to refresh session?
        // for now just throw
        throw new Error('Unauthorized');
    }

    // Return response (caller handles parsing)
    return response;
}
