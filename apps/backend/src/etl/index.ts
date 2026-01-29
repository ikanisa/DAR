/**
 * ETL Module Index
 * Main orchestrator for the External ETL pipeline
 */

export { fetchPage, type FetchResult, type FetchOptions } from './fetchPage.js';
export { extractSchemaOrg, type ExtractedListing, type SchemaOrgListing } from './extractSchemaOrg.js';
export { extractFallback, type FallbackExtractedListing } from './extractFallback.js';
export {
    normalizeListing,
    inferPropertyType,
    parseAllowedFields,
    type NormalizedListing,
    type AllowedField,
    type ExtractedData,
} from './normalizeListing.js';
export {
    checkDuplicate,
    updateLastChecked,
    computeSimilarity,
    type DedupeResult,
} from './dedupe.js';
