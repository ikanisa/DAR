/**
 * Fallback Extractor
 * Extracts listing data from HTML using meta tags and heuristics
 * when Schema.org data is not available
 */

import * as cheerio from 'cheerio';
import type { ExtractedListing } from './extractSchemaOrg.js';

export interface FallbackExtractedListing extends Omit<ExtractedListing, 'extractionMethod'> {
    extractionMethod: 'meta' | 'heuristic';
}

/**
 * Extract listing data using meta tags and heuristics
 */
export function extractFallback(
    html: string,
    sourceUrl: string
): FallbackExtractedListing | null {
    const $ = cheerio.load(html);

    // Try Open Graph meta tags first
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogUrl = $('meta[property="og:url"]').attr('content');

    // Try Twitter cards
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const twitterDescription = $('meta[name="twitter:description"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');

    // Try standard meta tags
    const metaDescription = $('meta[name="description"]').attr('content');

    // Get page title
    const pageTitle = $('title').text().trim();

    // Combine sources
    const title = ogTitle || twitterTitle || pageTitle || 'Untitled Listing';
    const description = ogDescription || twitterDescription || metaDescription || null;

    // Collect images
    const images: string[] = [];
    if (ogImage) images.push(ogImage);
    if (twitterImage && twitterImage !== ogImage) images.push(twitterImage);

    // Try to extract additional images from the page
    $('img[src*="property"], img[src*="listing"], img[data-src*="property"]')
        .slice(0, 10)
        .each((_, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src && !images.includes(src)) {
                images.push(src);
            }
        });

    // Try to extract price from content
    const priceText = $('.price, .property-price, [class*="price"]').first().text();
    const priceData = extractPrice(title, description, priceText);

    // Try to extract bedrooms/bathrooms
    const bedroomText = $('.bedrooms, .beds, [class*="bedroom"]').first().text();
    const bedrooms = extractBedrooms(title, description, bedroomText);
    const bathroomText = $('.bathrooms, .baths, [class*="bathroom"]').first().text();
    const bathrooms = extractBathrooms(title, description, bathroomText);

    // Try to extract location/area
    const locationText = $('.location, .address, [class*="location"]').first().text();
    const area = extractArea(title, description, locationText, sourceUrl);

    // If we have at least a title and price or bedrooms, consider it valid
    if (!title || (!priceData.price && !bedrooms)) {
        return null;
    }

    return {
        title,
        description,
        price: priceData.price,
        currency: priceData.currency,
        bedrooms,
        bathrooms,
        area,
        address: null, // Fallback can't reliably get full address
        sizeSqm: null,
        images,
        canonicalUrl: ogUrl || sourceUrl,
        extractionMethod: ogTitle ? 'meta' : 'heuristic',
    };
}

/**
 * Extract price from page content
 */
function extractPrice(
    title: string,
    description: string | null,
    priceText: string
): { price: number | null; currency: string } {
    const textToSearch = [
        title,
        description || '',
        priceText,
    ].join(' ');

    // Match patterns like "€1,200", "EUR 1200", "1200 EUR", "€1.200,00"
    const patterns = [
        /€\s*([\d,.']+)/i,
        /EUR\s*([\d,.']+)/i,
        /([\d,.']+)\s*EUR/i,
        /\$\s*([\d,.']+)/i,
        /USD\s*([\d,.']+)/i,
        /([\d,.']+)\s*USD/i,
    ];

    for (const pattern of patterns) {
        const match = textToSearch.match(pattern);
        if (match) {
            // Handle European number format (1.200,00) vs US format (1,200.00)
            let priceStr = match[1];

            // If comma appears after period, it's European format
            const lastComma = priceStr.lastIndexOf(',');
            const lastPeriod = priceStr.lastIndexOf('.');

            if (lastComma > lastPeriod) {
                // European: 1.200,00 -> 1200.00
                priceStr = priceStr.replace(/\./g, '').replace(',', '.');
            } else {
                // US: 1,200.00 -> 1200.00
                priceStr = priceStr.replace(/,/g, '');
            }

            const price = parseFloat(priceStr);
            if (!isNaN(price) && price > 0) {
                const currency = pattern.toString().includes('$') ? 'USD' : 'EUR';
                return { price, currency };
            }
        }
    }

    return { price: null, currency: 'EUR' };
}

/**
 * Extract bedroom count from content
 */
function extractBedrooms(
    title: string,
    description: string | null,
    bedroomText: string
): number | null {
    const textToSearch = [
        title,
        description || '',
        bedroomText,
    ].join(' ');

    // Match patterns like "3 bedrooms", "3 bed", "3BR", "3-bedroom"
    const patterns = [
        /(\d+)\s*(?:bedroom|bed|BR)/i,
        /(\d+)-?bed/i,
    ];

    for (const pattern of patterns) {
        const match = textToSearch.match(pattern);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num >= 0 && num <= 20) {
                return num;
            }
        }
    }

    return null;
}

/**
 * Extract bathroom count from content
 */
function extractBathrooms(
    title: string,
    description: string | null,
    bathroomText: string
): number | null {
    const textToSearch = [
        title,
        description || '',
        bathroomText,
    ].join(' ');

    // Match patterns like "2 bathrooms", "2 bath", "2BA"
    const patterns = [
        /(\d+)\s*(?:bathroom|bath|BA)/i,
    ];

    for (const pattern of patterns) {
        const match = textToSearch.match(pattern);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num >= 0 && num <= 10) {
                return num;
            }
        }
    }

    return null;
}

/**
 * Extract area/location from content
 */
function extractArea(
    title: string,
    description: string | null,
    locationText: string,
    sourceUrl: string
): string | null {
    // Malta localities to look for
    const maltaLocalities = [
        'Sliema', 'St Julians', "St Julian's", 'Valletta', 'Gzira', 'Msida',
        'Swieqi', 'Birkirkara', 'Mosta', 'Naxxar', 'Mellieha', 'Gozo',
        'Attard', 'Balzan', 'Lija', 'Iklin', 'San Gwann', 'Pembroke',
        'Ta Xbiex', "Ta' Xbiex", 'Floriana', 'Pieta', 'Marsascala',
        'Marsaxlokk', 'Rabat', 'Mdina', 'Zebbug', 'Siggiewi', 'Zejtun',
        'Fgura', 'Paola', 'Tarxien', 'Qormi', 'Hamrun', 'Marsa',
        'Victoria', 'Xaghra', 'Nadur', 'Sannat', 'Xewkija', 'Qala',
    ];

    const textToSearch = [
        title,
        description || '',
        locationText,
    ].join(' ');

    for (const locality of maltaLocalities) {
        if (textToSearch.toLowerCase().includes(locality.toLowerCase())) {
            return locality;
        }
    }

    // Try to extract from URL
    const urlPath = new URL(sourceUrl).pathname.toLowerCase();
    for (const locality of maltaLocalities) {
        if (urlPath.includes(locality.toLowerCase().replace(/['\s]/g, '-'))) {
            return locality;
        }
    }

    return null;
}
