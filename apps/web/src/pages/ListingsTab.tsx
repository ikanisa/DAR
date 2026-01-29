/**
 * ListingsTab Component
 * 
 * Displays published listings in a bento grid layout.
 * Shows verified/unverified badges per workflow spec.
 */

import { useState, useEffect } from 'react';
import { ClayCard } from '../components/ui/ClayCard';
import { BentoGrid, BentoItem } from '../components/ui/BentoGrid';
import { StatusChip } from '../components/ui/StatusChip';
import { ClayPill } from '../components/ui/ClayPill';
import { supabase } from '../lib/supabase';
import { Loader2, Package, Tag } from 'lucide-react';

interface Listing {
    id: string;
    title: string;
    description?: string;
    price?: number;
    currency?: string;
    category?: string;
    verified: boolean;
    thumbnail?: string;
}

type FilterType = 'all' | 'verified' | 'unverified';

export function ListingsTab() {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

    useEffect(() => {
        fetchListings();
    }, []);

    const fetchListings = async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch published listings only
            const { data, error: fetchError } = await supabase
                .from('product_listings')
                .select('*')
                .eq('status', 'published')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            setListings(data || []);
        } catch (e) {
            console.error('Failed to fetch listings:', e);
            setError('Failed to load listings');
            // Use mock data for demo
            setListings([
                { id: '1', title: 'MacBook Pro 14"', description: 'M3 Pro, 18GB RAM', price: 2499, currency: '€', category: 'Electronics', verified: true },
                { id: '2', title: 'Designer Sofa', description: 'Modern minimalist design', price: 899, currency: '€', category: 'Furniture', verified: true },
                { id: '3', title: 'Web Development', description: 'Full-stack services', price: 50, currency: '€/hr', category: 'Services', verified: false },
                { id: '4', title: 'Vintage Camera', description: 'Canon AE-1 Program', price: 150, currency: '€', category: 'Electronics', verified: false },
            ]);
        } finally {
            setLoading(false);
        }
    };

    // Filter listings
    const filteredListings = listings.filter(listing => {
        if (filter === 'verified') return listing.verified;
        if (filter === 'unverified') return !listing.verified;
        return true;
    });

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" aria-label="Loading listings" />
            </div>
        );
    }

    // Empty state
    if (listings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="w-16 h-16 text-text-muted mb-4" aria-hidden="true" />
                <h2 className="text-xl font-bold mb-2">No Listings Yet</h2>
                <p className="text-text-muted max-w-sm">
                    Start selling through the chat! Just say "I want to sell..."
                </p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Listings</h2>

                {/* Filter pills */}
                <div className="flex gap-2" role="group" aria-label="Filter listings">
                    <ClayPill
                        size="sm"
                        active={filter === 'all'}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </ClayPill>
                    <ClayPill
                        size="sm"
                        active={filter === 'verified'}
                        onClick={() => setFilter('verified')}
                    >
                        ✓ Verified
                    </ClayPill>
                    <ClayPill
                        size="sm"
                        active={filter === 'unverified'}
                        onClick={() => setFilter('unverified')}
                    >
                        Unverified
                    </ClayPill>
                </div>
            </div>

            {filteredListings.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                    No {filter !== 'all' ? filter : ''} listings found
                </div>
            ) : (
                <BentoGrid columns={2}>
                    {filteredListings.map((listing) => (
                        <BentoItem key={listing.id}>
                            <ClayCard className="h-full group cursor-pointer hover:scale-[1.02] transition-transform">
                                {/* Thumbnail */}
                                <div className="h-24 -m-5 mb-4 rounded-t-3xl bg-gradient-to-br from-clay-action/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                                    {listing.thumbnail ? (
                                        <img
                                            src={listing.thumbnail}
                                            alt={listing.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Package className="w-10 h-10 text-text-muted/50" aria-hidden="true" />
                                    )}
                                </div>

                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-bold truncate flex-1 pr-2">{listing.title}</h3>
                                    <StatusChip
                                        status={listing.verified ? 'verified' : 'pending'}
                                        showIcon={false}
                                    />
                                </div>

                                {listing.description && (
                                    <p className="text-text-muted text-sm mb-3 line-clamp-2">
                                        {listing.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between mt-auto">
                                    {listing.price && (
                                        <span className="text-clay-action font-bold text-lg">
                                            {listing.currency}{listing.price.toLocaleString()}
                                        </span>
                                    )}
                                    {listing.category && (
                                        <span className="flex items-center gap-1 text-xs text-text-muted">
                                            <Tag size={12} aria-hidden="true" />
                                            {listing.category}
                                        </span>
                                    )}
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
