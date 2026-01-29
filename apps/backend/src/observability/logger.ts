/**
 * Structured Logger (Pino)
 * JSON logging for production observability
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    transport: isDev ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
        },
    } : undefined,
    base: {
        service: 'dar-backend',
        version: process.env.npm_package_version || '1.0.0',
    },
    serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
    },
});

export function createChildLogger(bindings: Record<string, unknown>) {
    return logger.child(bindings);
}
