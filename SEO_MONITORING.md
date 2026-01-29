# SEO Monitoring & Search Console

## Google Search Console (GSC)
1. Verify ownership for `dar.ikanisa.com` (DNS preferred).
2. Submit sitemap index: `https://dar.ikanisa.com/sitemap.xml`.
3. Monitor coverage for: listings, vendors, categories, locations.

## KPIs to watch
- Indexed pages count (listings, vendors, categories, locations)
- Impressions/clicks by category + location
- Top queries
- Core Web Vitals field data
- 404/soft-404 spikes

## Error monitoring
- Crawl errors from GSC
- 404 logs in Cloudflare
- Sitemap fetch errors

## Notes
- Thin listings are noindexed until summary >= 120 chars.
- Requests pages are currently noindex until public requests exist.
- Private routes are blocked via X-Robots-Tag headers.
