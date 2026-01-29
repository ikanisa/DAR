/**
 * Core Types for PWA Marketplace
 */

// Session types
export interface Session {
    id: string;
    anon_user_id: string;
    language: string;
    user_agent?: string;
    ip_hash?: string;
    created_at: string;
    last_seen_at: string;
    metadata: Record<string, unknown>;
}

// Vendor types
export interface Vendor {
    id: string;
    name: string;
    slug: string;
    description?: string;
    category?: string;
    location?: string;
    contact_email?: string;
    contact_phone?: string;
    website?: string;
    logo_url?: string;
    verified: boolean;
    verification_date?: string;
    response_rate: number;
    avg_response_time: number;
    created_at: string;
    updated_at: string;
}

// Listing types
export type ListingType = 'product' | 'service';
export type ListingStatus = 'draft' | 'published' | 'archived';

export interface ProductListing {
    id: string;
    session_id: string;
    vendor_id?: string;
    title: string;
    description?: string;
    price?: number;
    currency: string;
    category?: string;
    images?: string[];
    status: ListingStatus;
    listing_type: ListingType;
    location?: string;
    verified: boolean;
    created_at: string;
    updated_at: string;
    // Computed fields (from joins)
    vendor?: Vendor;
    is_verified_vendor?: boolean;
}

// Post types (buy/sell requests)
export type PostType = 'buy' | 'sell';
export type PostStatus = 'draft' | 'posted' | 'matched' | 'closed';

export interface MarketPost {
    id: string;
    session_id: string;
    type: PostType;
    status: PostStatus;
    title?: string;
    description?: string;
    budget_min?: number;
    budget_max?: number;
    currency: string;
    location?: string;
    created_at: string;
    updated_at: string;
}

// Notification types
export interface WebNotification {
    id: string;
    session_id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    read: boolean;
    created_at: string;
}

// External feed items (links only, not inventory)
export interface ExternalFeedItem {
    id: string;
    url: string;
    title?: string;
    source?: string;
    image_url?: string;
    published_at?: string;
    crawled_at: string;
}

// Verification request
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface ListingVerificationRequest {
    id: string;
    listing_id: string;
    session_id: string;
    requested_vendor_name?: string;
    status: VerificationStatus;
    admin_notes?: string;
    created_at: string;
}

// Chat message types (for Moltbot)
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCall?: string;
    toolParams?: Record<string, unknown>;
}

// Moltbot output schema (strict)
export interface MoltbotOutput {
    action: string;
    data?: Record<string, unknown>;
    message?: string;
    error?: string;
}
