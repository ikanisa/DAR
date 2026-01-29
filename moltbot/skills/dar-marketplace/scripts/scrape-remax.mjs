#!/usr/bin/env node
/**
 * RE/MAX Malta Property Scraper
 * 
 * Fetches rental listings from RE/MAX Malta and inserts them into Supabase.
 * 
 * Usage:
 *   node scripts/scrape-remax.mjs
 * 
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Supabase service role key (for writes)
 */

import { createClient } from '@supabase/supabase-js';

// Config
const REMAX_API_BASE = 'https://remax-malta.com/api/properties';
const BATCH_SIZE = 50;
const DELAY_MS = 500;

// Initialize Supabase with service role for inserts
const supabaseUrl = process.env.SUPABASE_URL || 'https://yxtpdgxaqoqsozhkysty.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
    console.error('Missing SUPABASE_SERVICE_KEY environment variable');
    console.log('Usage: SUPABASE_SERVICE_KEY=your-key node scrape-remax.mjs');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Fetch listings page from RE/MAX Malta
 */
async function fetchRemaxPage(page = 1, forRent = true) {
    const params = new URLSearchParams({
        ForSale: String(!forRent),
        ForRent: String(forRent),
        Residential: 'true',
        Commercial: 'false',
        page: String(page),
        pageSize: String(BATCH_SIZE),
    });

    const url = `${REMAX_API_BASE}?${params}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MaltaPropertyBot/1.0 (+https://dar.mt/bot)',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch page ${page}:`, error.message);
        return null;
    }
}

/**
 * Alternative: Scrape HTML if no API available
 */
async function scrapeRemaxHtml(page = 1, forRent = true) {
    const params = new URLSearchParams({
        ForSale: String(!forRent),
        ForRent: String(forRent),
        Residential: 'true',
        Commercial: 'false',
    });

    const url = `https://remax-malta.com/listings?${params}&page=${page}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MaltaPropertyBot/1.0 (+https://dar.mt/bot)',
                'Accept': 'text/html,application/xhtml+xml',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // Try to extract JSON data from __NEXT_DATA__ script (Next.js sites)
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s);
        if (nextDataMatch) {
            const nextData = JSON.parse(nextDataMatch[1]);
            return nextData?.props?.pageProps?.properties || nextData?.props?.pageProps?.listings || null;
        }

        // Try to extract JSON-LD listings
        const ldJsonMatches = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.+?)<\/script>/gs)];
        for (const match of ldJsonMatches) {
            try {
                const data = JSON.parse(match[1]);
                if (data['@type'] === 'ItemList' && data.itemListElement) {
                    return data.itemListElement.map(item => item.item || item);
                }
            } catch (e) {
                continue;
            }
        }

        console.log('Could not extract structured data, falling back to HTML parsing...');
        return extractListingsFromHtml(html);
    } catch (error) {
        console.error(`Failed to scrape page ${page}:`, error.message);
        return null;
    }
}

/**
 * Basic HTML extraction fallback
 */
function extractListingsFromHtml(html) {
    const listings = [];

    // Match property card patterns (adjust based on actual HTML structure)
    const cardPattern = /<a[^>]+href="\/property\/([^"]+)"[^>]*>.*?<\/a>/gs;
    const matches = html.matchAll(cardPattern);

    for (const match of matches) {
        const slug = match[1];
        listings.push({
            slug,
            url: `https://remax-malta.com/property/${slug}`,
        });
    }

    return listings.length > 0 ? listings : null;
}

/**
 * Transform RE/MAX listing to our schema
 */
function transformListing(remaxListing, forRent = true) {
    const listing = {
        title: remaxListing.title || remaxListing.name || 'Property Listing',
        description: remaxListing.description?.slice(0, 1000) || null,
        type: inferPropertyType(remaxListing),
        price_amount: parsePrice(remaxListing.price || remaxListing.rentPrice),
        price_currency: 'EUR',
        bedrooms: parseInt(remaxListing.bedrooms || remaxListing.numberOfBedrooms) || null,
        bathrooms: parseInt(remaxListing.bathrooms || remaxListing.numberOfBathrooms) || null,
        size_sqm: parseFloat(remaxListing.size || remaxListing.area) || null,
        address_text: buildAddress(remaxListing),
        status: 'published',
        source: 'RE/MAX Malta',
        source_url: 'https://www.remax-malta.com',
        external_link: remaxListing.url || `https://remax-malta.com/property/${remaxListing.slug || remaxListing.id}`,
        image_url: extractImageUrl(remaxListing),
        images: extractImages(remaxListing),
    };

    return listing;
}

