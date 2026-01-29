/**
 * Session Context
 * 
 * Provides session state and feature flags to the entire app.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createOrGetSession } from '../tools/web.create_or_get_session';
import { loadFeatureFlags, FeatureFlags } from './featureFlags';

export interface SessionState {
    sessionId: string | null;
    isLoading: boolean;
    error: string | null;
    flags: FeatureFlags;
}

export interface SessionContextValue extends SessionState {
    refreshSession: () => Promise<void>;
    isFeatureEnabled: (flag: keyof FeatureFlags) => boolean;
}

const defaultState: SessionState = {
    sessionId: null,
    isLoading: true,
    error: null,
    flags: loadFeatureFlags(),
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SessionState>(defaultState);

    const refreshSession = async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const sessionId = await createOrGetSession();
            setState(prev => ({
                ...prev,
                sessionId,
                isLoading: false,
                error: null,
            }));
        } catch (e) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: e instanceof Error ? e.message : 'Failed to initialize session',
            }));
        }
    };

    const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
        return state.flags[flag];
    };

    useEffect(() => {
        refreshSession();
    }, []);

    const value: SessionContextValue = {
        ...state,
        refreshSession,
        isFeatureEnabled,
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession(): SessionContextValue {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}

/**
 * Hook to check if a feature is enabled
 */
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
    const { isFeatureEnabled } = useSession();
    return isFeatureEnabled(flag);
}

/**
 * Component to conditionally render based on feature flag
 */
export function FeatureGate({
    flag,
    children,
    fallback = null,
}: {
    flag: keyof FeatureFlags;
    children: ReactNode;
    fallback?: ReactNode;
}) {
    const enabled = useFeatureFlag(flag);
    return <>{enabled ? children : fallback}</>;
}
