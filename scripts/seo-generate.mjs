import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_DIR = process.env.SEO_OUTPUT_DIR ? path.resolve(ROOT, process.env.SEO_OUTPUT_DIR) : ROOT;
const SITE_URL = 'https://dar.ikanisa.com';
const LISTING_MIN_CHARS = 120;
const REQUEST_MIN_CHARS = 80;

const readFileSafe = async (filePath) => {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
};

const slugify = (value) =>
  value
    .toString()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const writeFile = async (filePath, content) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
};

const stripHtml = (text = '') => text.replace(/<[^>]*>/g, '').trim();

const loadEnv = async () => {
  const envPath = path.join(ROOT, '.env');
  const envContent = await readFileSafe(envPath);
  const env = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = trimmed.split('=');
    env[key] = rest.join('=').trim();
  });

  const indexHtml = await readFileSafe(path.join(ROOT, 'index.html'));
  const supabaseUrlMatch = indexHtml.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
  const supabaseKeyMatch = indexHtml.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

  return {
    supabaseUrl: process.env.SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL || supabaseUrlMatch?.[1],
    supabaseKey: process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || supabaseKeyMatch?.[1]
  };
};

const fetchSupabase = async (url, supabaseKey) => {
  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase fetch failed: ${response.status} ${text}`);
  }
  return response.json();
};

const formatPrice = (price, currency = 'EUR') => {
  if (!price) return 'Price on request';
  const symbol = currency === 'EUR' ? '€' : '';
  return `${symbol}${Number(price).toLocaleString()}${currency !== 'EUR' ? ` ${currency}` : ''}`;
};

const template = ({
  title,
  description,
  canonical,
  body,
  noindex = false,
  structuredData = []
}) => {
  const robots = noindex ? "noindex,nofollow" : "index,follow";
  const ldJson = structuredData
    .filter(Boolean)
    .map((data) => `<script type=\"application/ld+json\">${JSON.stringify(data)}</script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>${title}</title>
  <meta name=\"description\" content=\"${description}\">
  <meta name=\"robots\" content=\"${robots}\">
  <link rel=\"canonical\" href=\"${canonical}\">
  <meta property=\"og:title\" content=\"${title}\">
  <meta property=\"og:description\" content=\"${description}\">
  <meta property=\"og:url\" content=\"${canonical}\">
  <meta property=\"og:image\" content=\"${SITE_URL}/og-image.png\">
  <meta name=\"twitter:card\" content=\"summary_large_image\">
  <meta name=\"twitter:title\" content=\"${title}\">
  <meta name=\"twitter:description\" content=\"${description}\">
  <meta name=\"twitter:image\" content=\"${SITE_URL}/og-image.png\">
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;line-height:1.6;color:#1f1f1f;margin:0;background:#faf7f5}
    header{padding:32px 20px;background:#fff;border-bottom:1px solid #eee}
    main{max-width:960px;margin:0 auto;padding:32px 20px}
    a{color:#5b8fa3;text-decoration:none}
    a:hover{text-decoration:underline}
    .meta{color:#6b6b6b;font-size:0.9rem}
    .grid{display:grid;gap:16px}
    .card{background:#fff;border-radius:16px;padding:16px;border:1px solid #eee}
    .chip{display:inline-block;background:#f5f1ed;padding:4px 10px;border-radius:999px;font-size:0.8rem;color:#555}
    .list{display:grid;gap:12px;margin-top:16px}
  </style>
  ${ldJson}
</head>
<body>
  <header>
    <strong>Dar</strong> — AI Real Estate Concierge for Malta
    <div class=\"meta\">${description}</div>
  </header>
  <main>
    ${body}
  </main>
</body>
</html>`;
};

const buildBreadcrumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url
  }))
});

const buildItemList = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: item.url,
    name: item.name
  }))
});

const generate = async () => {
  const { supabaseUrl, supabaseKey } = await loadEnv();
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  const listings = await fetchSupabase(
    `${supabaseUrl}/rest/v1/property_listings?select=id,title,summary,image_url,price,currency,location,type,bedrooms,bathrooms,source,source_url,published_at&order=published_at.desc`,
    supabaseKey
  );

  const sources = await fetchSupabase(
    `${supabaseUrl}/rest/v1/property_feed_sources?select=id,name,url,category,active&active=eq.true`,
    supabaseKey
  );

  const listingPages = [];
  const categoryMap = new Map();
  const locationMap = new Map();
  const vendorMap = new Map();

  listings.forEach((listing) => {
    const summary = stripHtml(listing.summary || '');
    const isIndexable = summary.length >= LISTING_MIN_CHARS;
    const id = listing.id;
    const slug = slugify(listing.title || `listing-${id}`);
    const url = `${SITE_URL}/listing/${id}`;
    const category = listing.type || 'general';
    const location = listing.location || 'Malta';

    listingPages.push({
      id,
      url,
      slug,
      category,
      location,
      summary,
      isIndexable,
      listing
    });

    const categorySlug = slugify(category);
    if (!categoryMap.has(categorySlug)) {
      categoryMap.set(categorySlug, { name: category, items: [] });
    }
    categoryMap.get(categorySlug).items.push({ id, title: listing.title, url, summary });

    const locationSlug = slugify(location);
    if (!locationMap.has(locationSlug)) {
      locationMap.set(locationSlug, { name: location, items: [] });
    }
    locationMap.get(locationSlug).items.push({ id, title: listing.title, url, summary });

    const vendorKey = slugify(listing.source || 'source');
    if (!vendorMap.has(vendorKey)) {
      vendorMap.set(vendorKey, { name: listing.source || 'Source', items: [] });
    }
    vendorMap.get(vendorKey).items.push({ id, title: listing.title, url, summary });
  });

  const vendorPages = sources.map((source) => {
    const slug = slugify(source.name || source.url);
    const url = `${SITE_URL}/vendor/${slug}`;
    const listingsForVendor = vendorMap.get(slug)?.items || [];
    return { slug, url, source, listings: listingsForVendor };
  });

  const writeListingPage = async (page) => {
    const listing = page.listing;
    const price = formatPrice(listing.price, listing.currency);
    const categorySlug = slugify(page.category);
    const locationSlug = slugify(page.location);
    const vendorSlug = slugify(listing.source || 'source');
    const body = `
      <h1>${listing.title || 'Listing'}</h1>
      ${listing.image_url ? `<img src="${listing.image_url}" alt="${listing.title}" loading="lazy" style="width:100%;height:auto;border-radius:16px;margin-bottom:16px;object-fit:cover;aspect-ratio:16/9;">` : ''}
      <div class=\"meta\">${price} • ${page.location} • ${page.category}</div>
      <p>${page.summary || 'Full description available in the app.'}</p>
      <div class=\"list\">
        <div class=\"card\">Category: <a href=\"${SITE_URL}/categories/${categorySlug}\">${page.category}</a></div>
        <div class=\"card\">Location: <a href=\"${SITE_URL}/locations/${locationSlug}\">${page.location}</a></div>
        <div class=\"card\">Source: <a href=\"${SITE_URL}/vendor/${vendorSlug}\">${listing.source || 'Source'}</a></div>
      </div>
      <div class=\"list\">
        <a href=\"${SITE_URL}/listings\">Browse all listings</a>
      </div>
    `;

    const structuredData = [
      buildBreadcrumb([
        { name: 'Home', url: SITE_URL },
        { name: 'Listings', url: `${SITE_URL}/listings` },
        { name: listing.title || 'Listing', url: page.url }
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'Offer',
        name: listing.title || 'Listing',
        price: listing.price || undefined,
        priceCurrency: listing.currency || undefined,
        url: page.url,
        description: page.summary || undefined
      }
    ];

    const html = template({
      title: `${listing.title || 'Listing'} — ${price} in ${page.location} | Listing`,
      description: page.summary || `Listing in ${page.location}.`,
      canonical: page.url,
      body,
      noindex: !page.isIndexable,
      structuredData
    });

    await writeFile(path.join(OUTPUT_DIR, 'listing', String(page.id), 'index.html'), html);
  };

  for (const page of listingPages) {
    await writeListingPage(page);
  }

  const listingIndexBody = `
    <h1>Published Listings</h1>
    <p>Browse verified listings updated by Moltbot every hour.</p>
    <div class=\"list\">
      ${listingPages.slice(0, 50).map((item) => `<div class=\"card\"><a href=\"${item.url}\">${item.listing.title}</a><div class=\"meta\">${item.location}</div></div>`).join('')}
    </div>
  `;

  await writeFile(path.join(OUTPUT_DIR, 'listings', 'index.html'), template({
    title: 'Listings — Malta Marketplace',
    description: 'Browse published listings across Malta with daily updates.',
    canonical: `${SITE_URL}/listings`,
    body: listingIndexBody,
    structuredData: [
      buildBreadcrumb([
        { name: 'Home', url: SITE_URL },
        { name: 'Listings', url: `${SITE_URL}/listings` }
      ]),
      buildItemList(listingPages.slice(0, 50).map((item) => ({ url: item.url, name: item.listing.title })))
    ]
  }));

  const vendorsBody = `
    <h1>Verified Directory</h1>
    <p>Sources and partners contributing to Dar’s marketplace updates.</p>
    <div class=\"grid\">
      ${vendorPages.map((vendor) => `<div class=\"card\"><a href=\"${vendor.url}\">${vendor.source.name}</a><div class=\"meta\">${vendor.source.category || 'Source'}</div></div>`).join('')}
    </div>
  `;

  await writeFile(path.join(OUTPUT_DIR, 'vendors', 'index.html'), template({
    title: 'Vendors — Verified Directory',
    description: 'Browse verified sources and marketplace partners powering Dar listings.',
    canonical: `${SITE_URL}/vendors`,
    body: vendorsBody,
    structuredData: [
      buildBreadcrumb([
        { name: 'Home', url: SITE_URL },
        { name: 'Vendors', url: `${SITE_URL}/vendors` }
      ]),
      buildItemList(vendorPages.map((vendor) => ({ url: vendor.url, name: vendor.source.name })))
    ]
  }));

  for (const vendor of vendorPages) {
    const vendorBody = `
      <h1>${vendor.source.name}</h1>
      <div class=\"meta\">${vendor.source.category || 'Marketplace source'}</div>
      <p>Official source: <a href=\"${vendor.source.url}\">${vendor.source.url}</a></p>
      <div class=\"list\">
        ${vendor.listings.slice(0, 20).map((item) => `<div class=\"card\"><a href=\"${item.url}\">${item.title}</a></div>`).join('') || '<div class=\"card\">Listings will appear here after the next Moltbot sync.</div>'}
      </div>
    `;

    const vendorSchema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: vendor.source.name,
      url: vendor.source.url
    };

    await writeFile(path.join(OUTPUT_DIR, 'vendor', vendor.slug, 'index.html'), template({
      title: `${vendor.source.name} — ${vendor.source.category || 'Vendor'} in Malta | Marketplace`,
      description: `Verified source in ${vendor.source.category || 'Malta'}. Browse latest listings and updates.`,
      canonical: vendor.url,
      body: vendorBody,
      noindex: vendor.listings.length === 0,
      structuredData: [
        buildBreadcrumb([
          { name: 'Home', url: SITE_URL },
          { name: 'Vendors', url: `${SITE_URL}/vendors` },
          { name: vendor.source.name, url: vendor.url }
        ]),
        vendorSchema
      ]
    }));
  }

  for (const [slug, category] of categoryMap) {
    const categoryUrl = `${SITE_URL}/categories/${slug}`;
    const body = `
      <h1>${category.name} Listings</h1>
      <p>Explore ${category.items.length} listings in ${category.name}.</p>
      <div class=\"list\">
        ${category.items.slice(0, 50).map((item) => `<div class=\"card\"><a href=\"${item.url}\">${item.title}</a></div>`).join('')}
      </div>
    `;

    await writeFile(path.join(OUTPUT_DIR, 'categories', slug, 'index.html'), template({
      title: `${category.name} Listings | Marketplace`,
      description: `Browse ${category.name} listings across Malta.`,
      canonical: categoryUrl,
      body,
      structuredData: [
        buildBreadcrumb([
          { name: 'Home', url: SITE_URL },
          { name: 'Categories', url: `${SITE_URL}/categories/${slug}` }
        ]),
        buildItemList(category.items.slice(0, 50).map((item) => ({ url: item.url, name: item.title })))
      ]
    }));
  }

  for (const [slug, location] of locationMap) {
    const locationUrl = `${SITE_URL}/locations/${slug}`;
    const body = `
      <h1>${location.name} Listings</h1>
      <p>Browse ${location.items.length} listings in ${location.name}.</p>
      <div class=\"list\">
        ${location.items.slice(0, 50).map((item) => `<div class=\"card\"><a href=\"${item.url}\">${item.title}</a></div>`).join('')}
      </div>
    `;

    await writeFile(path.join(OUTPUT_DIR, 'locations', slug, 'index.html'), template({
      title: `${location.name} Listings | Marketplace`,
      description: `Find listings in ${location.name}, Malta.`,
      canonical: locationUrl,
      body,
      structuredData: [
        buildBreadcrumb([
          { name: 'Home', url: SITE_URL },
          { name: location.name, url: locationUrl }
        ]),
        buildItemList(location.items.slice(0, 50).map((item) => ({ url: item.url, name: item.title })))
      ]
    }));
  }

  await writeFile(path.join(OUTPUT_DIR, 'requests', 'index.html'), template({
    title: 'Requests — Community Marketplace',
    description: 'Community requests will appear here once published.',
    canonical: `${SITE_URL}/requests`,
    body: '<h1>Requests</h1><p>No public requests available yet.</p>',
    noindex: true,
    structuredData: [
      buildBreadcrumb([
        { name: 'Home', url: SITE_URL },
        { name: 'Requests', url: `${SITE_URL}/requests` }
      ])
    ]
  }));

  await writeFile(path.join(OUTPUT_DIR, 'search', 'index.html'), template({
    title: 'Search — Marketplace',
    description: 'Search listings, categories, and locations in Malta.',
    canonical: `${SITE_URL}/search`,
    body: '<h1>Search</h1><p>Use the app to search listings by keyword, category, or location.</p>',
    noindex: false,
    structuredData: [
      buildBreadcrumb([
        { name: 'Home', url: SITE_URL },
        { name: 'Search', url: `${SITE_URL}/search` }
      ])
    ]
  }));

  const sitemapIndex = [];
  const sitemapFiles = [];

  const listingSitemapEntries = listingPages
    .filter((page) => page.isIndexable)
    .map((page) => `<url><loc>${page.url}</loc></url>`);

  const listingSitemap = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"https://www.sitemaps.org/schemas/sitemap/0.9\">\n${listingSitemapEntries.join('\n')}\n</urlset>`;
  await writeFile(path.join(OUTPUT_DIR, 'sitemap-listings.xml'), listingSitemap);
  sitemapFiles.push('sitemap-listings.xml');

  const vendorEntries = vendorPages
    .filter((vendor) => vendor.listings.length > 0)
    .map((vendor) => `<url><loc>${vendor.url}</loc></url>`);
  const vendorSitemap = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"https://www.sitemaps.org/schemas/sitemap/0.9\">\n${vendorEntries.join('\n')}\n</urlset>`;
  await writeFile(path.join(OUTPUT_DIR, 'sitemap-vendors.xml'), vendorSitemap);
  sitemapFiles.push('sitemap-vendors.xml');

  const categoryEntries = Array.from(categoryMap.keys()).map((slug) => `<url><loc>${SITE_URL}/categories/${slug}</loc></url>`);
  const categorySitemap = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"https://www.sitemaps.org/schemas/sitemap/0.9\">\n${categoryEntries.join('\n')}\n</urlset>`;
  await writeFile(path.join(OUTPUT_DIR, 'sitemap-categories.xml'), categorySitemap);
  sitemapFiles.push('sitemap-categories.xml');

  const locationEntries = Array.from(locationMap.keys()).map((slug) => `<url><loc>${SITE_URL}/locations/${slug}</loc></url>`);
  const locationSitemap = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"https://www.sitemaps.org/schemas/sitemap/0.9\">\n${locationEntries.join('\n')}\n</urlset>`;
  await writeFile(path.join(OUTPUT_DIR, 'sitemap-locations.xml'), locationSitemap);
  sitemapFiles.push('sitemap-locations.xml');

  const requestSitemap = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"https://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>`;
  await writeFile(path.join(OUTPUT_DIR, 'sitemap-requests.xml'), requestSitemap);
  sitemapFiles.push('sitemap-requests.xml');

  sitemapFiles.forEach((file) => {
    sitemapIndex.push(`<sitemap><loc>${SITE_URL}/${file}</loc></sitemap>`);
  });

  const sitemapIndexXml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<sitemapindex xmlns=\"https://www.sitemaps.org/schemas/sitemap/0.9\">\n${sitemapIndex.join('\n')}\n</sitemapindex>`;
  await writeFile(path.join(OUTPUT_DIR, 'sitemap.xml'), sitemapIndexXml);

  const robots = `User-agent: *\nAllow: /\nDisallow: /chat\nDisallow: /notifications\nDisallow: /inbox\nDisallow: /me/\nDisallow: /draft/\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  await writeFile(path.join(OUTPUT_DIR, 'robots.txt'), robots);

  console.log('SEO pages generated:', listingPages.length);
};

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
