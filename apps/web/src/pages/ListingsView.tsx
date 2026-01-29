/**
 * ListingsView
 * 
 * Displays product listings in a grid with filtering and vendor sections.
 */

import { useState, useEffect } from 'react';
import { ClayButton } from '@dar/ui';
import { ListingCard } from '../components/listings/ListingCard';
import { VendorCard } from '../components/listings/VendorCard';
import { fetchPublishedListings, fetchVerifiedVendors } from '../lib/moltbotActions';
import { ProductListing, Vendor } from '@dar/core';
import { Filter, Grid, List, Loader2 } from 'lucide-react';

type ViewMode = 'grid' | 'list';
type ListingFilter = 'all' | 'products' | 'services' | 'verified';

export function ListingsView() {
    const [listings, setListings] = useState<ProductListing[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [filter, setFilter] = useState<ListingFilter>('all');

    // Fetch data on mount
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const [listingsData, vendorsData] = await Promise.all([
                    fetchPublishedListings({ limit: 20 }),
                    fetchVerifiedVendors({ limit: 5 }),
                ]);
                setListings(listingsData);
                setVendors(vendorsData as Vendor[]);
            } catch (e) {
                console.error('Failed to load listings:', e);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Filter listings
    const filteredListings = listings.filter(listing => {
        switch (filter) {
            case 'products':
                return listing.listing_type === 'product';
            case 'services':
                return listing.listing_type === 'service';
            case 'verified':
                return listing.is_verified_vendor || listing.verified;
            default:
                return true;
        }
    });

    const handleListingClick = (listing: ProductListing) => {
        console.log('Listing clicked:', listing.id);
        // TODO: Navigate to listing detail or open modal
    };

    const handleVendorClick = (vendor: Vendor) => {
        console.log('Vendor clicked:', vendor.id);
        // TODO: Navigate to vendor profile
    };

    const handleFavorite = (id: string) => {
        console.log('Favorited:', id);
        // TODO: Save to favorites
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" />
            </div>
        );
    }

    return (
        <div className="pb-24 pt-4 space-y-8">
            {/* Header with filters */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-display font-bold">Marketplace</h2>
                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex bg-clay-card border border-white/10 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-clay-action text-white' : 'text-text-muted hover:text-white'}`}
                        >
                            <Grid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded ${viewMode === 'list' ? 'bg-clay-action text-white' : 'text-text-muted hover:text-white'}`}
                        >
                            <List size={16} />
                        </button>
                    </div>
                    <ClayButton size="sm" variant="ghost">
                        <Filter size={16} className="mr-1" /> Filter
                    </ClayButton>
                </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 custom-scrollbar">
                {(['all', 'products', 'services', 'verified'] as ListingFilter[]).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`
              px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all
              ${filter === f
                                ? 'bg-clay-action text-white'
                                : 'bg-clay-card border border-white/10 text-text-secondary hover:border-clay-action/50'
                            }
            `}
                    >
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Verified Vendors Section */}
            {vendors.length > 0 && (
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-text-primary">Verified Vendors</h3>
                        <ClayButton size="sm" variant="ghost">See all</ClayButton>
                    </div>
                    <div className="overflow-x-auto -mx-4 px-4 pb-2">
                        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
                            {vendors.map((vendor) => (
                                <div key={vendor.id} className="w-64 flex-shrink-0">
                                    <VendorCard
                                        vendor={vendor}
                                        variant="compact"
                                        onClick={handleVendorClick}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Listings Grid */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-text-primary">
                        {filter === 'all' ? 'All Listings' : `${filter.charAt(0).toUpperCase() + filter.slice(1)}`}
                        <span className="text-text-muted font-normal ml-2">({filteredListings.length})</span>
                    </h3>
                </div>

                {filteredListings.length === 0 ? (
                    <div className="text-center py-12 bg-clay-card border border-white/10 rounded-2xl">
                        <p className="text-4xl mb-4">📭</p>
                        <p className="text-text-muted">No listings found</p>
                        <p className="text-sm text-text-muted mt-1">Try adjusting your filters</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredListings.map((listing) => (
                            <ListingCard
                                key={listing.id}
                                listing={listing}
                                variant="compact"
                                onClick={handleListingClick}
                                onFavorite={handleFavorite}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredListings.map((listing) => (
                            <ListingCard
                                key={listing.id}
                                listing={listing}
                                variant="default"
                                onClick={handleListingClick}
                                onFavorite={handleFavorite}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

