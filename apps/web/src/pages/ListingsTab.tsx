/**
 * ListingsTab Component
 * 
 * Displays Malta real estate property listings from Supabase.
 * Shows property details including images, source agency, bedrooms, location, and price.
 */

import { useState, useEffect } from 'react';
import { ClayCard } from '@dar/ui';
import { BentoGrid, BentoItem } from '@dar/ui';
import { SkeletonList } from '@dar/ui';
import { EmptyState } from '@dar/ui';
import { ErrorState } from '@dar/ui';
import { ClayPill } from '@dar/ui';
import { supabase } from '../lib/supabase';
import { Home, MapPin, Bed, Bath, Ruler, ExternalLink, Building2, Calendar } from 'lucide-react';

interface Listing {
    id: string;
    title: string;
    description?: string;
    type?: string;
    price_amount?: number;
    price_currency?: string;
    bedrooms?: number;
    bathrooms?: number;
    size_sqm?: number;
    address_text?: string;
    status?: string;
    quality_score?: number;
    created_at?: string;
    // Image fields
    image_url?: string;
    images?: string[];
    // Source/origin fields
    source?: string;
    source_url?: string;
    external_link?: string;
}

type FilterType = 'all' | 'apartment' | 'house' | 'commercial';

interface ListingsTabProps {
    onNavigate?: (tab: string) => void;
    onSchedule?: (listingId: string, title?: string) => void;
}

