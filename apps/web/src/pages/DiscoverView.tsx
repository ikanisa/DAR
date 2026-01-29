/**
 * DiscoverView
 * 
 * Discovery page with search, featured sections, and category browsing.
 */

import { useState, useEffect } from 'react';
import { SearchBar } from '../components/search/SearchBar';
import { ListingCard } from '../components/listings/ListingCard';
import { VendorCard } from '../components/listings/VendorCard';
import { fetchPublishedListings, fetchVerifiedVendors } from '../lib/moltbotActions';
import { ProductListing, Vendor } from '@dar/core';
import { Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { ClayButton } from '@dar/ui';

// Sample categories and locations
const CATEGORIES = ['Electronics', 'Home', 'Fashion', 'Services', 'Auto', 'Other'];
const TRENDING = ['iPhone', 'Furniture', 'Cleaning', 'Car repair'];

export function DiscoverView() {
    const [listings, setListings] = useState<ProductListing[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>();
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Load initial data
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const [listingsData, vendorsData] = await Promise.all([
                    fetchPublishedListings({ limit: 12 }),
                    fetchVerifiedVendors({ limit: 6 }),
                ]);
                setListings(listingsData);
                setVendors(vendorsData as Vendor[]);
            } catch (e) {
                console.error('Failed to load discover data:', e);
            } finally {
                setLoading(false);
            }
        }
        loadData();

        // Load recent searches from localStorage
        const stored = localStorage.getItem('dar_recent_searches');
        if (stored) {
            try {
                setRecentSearches(JSON.parse(stored));
            } catch { }
        }
    }, []);

    // Handle search
    const handleSearch = async (query: string, category?: string) => {
        setSearchQuery(query);
        setSelectedCategory(category);

        // Save to recent searches
        const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('dar_recent_searches', JSON.stringify(updated));

        // Fetch filtered results
        setLoading(true);
        try {
            const results = await fetchPublishedListings({
                category: category,
                limit: 20
            });
            // Basic client-side filtering for query
            const filtered = query
                ? results.filter(l =>
                    l.title.toLowerCase().includes(query.toLowerCase()) ||
                    l.description?.toLowerCase().includes(query.toLowerCase())
                )
                : results;
            setListings(filtered);
        } catch (e) {
            console.error('Search failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSelectedCategory(undefined);
        // Reload initial data
        fetchPublishedListings({ limit: 12 }).then(setListings);
    };

    const handleListingClick = (listing: ProductListing) => {
        console.log('Listing clicked:', listing.id);
        // TODO: Navigate to listing or open modal
    };

    const handleVendorClick = (vendor: Vendor) => {
        console.log('Vendor clicked:', vendor.id);
        // TODO: Navigate to vendor profile
    };

    return (
        <div className="pb-24 pt-4 space-y-8">
            {/* Search */}
            <SearchBar
                onSearch={handleSearch}
                onClear={handleClearSearch}
                placeholder="Search products, services..."
                categories={CATEGORIES}
                recentSearches={recentSearches}
                trending={TRENDING}
            />

            {/* Loading */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-clay-action" />
                </div>
            ) : searchQuery ? (
                /* Search Results */
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-text-primary">
                            Results for "{searchQuery}"
                            {selectedCategory && <span className="text-text-muted font-normal"> in {selectedCategory}</span>}
                            <span className="text-text-muted font-normal ml-2">({listings.length})</span>
                        </h2>
                    </div>

                    {listings.length === 0 ? (
                        <div className="text-center py-12 bg-clay-card border border-white/10 rounded-2xl">
                            <p className="text-4xl mb-4">🔍</p>
                            <p className="text-text-muted">No results found</p>
                            <p className="text-sm text-text-muted mt-1">Try different keywords or categories</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {listings.map((listing) => (
                                <ListingCard
                                    key={listing.id}
                                    listing={listing}
                                    variant="compact"
                                    onClick={handleListingClick}
                                />
                            ))}
                        </div>
                    )}
                </section>
            ) : (
                /* Discovery Feed */
                <>
                    {/* Featured vendors */}
                    {vendors.length > 0 && (
                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Sparkles size={18} className="text-clay-action" />
                                    Verified Vendors
                                </h2>
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

                    {/* Trending now */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <TrendingUp size={18} className="text-purple-400" />
                                Trending Now
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {listings.slice(0, 6).map((listing) => (
                                <ListingCard
                                    key={listing.id}
                                    listing={listing}
                                    variant="compact"
                                    onClick={handleListingClick}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Browse by category */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Browse by Category</h2>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {CATEGORIES.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => handleSearch('', category)}
                                    className="p-4 bg-clay-card border border-white/10 rounded-xl text-center hover:border-clay-action/50 transition-all"
                                >
                                    <p className="text-2xl mb-1">
                                        {category === 'Electronics' && '📱'}
                                        {category === 'Home' && '🏠'}
                                        {category === 'Fashion' && '👕'}
                                        {category === 'Services' && '🛠️'}
                                        {category === 'Auto' && '🚗'}
                                        {category === 'Other' && '📦'}
                                    </p>
                                    <p className="text-sm font-medium">{category}</p>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Latest listings */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Latest Listings</h2>
                            <ClayButton size="sm" variant="ghost">See all</ClayButton>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {listings.slice(6, 12).map((listing) => (
                                <ListingCard
                                    key={listing.id}
                                    listing={listing}
                                    variant="compact"
                                    onClick={handleListingClick}
                                />
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
