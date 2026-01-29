import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    // Only check in production mode (build time) to allow loose dev environments if needed,
    // though typically you want consistency.
    if (mode === 'production') {
        const requiredEnvVars = [
            'VITE_API_URL',
            'VITE_SUPABASE_URL',
            'VITE_SUPABASE_ANON_KEY',
            'VITE_ENV',
        ];

        const missing = requiredEnvVars.filter((key) => !env[key]);

        if (missing.length > 0) {
            throw new Error(
                `❌ Missing required environment variables for build: ${missing.join(
                    ', '
                )}. Please check your Cloudflare Pages settings or .env file.`
            );
        }
    }

    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 3000,
        },
    };
});
