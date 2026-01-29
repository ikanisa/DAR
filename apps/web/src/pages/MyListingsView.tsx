/**
 * MyListingsView (Seller Dashboard)
 * 
 * Shows the user's own listings with status management.
 * Includes drafts, published, and archived listings.
 */

import { useState, useEffect } from 'react';
import { ClayButton } from '../components/ui/ClayButton';
import { CreateListingFlow } from '../components/listings/CreateListingFlow';
import { supabase } from '../lib/supabase';
import { ProductListing, ListingStatus } from '../lib/types';
import { useSession } from '../lib/SessionContext';
import { Plus, Package, Edit2, Trash2, Eye, Loader2 } from 'lucide-react';

type TabFilter = 'all' | 'draft' | 'published' | 'archived';

export function MyListingsView() {
    const { sessionId } = useSession();
    const [listings, setListings] = useState<ProductListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabFilter>('all');
    const [showCreateFlow, setShowCreateFlow] = useState(false);

    // Fetch user's listings
    useEffect(() => {
        async function loadMyListings() {
            if (!sessionId) return;

            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('product_listings')
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('updated_at', { ascending: false });

                if (error) throw error;
                setListings(data || []);
            } catch (e) {
                console.error('Failed to load my listings:', e);
            } finally {
                setLoading(false);
            }
        }
        loadMyListings();
    }, [sessionId]);

    // Filter listings by status
    const filteredListings = listings.filter(listing => {
        if (activeTab === 'all') return true;
        return listing.status === activeTab;
    });

    // Count by status
    const counts = {
        all: listings.length,
        draft: listings.filter(l => l.status === 'draft').length,
        published: listings.filter(l => l.status === 'published').length,
        archived: listings.filter(l => l.status === 'archived').length,
    };

    // Handle listing actions
    const handlePublish = async (id: string) => {
        if (!sessionId) return;

        const { error } = await supabase
            .from('product_listings')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('session_id', sessionId);

        if (!error) {
            setListings(prev => prev.map(l =>
                l.id === id ? { ...l, status: 'published' as ListingStatus } : l
            ));
        }
    };

    const handleArchive = async (id: string) => {
        if (!sessionId) return;

        const { error } = await supabase
            .from('product_listings')
            .update({ status: 'archived', updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('session_id', sessionId);

        if (!error) {
            setListings(prev => prev.map(l =>
                l.id === id ? { ...l, status: 'archived' as ListingStatus } : l
            ));
        }
    };

    const handleDelete = async (id: string) => {
        if (!sessionId) return;

        const confirmed = window.confirm('Are you sure you want to delete this listing?');
        if (!confirmed) return;

        const { error } = await supabase
            .from('product_listings')
            .delete()
            .eq('id', id)
            .eq('session_id', sessionId);

        if (!error) {
            setListings(prev => prev.filter(l => l.id !== id));
        }
    };

    const handleListingComplete = (_listingId: string) => {
        setShowCreateFlow(false);
        // Refresh listings
        if (sessionId) {
            supabase
                .from('product_listings')
                .select('*')
                .eq('session_id', sessionId)
                .order('updated_at', { ascending: false })
                .then(({ data }) => {
                    if (data) setListings(data);
                });
        }
    };

    // Show create flow
    if (showCreateFlow) {
        return (
            <CreateListingFlow
                sessionId={sessionId}
                onClose={() => setShowCreateFlow(false)}
                onComplete={handleListingComplete}
            />
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" />
            </div>
        );
    }

    return (
        <div className="pb-24 pt-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-display font-bold">My Listings</h2>
                <ClayButton onClick={() => setShowCreateFlow(true)}>
                    <Plus size={18} className="mr-2" />
                    New Listing
                </ClayButton>
            </div>

            {/* Status tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {(['all', 'draft', 'published', 'archived'] as TabFilter[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`
              px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all flex items-center gap-2
              ${activeTab === tab
                                ? 'bg-clay-action text-white'
                                : 'bg-clay-card border border-white/10 text-text-secondary hover:border-clay-action/50'
                            }
            `}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        <span className={`text-xs ${activeTab === tab ? 'bg-white/20' : 'bg-white/10'} px-1.5 py-0.5 rounded-full`}>
                            {counts[tab]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Listings or empty state */}
            {filteredListings.length === 0 ? (
                <div className="text-center py-16 bg-clay-card border border-white/10 rounded-2xl">
                    <Package size={48} className="text-text-muted mx-auto mb-4" />
                    <p className="text-text-muted">
                        {activeTab === 'all'
                            ? "You haven't created any listings yet"
                            : `No ${activeTab} listings`
                        }
                    </p>
                    {activeTab === 'all' && (
                        <ClayButton
                            variant="ghost"
                            className="mt-4"
                            onClick={() => setShowCreateFlow(true)}
                        >
                            <Plus size={16} className="mr-2" /> Create your first listing
                        </ClayButton>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredListings.map((listing) => (
                        <div key={listing.id} className="bg-clay-card border border-white/10 rounded-xl p-4">
                            {/* Listing info */}
                            <div className="flex gap-4">
                                {/* Thumbnail */}
                                <div className="w-20 h-20 bg-gradient-to-br from-clay-action/20 to-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {listing.images?.[0] ? (
                                        <img
                                            src={listing.images[0]}
                                            alt={listing.title}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                    ) : (
                                        <Package size={24} className="text-text-muted" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h3 className="font-medium text-text-primary truncate">{listing.title}</h3>
                                            <p className="text-lg font-bold text-clay-action">
                                                {listing.price ? `${listing.currency}${listing.price}` : 'No price'}
                                            </p>
                                        </div>

                                        {/* Status badge */}
                                        <span className={`
                      text-xs font-medium px-2 py-1 rounded-full
                      ${listing.status === 'published' ? 'bg-green-500/20 text-green-400' : ''}
                      ${listing.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                      ${listing.status === 'archived' ? 'bg-gray-500/20 text-gray-400' : ''}
                    `}>
                                            {listing.status}
                                        </span>
                                    </div>

                                    {listing.description && (
                                        <p className="text-sm text-text-muted line-clamp-1 mt-1">
                                            {listing.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                                {listing.status === 'draft' && (
                                    <>
                                        <ClayButton size="sm" onClick={() => handlePublish(listing.id)}>
                                            <Eye size={14} className="mr-1" /> Publish
                                        </ClayButton>
                                        <ClayButton size="sm" variant="ghost">
                                            <Edit2 size={14} className="mr-1" /> Edit
                                        </ClayButton>
                                    </>
                                )}
                                {listing.status === 'published' && (
                                    <>
                                        <ClayButton size="sm" variant="ghost" onClick={() => handleArchive(listing.id)}>
                                            Archive
                                        </ClayButton>
                                        <ClayButton size="sm" variant="ghost">
                                            <Edit2 size={14} className="mr-1" /> Edit
                                        </ClayButton>
                                    </>
                                )}
                                {listing.status === 'archived' && (
                                    <ClayButton size="sm" variant="ghost" onClick={() => handlePublish(listing.id)}>
                                        Republish
                                    </ClayButton>
                                )}
                                <ClayButton
                                    size="sm"
                                    variant="ghost"
                                    className="!text-red-400"
                                    onClick={() => handleDelete(listing.id)}
                                >
                                    <Trash2 size={14} />
                                </ClayButton>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
