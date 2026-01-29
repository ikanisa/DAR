import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    base: {
        service: 'realestate-backend',
        env: process.env.NODE_ENV || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

// Request logging middleware
export function requestLogger(request: any, reply: any, done: () => void) {
    const start = Date.now();

    reply.addHook('onSend', (req: any, rep: any, payload: any, done: () => void) => {
        const duration = Date.now() - start;
        logger.info({
            type: 'request',
            method: req.method,
            url: req.url,
            statusCode: rep.statusCode,
            duration,
            requestId: req.id,
        });
        done();
    });

    done();
}
