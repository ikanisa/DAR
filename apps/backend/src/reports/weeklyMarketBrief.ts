
import { db } from '../db.js';
import { researchClient } from '../integrations/aiResearch.js';
import { writeAudit } from '../audit.js'; // Adjust path if audit logic is elsewhere

interface BriefSection {
  title: string;
  content: string;
}

export async function generateWeeklyBrief(): Promise<string> {
  // 1. Get internal stats
  const stats = await getInternalStats();

  // 2. Research external market data
  console.log('Generating weekly brief: Researching market...');
  let marketResearch;
  try {
    marketResearch = await researchClient.deepResearch(`
      Malta real estate market update for the week of ${new Date().toLocaleDateString()}.
      
      Research and report on:
      1. Current rental price trends in major areas (Sliema, St Julian's, Valletta, Gzira)
      2. Any new property regulations or government announcements
      3. Notable market developments or large transactions
      4. Seasonal trends affecting the market
      
      Cite all sources.
    `);
  } catch (error) {
    console.error('Research failed, using fallback empty research:', error);
    marketResearch = {
      content: 'AI Research unavailable at this time.',
      citations: [],
      model: 'none',
      tokensUsed: 0
    };
  }

  // 3. Combine into report
  const report = `
# Malta Property Market Weekly Brief

**Week of ${new Date().toLocaleDateString()}**

## Platform Statistics

- New listings this week: ${stats.newListings}
- Total active listings: ${stats.activeListings}
- Link-out listings: ${stats.linkoutListings}
- Average price (rent): €${stats.avgRentPrice}/month
- Most active areas: ${stats.topAreas.join(', ')}

## Market Research

${marketResearch.content}

## Anomalies Detected

${stats.anomalies} new anomalies flagged this week (${stats.unresolvedAnomalies} unresolved)

---

Generated: ${new Date().toISOString()}
Model: ${marketResearch.model}
Tokens: ${marketResearch.tokensUsed}
`;

  // 4. Store report
  await db.query(`
    INSERT INTO market_reports (report_type, title, content, citations, model_used, tokens_used)
    VALUES ('weekly_brief', $1, $2, $3, $4, $5)
  `, [
    `Weekly Brief - ${new Date().toLocaleDateString()}`,
    report,
    JSON.stringify(marketResearch.citations),
    marketResearch.model,
    marketResearch.tokensUsed,
  ]);

  await writeAudit({
    actorType: 'system',
    actorId: 'ops-agent',
    action: 'report.generate',
    entity: 'market_report',
    payload: { type: 'weekly_brief', tokens: marketResearch.tokensUsed },
  });

  return report;
}

async function getInternalStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const listings = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at > $1) as new_listings,
      COUNT(*) FILTER (WHERE status = 'published') as active_listings,
      COUNT(*) FILTER (WHERE source_type = 'linkout') as linkout_listings,
      AVG(price_amount) FILTER (WHERE type = 'apartment' AND price_currency = 'EUR') as avg_rent
    FROM listings
  `, [weekAgo]);

  const topAreas = await db.query(`
    SELECT area, COUNT(*) as count
    FROM listings
    WHERE area IS NOT NULL AND status = 'published'
    GROUP BY area
    ORDER BY count DESC
    LIMIT 5
  `);

  const anomalies = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE detected_at > $1) as new_anomalies,
      COUNT(*) FILTER (WHERE resolved = false) as unresolved
    FROM listing_anomalies
  `, [weekAgo]);

  return {
    newListings: listings.rows[0]?.new_listings || 0,
    activeListings: listings.rows[0]?.active_listings || 0,
    linkoutListings: listings.rows[0]?.linkout_listings || 0,
    avgRentPrice: Math.round(listings.rows[0]?.avg_rent || 0),
    topAreas: topAreas.rows.map(r => r.area),
    anomalies: anomalies.rows[0]?.new_anomalies || 0,
    unresolvedAnomalies: anomalies.rows[0]?.unresolved || 0,
  };
}
