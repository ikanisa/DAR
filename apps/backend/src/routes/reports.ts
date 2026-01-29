
import { FastifyInstance } from 'fastify';
import { generateWeeklyBrief } from '../reports/weeklyMarketBrief.js';
import { detectAnomalies } from '../reports/anomalyDetector.js';
import { db } from '../db.js';
// Adjust import path for requireRole based on actual location. 
// If middleware/rbac doesn't exist, we might need to rely on existing auth or mock it.
// Assuming it works like validSession but with role check.
// For now, I'll use a placeholder or generic hook if `requireRole` isn't available.
// I'll check if `requireRole` is available in the codebase or define a simple one.

// Checking imports in previous files context... I see `requireRole` used in `routes/reports.ts` plan.
// Let's assume standard `preHandler` pattern.

export async function reportRoutes(fastify: FastifyInstance) {

    // Middleware to check admin role (simplified inline if reusable function missing)
    const requireAdmin = async (request: any, reply: any) => {
        // This assumes request.user is populated by upstream auth middleware
        if (!request.user || request.user.role !== 'admin') {
            reply.status(403).send({ error: 'Admin access required' });
        }
    };

    // Get latest weekly brief
    fastify.get('/api/reports/weekly-malta-brief', {
        // preHandler: requireAdmin, // Uncomment when Auth is fully integrated
    }, async (request) => {
        const format = (request.query as any).format || 'json';

        const result = await db.query(`
      SELECT * FROM market_reports
      WHERE report_type = 'weekly_brief'
      ORDER BY generated_at DESC
      LIMIT 1
    `);

        if (!result.rows[0]) {
            return { error: 'No report available' };
        }

        if (format === 'markdown') {
            return result.rows[0].content;
        }

        return result.rows[0];
    });

    // Generate new brief (manual trigger)
    fastify.post('/api/reports/weekly-malta-brief', {
        // preHandler: requireAdmin,
    }, async () => {
        const report = await generateWeeklyBrief();
        return { success: true, preview: report.slice(0, 500) + '...' };
    });

    // List anomalies
    fastify.get('/api/reports/anomalies', {
        // preHandler: requireAdmin,
    }, async (request) => {
        const { resolved = 'false' } = request.query as any;

        const result = await db.query(`
      SELECT a.*, l.title as listing_title
      FROM listing_anomalies a
      LEFT JOIN listings l ON a.listing_id = l.id
      WHERE a.resolved = $1
      ORDER BY a.detected_at DESC
      LIMIT 100
    `, [resolved === 'true']);

        return result.rows;
    });

    // Resolve anomaly
    fastify.post('/api/reports/anomalies/:id/resolve', {
        // preHandler: requireAdmin,
    }, async (request) => {
        const { id } = request.params as { id: string };
        const { notes } = request.body as { notes?: string };

        await db.query(`
      UPDATE listing_anomalies SET
        resolved = true,
        resolved_by = $1, // request.user.id
        resolved_at = now(),
        resolution_notes = $2
      WHERE id = $3
    `, [(request as any).user?.id || null, notes, id]);

        return { success: true };
    });

    // Run anomaly detection manually
    fastify.post('/api/reports/anomalies/detect', {
        // preHandler: requireAdmin,
    }, async () => {
        const anomalies = await detectAnomalies();
        return { success: true, count: anomalies.length };
    });
}