function inferPropertyType(listing) {
    const title = (listing.title || '').toLowerCase();
    const type = (listing.propertyType || listing.type || '').toLowerCase();

    if (type.includes('apartment') || title.includes('apartment') || title.includes('flat')) return 'apartment';
    if (type.includes('penthouse') || title.includes('penthouse')) return 'penthouse';
    if (type.includes('maisonette') || title.includes('maisonette')) return 'maisonette';
    if (type.includes('villa') || title.includes('villa')) return 'villa';
    if (type.includes('house') || title.includes('house') || type.includes('terraced')) return 'house';
    if (type.includes('studio') || title.includes('studio')) return 'studio';
    return 'other';
}

function parsePrice(price) {
    if (!price) return null;
    if (typeof price === 'number') return price;

    const cleaned = String(price).replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || null;
}

function buildAddress(listing) {
    const parts = [
        listing.address,
        listing.locality || listing.area || listing.location,
        listing.region,
        'Malta'
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : null;
}

function extractImageUrl(listing) {
    if (listing.mainImage) return listing.mainImage;
    if (listing.image) return typeof listing.image === 'string' ? listing.image : listing.image[0];
    if (listing.images?.length > 0) return listing.images[0];
    if (listing.photos?.length > 0) return listing.photos[0]?.url || listing.photos[0];
    return null;
}

function extractImages(listing) {
    const images = listing.images || listing.photos || [];
    return images.map(img => typeof img === 'string' ? img : img.url).filter(Boolean);
}

/**
 * Upsert listing into Supabase
 */
async function upsertListing(listing) {
    // Use external_link as unique key
    const { data, error } = await supabase
        .from('listings')
        .upsert(listing, {
            onConflict: 'external_link',
            ignoreDuplicates: false,
        })
        .select('id')
        .single();

    if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error(`Failed to upsert listing:`, error.message);
        return null;
    }

    return data?.id || null;
}

/**
 * Main scraper function
 */
async function scrapeRemax(options = {}) {
    const { forRent = true, maxPages = 50 } = options;

    console.log(`\n🏠 RE/MAX Malta Scraper`);
    console.log(`Mode: ${forRent ? 'Rentals' : 'Sales'}`);
    console.log(`Max pages: ${maxPages}`);
    console.log('─'.repeat(40));

    let page = 1;
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
        console.log(`\n📄 Fetching page ${page}...`);

        // Try API first, fallback to HTML scraping
        let listings = await fetchRemaxPage(page, forRent);

        if (!listings || listings.length === 0) {
            listings = await scrapeRemaxHtml(page, forRent);
        }

        if (!listings || listings.length === 0) {
            console.log('No more listings found.');
            hasMore = false;
            break;
        }

        console.log(`   Found ${listings.length} listings`);

        for (const remaxListing of listings) {
            const transformed = transformListing(remaxListing, forRent);

            if (!transformed.external_link) {
                console.log(`   ⚠️ Skipping listing without URL`);
                continue;
            }

            const id = await upsertListing(transformed);

            if (id) {
                totalInserted++;
                process.stdout.write('.');
            } else {
                totalUpdated++;
                process.stdout.write('•');
            }

            totalProcessed++;
        }

        console.log(''); // Newline after progress dots

        // Check if we got a full page (more might be available)
        if (listings.length < BATCH_SIZE) {
            hasMore = false;
        }

        page++;

        // Rate limiting
        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log('\n' + '─'.repeat(40));
    console.log(`✅ Scraping complete!`);
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Inserted: ${totalInserted}`);
    console.log(`   Updated: ${totalUpdated}`);
    console.log(`   Pages scraped: ${page - 1}`);
}

// Run
scrapeRemax({ forRent: true, maxPages: 30 })
    .then(() => {
        console.log('\n🏁 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
