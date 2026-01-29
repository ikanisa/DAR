/**
 * Feature Flags Configuration
 * 
 * All features are OFF by default per spec.
 * Toggle via env vars or runtime config.
 */

export interface FeatureFlags {
    WEB_ENABLED: boolean;
    WEB_AI_ENABLED: boolean;
    WEB_NOTIFICATIONS_ENABLED: boolean;
    WEB_EXTERNAL_DISCOVERY_ENABLED: boolean;
    WEB_MAPS_ENABLED: boolean;
    WEB_SOCIAL_ENABLED: boolean;
}

// Default: all OFF
const defaultFlags: FeatureFlags = {
    WEB_ENABLED: false,
    WEB_AI_ENABLED: false,
    WEB_NOTIFICATIONS_ENABLED: false,
    WEB_EXTERNAL_DISCOVERY_ENABLED: false,
    WEB_MAPS_ENABLED: false,
    WEB_SOCIAL_ENABLED: false,
};

/**
 * Load feature flags from environment or use defaults.
 * In production, these would come from Supabase or a config service.
 */
export function loadFeatureFlags(): FeatureFlags {
    // Check env vars (Vite style)
    const env = import.meta.env;

    return {
        WEB_ENABLED: env.VITE_WEB_ENABLED === 'true' || defaultFlags.WEB_ENABLED,
        WEB_AI_ENABLED: env.VITE_WEB_AI_ENABLED === 'true' || defaultFlags.WEB_AI_ENABLED,
        WEB_NOTIFICATIONS_ENABLED: env.VITE_WEB_NOTIFICATIONS_ENABLED === 'true' || defaultFlags.WEB_NOTIFICATIONS_ENABLED,
        WEB_EXTERNAL_DISCOVERY_ENABLED: env.VITE_WEB_EXTERNAL_DISCOVERY_ENABLED === 'true' || defaultFlags.WEB_EXTERNAL_DISCOVERY_ENABLED,
        WEB_MAPS_ENABLED: env.VITE_WEB_MAPS_ENABLED === 'true' || defaultFlags.WEB_MAPS_ENABLED,
        WEB_SOCIAL_ENABLED: env.VITE_WEB_SOCIAL_ENABLED === 'true' || defaultFlags.WEB_SOCIAL_ENABLED,
    };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
    const flags = loadFeatureFlags();
    return flags[flag];
}

/**
 * Gate a function behind a feature flag
 */
export function withFeatureGate<T>(
    flag: keyof FeatureFlags,
    fn: () => T,
    fallback: T
): T {
    if (isFeatureEnabled(flag)) {
        return fn();
    }
    return fallback;
}

// Export singleton for convenience
export const featureFlags = loadFeatureFlags();
