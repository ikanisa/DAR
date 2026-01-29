
import { db } from '../db.js';
import { writeAudit } from '../audit.js';

interface Anomaly {
  listingId: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  details: object;
}

export async function detectAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // 1. Price outliers (>3 std dev from mean for type+area)
  // Note: Handling case where stddev is 0 to avoid division by zero
  const priceOutliers = await db.query(`
    WITH stats AS (
      SELECT type, area,
        AVG(price_amount) as mean,
        STDDEV(price_amount) as stddev
      FROM listings
      WHERE status = 'published' AND price_amount > 0 AND price_currency = 'EUR'
      GROUP BY type, area
    )
    SELECT l.id, l.title, l.price_amount, l.type, l.area,
      s.mean, s.stddev,
      ABS(l.price_amount - s.mean) / NULLIF(s.stddev, 0) as z_score
    FROM listings l
    JOIN stats s ON l.type = s.type AND l.area = s.area
    WHERE l.status = 'published'
      AND s.stddev > 0
      AND ABS(l.price_amount - s.mean) / s.stddev > 3
  `);

  for (const row of priceOutliers.rows) {
    anomalies.push({
      listingId: row.id,
      type: 'price_outlier',
      severity: row.z_score > 4 ? 'high' : 'medium',
      details: {
        price: row.price_amount,
        mean: Math.round(row.mean),
        zScore: parseFloat(row.z_score).toFixed(2),
      },
    });
  }

  // 2. Stale listings (not updated in 60+ days)
  const staleListings = await db.query(`
    SELECT id, title, updated_at
    FROM listings
    WHERE status = 'published'
      AND updated_at < now() - interval '60 days'
      AND source_type != 'linkout'
  `);

  for (const row of staleListings.rows) {
    anomalies.push({
      listingId: row.id,
      type: 'stale',
      severity: 'low',
      details: { lastUpdated: row.updated_at },
    });
  }

  // 3. Duplicate suspects (same price + bedrooms + area, different source)
  // Only check linkout vs linkout or linkout vs internal.
  const duplicateSuspects = await db.query(`
    SELECT l1.id, l1.title, l1.source_url, l2.id as dup_id, l2.title as dup_title
    FROM listings l1
    JOIN listings l2 ON 
      l1.price_amount = l2.price_amount
      AND l1.bedrooms = l2.bedrooms
      AND l1.area = l2.area
      AND l1.id < l2.id
      AND l1.source_domain != l2.source_domain
    WHERE l1.status = 'published' AND l2.status = 'published'
  `);

  for (const row of duplicateSuspects.rows) {
    anomalies.push({
      listingId: row.id,
      type: 'duplicate_suspect',
      severity: 'medium',
      details: {
        duplicateOf: row.dup_id,
        duplicateTitle: row.dup_title,
      },
    });
  }

  // Store anomalies
  for (const anomaly of anomalies) {
    await db.query(`
      INSERT INTO listing_anomalies (listing_id, anomaly_type, severity, details)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [anomaly.listingId, anomaly.type, anomaly.severity, JSON.stringify(anomaly.details)]);
  }

  await writeAudit({
    actorType: 'system',
    actorId: 'ops-agent',
    action: 'anomaly.detect',
    entity: 'listing_anomaly',
    payload: { count: anomalies.length },
  });

  return anomalies;
}
