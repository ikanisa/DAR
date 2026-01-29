/**
 * Backend Configuration
 * Environment variable loader with zod validation
 */

import { z } from 'zod';

const envSchema = z.object({
    // Database
    DATABASE_URL: z.string().url().startsWith('postgresql://'),

    // JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

    // Service Token (for Moltbot tool calls)
    SERVICE_TOKEN: z.string().min(16, 'SERVICE_TOKEN must be at least 16 characters'),

    // Supabase (for Edge Function calls)
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_KEY: z.string().optional(),

    // Moltbot Gateway (optional - server-side only)
    MOLTBOT_GATEWAY_URL: z.string().url().optional(),
    MOLTBOT_GATEWAY_TOKEN: z.string().optional(),

    // Notification Providers (optional)
    WHATSAPP_API_TOKEN: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),

    // Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3001),
});

export type Config = z.infer<typeof envSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
    if (cachedConfig) return cachedConfig;

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Invalid environment configuration:');
        for (const issue of result.error.issues) {
            console.error(`   ${issue.path.join('.')}: ${issue.message}`);
        }
        process.exit(1);
    }

    cachedConfig = result.data;
    return cachedConfig;
}

export function isDev(): boolean {
    return getConfig().NODE_ENV === 'development';
}

export function isProd(): boolean {
    return getConfig().NODE_ENV === 'production';
}
