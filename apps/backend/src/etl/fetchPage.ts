/**
 * HTTP Page Fetcher
 * Fetches web pages with timeout, retry, and proper headers
 */

import { logger } from '../observability/logger.js';

export interface FetchResult {
    html: string;
    finalUrl: string;
    statusCode: number;
    contentType: string;
}

export interface FetchOptions {
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
}

const DEFAULT_OPTIONS: Required<FetchOptions> = {
    timeout: 10000,
    maxRetries: 2,
    retryDelay: 1000,
};

const USER_AGENT = 'MaltaPropertyBot/1.0 (+https://dar.mt/bot)';

/**
 * Fetch a page with timeout and retry logic
 */
export async function fetchPage(
    url: string,
    options: FetchOptions = {}
): Promise<FetchResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            const result = await fetchWithTimeout(url, opts.timeout);
            return result;
        } catch (error) {
            lastError = error as Error;
            logger.warn(
                { url, attempt, error: lastError.message },
                'Fetch attempt failed'
            );

            if (attempt < opts.maxRetries) {
                await sleep(opts.retryDelay * (attempt + 1));
            }
        }
    }

    throw lastError || new Error('Failed to fetch page');
}

/**
 * Fetch with AbortController timeout
 */
async function fetchWithTimeout(
    url: string,
    timeout: number
): Promise<FetchResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';

        // Only process HTML responses
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
            throw new Error(`Unexpected content type: ${contentType}`);
        }

        const html = await response.text();

        return {
            html,
            finalUrl: response.url,
            statusCode: response.status,
            contentType,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
