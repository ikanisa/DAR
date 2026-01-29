import Parser from "https://esm.sh/rss-parser@3.12.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  'https://dar.ikanisa.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]);

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://dar.ikanisa.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
});

const jsonResponse = (data: unknown, status = 200, origin?: string | null) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin ?? null)
    }
  });

const extractImage = (html?: string | null) => {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
};

const parsePrice = (text?: string | null) => {
  if (!text) return null;
  const euroMatch = text.replace(/,/g, '').match(/€\s?(\d+(?:\.\d+)?)/);
  if (euroMatch) return Number(euroMatch[1]);
  const eurMatch = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s?EUR/i);
  if (eurMatch) return Number(eurMatch[1]);
  return null;
};

const isLikelyFeed = (contentType: string | null, body: string) => {
  if (contentType) {
    const type = contentType.toLowerCase();
    if (type.includes('xml') || type.includes('rss') || type.includes('atom')) return true;
  }
  const trimmed = body.trim();
  return trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed');
};

const extractFeedLinks = (html: string, baseUrl: string) => {
  const links: string[] = [];
  const regex = /<link[^>]*rel=[\"']alternate[\"'][^>]*>/gi;
  const matches = html.match(regex) || [];

  for (const tag of matches) {
    const typeMatch = tag.match(/type=[\"']([^\"']+)[\"']/i);
    const hrefMatch = tag.match(/href=[\"']([^\"']+)[\"']/i);
    const type = typeMatch?.[1]?.toLowerCase() || '';
    if (!hrefMatch) continue;
    if (!type.includes('rss') && !type.includes('atom') && !type.includes('xml') && !type.includes('json')) continue;
    try {
      const resolved = new URL(hrefMatch[1], baseUrl).toString();
      links.push(resolved);
    } catch (_) {
      continue;
    }
  }

  return Array.from(new Set(links));
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Missing Supabase service credentials' }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  const payload = await req.json().catch(() => ({}));
  const envFeeds = Deno.env.get('PROPERTY_FEED_URLS') || '';
  let urls = (payload.urls || envFeeds.split(',')).map((url: string) => url.trim()).filter(Boolean);
  const feedMeta = new Map<string, { id?: string; name?: string }>();

  if (!urls.length) {
    const { data, error } = await supabase
      .from('property_feed_sources')
      .select('id, url, name, active, feed_url')
      .eq('active', true);

    if (error) {
      return jsonResponse({ error: error.message }, 500, origin);
    }

    urls = (data || []).map((row) => row.url).filter(Boolean);
    (data || []).forEach((row) => {
      if (row.url) feedMeta.set(row.url, { id: row.id, name: row.name, feed_url: row.feed_url });
    });
  }

  if (!urls.length) {
    return jsonResponse({ error: 'No feed URLs provided' }, 400, origin);
  }

  const parser = new Parser();
  const results: any[] = [];

  for (const url of urls) {
    try {
      const meta = feedMeta.get(url);
      const candidateUrls = meta?.feed_url ? [meta.feed_url] : [url];
      let feed: any = null;
      let feedSourceUrl: string | null = null;
      let lastError: string | null = null;

      for (const candidate of candidateUrls) {
        const response = await fetch(candidate, { headers: { 'User-Agent': 'DarRSS/1.0' } });
        if (!response.ok) {
          lastError = `HTTP ${response.status}`;
          continue;
        }

        const body = await response.text();
        if (isLikelyFeed(response.headers.get('content-type'), body)) {
          try {
            feed = await parser.parseString(body);
            feedSourceUrl = candidate;
            break;
          } catch (err) {
            lastError = err?.message ?? 'Invalid feed';
          }
        } else {
          const discovered = extractFeedLinks(body, candidate);
          for (const discoveredUrl of discovered) {
            const discoveredResponse = await fetch(discoveredUrl, { headers: { 'User-Agent': 'DarRSS/1.0' } });
            if (!discoveredResponse.ok) continue;
            const discoveredBody = await discoveredResponse.text();
            if (!isLikelyFeed(discoveredResponse.headers.get('content-type'), discoveredBody)) continue;
            try {
              feed = await parser.parseString(discoveredBody);
              feedSourceUrl = discoveredUrl;
              break;
            } catch (err) {
              lastError = err?.message ?? 'Invalid feed';
            }
          }
        }

        if (feed) break;
      }

      if (!feed) {
        if (meta?.id) {
          await supabase
            .from('property_feed_sources')
            .update({ last_error: lastError ?? 'No RSS/Atom feed detected' })
            .eq('id', meta.id);
        }
        results.push({ url, error: lastError ?? 'No RSS/Atom feed detected' });
        continue;
      }

      const source = meta?.name || feed.title || new URL(url).hostname;

      const records = (feed.items || []).map((item: any) => {
        const summary = item.contentSnippet || item.summary || item.content || null;
        const image = item.enclosure?.url || extractImage(item.content) || null;
        const price = parsePrice(item.title) || parsePrice(summary);

        return {
          title: item.title || 'Untitled Listing',
          link: item.link,
          summary,
          image_url: image,
          price,
          currency: price ? 'EUR' : null,
          location: item.creator || item.author || null,
          type: null,
          bedrooms: null,
          bathrooms: null,
          interior_area: null,
          outdoor_area: null,
          epc: null,
          parking: null,
          view: null,
          sea_distance: null,
          finish: null,
          orientation: null,
          source,
          source_url: url,
          published_at: item.isoDate ? new Date(item.isoDate).toISOString() : null,
          raw: item
        };
      }).filter((item: any) => item.link);

      if (records.length) {
        const { error } = await supabase
          .from('property_listings')
          .upsert(records, { onConflict: 'link' });

        if (error) {
          results.push({ url, error: error.message });
          continue;
        }
      }

      if (meta?.id) {
        await supabase
          .from('property_feed_sources')
          .update({
            last_synced_at: new Date().toISOString(),
            last_error: null,
            feed_url: feedSourceUrl || meta.feed_url || url
          })
          .eq('id', meta.id);
      }

      results.push({ url, source, inserted: records.length, feedUrl: feedSourceUrl });
    } catch (error) {
      results.push({ url, error: error?.message ?? 'Unknown error' });
    }
  }

  return jsonResponse({ ok: true, results }, 200, origin);
});