export function ListingsTab({ onSchedule }: ListingsTabProps) {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

    useEffect(() => {
        fetchListings();
    }, []);

    const fetchListings = async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch from the 'listings' table which has real property data
            const { data, error: fetchError } = await supabase
                .from('listings')
                .select('*')
                .in('status', ['published', 'approved'])
                .order('created_at', { ascending: false })
                .limit(50);

            if (fetchError) throw fetchError;

            setListings(data || []);
        } catch (e) {
            console.error('Failed to fetch listings:', e);
            setError('Failed to load property listings. Please check your connection.');
            setListings([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter listings by type
    const filteredListings = listings.filter(listing => {
        if (filter === 'all') return true;
        return (listing.type || '').toLowerCase() === filter;
    });

    // Format price
    const formatPrice = (amount?: number, currency?: string) => {
        if (!amount) return null;
        const curr = currency || 'EUR';
        return new Intl.NumberFormat('en-MT', {
            style: 'currency',
            currency: curr,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Get property type color
    const getTypeColor = (type?: string) => {
        switch (type?.toLowerCase()) {
            case 'apartment': return 'bg-blue-500/20 text-blue-400';
            case 'house': return 'bg-green-500/20 text-green-400';
            case 'penthouse': return 'bg-purple-500/20 text-purple-400';
            case 'commercial': return 'bg-orange-500/20 text-orange-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    // Open external link
    const handleViewListing = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Handle schedule
    const handleSchedule = (e: React.MouseEvent, listing: Listing) => {
        e.stopPropagation();
        if (onSchedule) {
            onSchedule(listing.id, listing.title);
        }
    };

    // Loading state with skeleton
    if (loading) {
        return (
            <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-8 w-40 bg-white/5 rounded-lg animate-pulse" />
                    <div className="flex gap-2">
                        <div className="h-9 w-16 bg-white/5 rounded-full animate-pulse" />
                        <div className="h-9 w-24 bg-white/5 rounded-full animate-pulse" />
                    </div>
                </div>
                <SkeletonList count={6} columns={2} />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <ErrorState
                title="Connection Error"
                message={error}
                onRetry={fetchListings}
            />
        );
    }

    // Empty state
    if (listings.length === 0) {
        return (
            <EmptyState
                icon={Home}
                title="No Properties Found"
                description="New Malta properties will appear here once they're listed."
            />
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Malta Properties</h2>

                {/* Filter pills */}
                <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter properties">
                    <ClayPill
                        size="sm"
                        active={filter === 'all'}
                        onClick={() => setFilter('all')}
                    >
                        All ({listings.length})
                    </ClayPill>
                    <ClayPill
                        size="sm"
                        active={filter === 'apartment'}
                        onClick={() => setFilter('apartment')}
                    >
                        Apartments
                    </ClayPill>
                    <ClayPill
                        size="sm"
                        active={filter === 'house'}
                        onClick={() => setFilter('house')}
                    >
                        Houses
                    </ClayPill>
                </div>
            </div>

            {filteredListings.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                    No {filter !== 'all' ? filter + 's' : 'properties'} found
                </div>
            ) : (
                <BentoGrid columns={2}>
                    {filteredListings.map((listing) => (
                        <BentoItem key={listing.id}>
                            <ClayCard
                                className="h-full group cursor-pointer hover:scale-[1.02] transition-transform flex flex-col"
                                onClick={() => listing.external_link && handleViewListing(listing.external_link)}
                            >
                                {/* Property Image */}
                                <div className="h-32 -m-5 mb-4 rounded-t-3xl bg-gradient-to-br from-clay-action/20 to-purple-500/20 flex items-center justify-center overflow-hidden relative">
                                    {listing.image_url ? (
                                        <img
                                            src={listing.image_url}
                                            alt={listing.title}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <Building2 className="w-12 h-12 text-text-muted/30" aria-hidden="true" />
                                    )}

                                    {/* Property type badge */}
                                    {listing.type && (
                                        <span className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-medium capitalize ${getTypeColor(listing.type)}`}>
                                            {listing.type}
                                        </span>
                                    )}

                                    {/* Source badge */}
                                    {listing.source && (
                                        <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs font-medium bg-black/60 text-white backdrop-blur-sm">
                                            {listing.source}
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className="font-bold text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
                                    {listing.title}
                                </h3>

                                {/* Location */}
                                {listing.address_text && (
                                    <div className="flex items-center gap-1 text-text-muted text-xs mb-2">
                                        <MapPin size={12} aria-hidden="true" className="flex-shrink-0" />
                                        <span className="truncate">{listing.address_text}</span>
                                    </div>
                                )}

                                {/* Property details row */}
                                <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
                                    {listing.bedrooms !== undefined && listing.bedrooms !== null && (
                                        <span className="flex items-center gap-1">
                                            <Bed size={12} aria-hidden="true" />
                                            {listing.bedrooms === 0 ? 'Studio' : listing.bedrooms}
                                        </span>
                                    )}
                                    {listing.bathrooms && (
                                        <span className="flex items-center gap-1">
                                            <Bath size={12} aria-hidden="true" />
                                            {listing.bathrooms}
                                        </span>
                                    )}
                                    {listing.size_sqm && (
                                        <span className="flex items-center gap-1">
                                            <Ruler size={12} aria-hidden="true" />
                                            {listing.size_sqm}m²
                                        </span>
                                    )}
                                </div>

                                {/* Price and View Link */}
                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                                    {listing.price_amount ? (
                                        <span className="text-clay-action font-bold text-lg">
                                            {formatPrice(listing.price_amount, listing.price_currency)}
                                            <span className="text-xs text-text-muted font-normal">/month</span>
                                        </span>
                                    ) : (
                                        <span className="text-text-muted text-sm">Price on request</span>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {/* Schedule Viewing (if not external) or just prefer viewing */}
                                        <button
                                            className="p-1.5 rounded-full bg-clay-action/10 text-clay-action hover:bg-clay-action hover:text-white transition-colors"
                                            onClick={(e) => handleSchedule(e, listing)}
                                            title="Schedule Viewing"
                                        >
                                            <Calendar size={14} />
                                        </button>

                                        {listing.external_link && (
                                            <span
                                                className="flex items-center gap-1 text-xs text-clay-action hover:underline"
                                            >
                                                <ExternalLink size={12} />
                                                View
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </ClayCard>
                        </BentoItem>
                    ))}
                </BentoGrid>
            )}
        </div>
    );
}

export default ListingsTab;
