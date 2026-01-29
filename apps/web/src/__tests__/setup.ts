/**
 * Test Setup
 * 
 * Global test configuration and mocks.
 */

import { vi } from 'vitest';

// Mock localStorage for node environment
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

// @ts-expect-error - mocking global
global.localStorage = localStorageMock;

// Create chainable mock that returns empty results
const createChainableMock = () => {
    const chain: Record<string, unknown> = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        delete: () => chain,
        eq: () => chain,
        neq: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => ({ data: null, error: null }),
        // Default return value
        then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
            resolve({ data: [], error: null });
        },
        data: [],
        error: null,
    };
    return chain;
};

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
    supabase: {
        from: () => createChainableMock(),
    },
}));
