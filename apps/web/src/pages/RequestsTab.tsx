/**
 * RequestsTab Component
 * 
 * Displays user's buy/sell requests with match suggestions.
 * Allows finding matches via the matching pipeline.
 */

import { useState, useEffect } from 'react';
import { ClayCard } from '../components/ui/ClayCard';
import { ClayButton } from '../components/ui/ClayButton';
import { ClayPill } from '../components/ui/ClayPill';
import { BentoGrid, BentoItem } from '../components/ui/BentoGrid';
import { GlassBottomSheet } from '../components/ui/GlassBottomSheet';
import { StatusChip } from '../components/ui/StatusChip';
import { useSession } from '../lib/SessionContext';
import { fetchMarketPosts } from '../lib/moltbotActions';
import { runMatchingPipeline, fetchMatchSuggestions, RankedMatch } from '../lib/matchingService';
import { Loader2, ShoppingCart, Store, Search, Sparkles, X } from 'lucide-react';

interface MarketPost {
    id: string;
    type: 'buy' | 'sell';
    title: string;
    description?: string;
    category?: string;
    budget_min?: number;
    budget_max?: number;
    currency?: string;
    location?: string;
    status: 'draft' | 'posted' | 'closed';
    created_at: string;
}

export function RequestsTab() {
    const { sessionId } = useSession();
    const [posts, setPosts] = useState<MarketPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');

    // Match sheet state
    const [selectedPost, setSelectedPost] = useState<MarketPost | null>(null);
    const [matches, setMatches] = useState<RankedMatch[]>([]);
    const [matchLoading, setMatchLoading] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => {
        if (sessionId) {
            loadPosts();
        }
    }, [sessionId]);

    const loadPosts = async () => {
        if (!sessionId) return;

        setLoading(true);
        try {
            const data = await fetchMarketPosts(sessionId);
            setPosts(data as MarketPost[]);
        } catch (e) {
            console.error('Failed to load posts:', e);
            // Demo data
            setPosts([
                { id: '1', type: 'buy', title: 'Looking for MacBook Pro', description: 'Need a recent model, good condition', category: 'Electronics', budget_min: 800, budget_max: 1500, currency: '€', status: 'posted', created_at: new Date().toISOString() },
                { id: '2', type: 'sell', title: 'iPhone 14 Pro', description: 'Excellent condition, 256GB', category: 'Electronics', status: 'posted', created_at: new Date().toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleFindMatches = async (post: MarketPost) => {
        if (!sessionId) return;

        setSelectedPost(post);
        setSheetOpen(true);
        setMatchLoading(true);

        try {
            // Check for existing matches first
            const existing = await fetchMatchSuggestions(post.id);

            if (existing.length > 0) {
                setMatches(existing);
            } else {
                // Run pipeline
                const result = await runMatchingPipeline(post.id, sessionId);
                setMatches(result.matches);
            }
        } catch (e) {
            console.error('Matching failed:', e);
            // Demo matches
            setMatches([
                { id: 'm1', title: 'MacBook Pro 14" M3', reason: 'Matches category: Electronics • Price within your budget', rank: 1, score: 70, source: 'internal', candidate: { id: 'm1', title: 'MacBook Pro 14" M3', price: 1200, currency: '€', verified: true, source: 'internal' } },
                { id: 'm2', title: 'MacBook Air M2', reason: 'Matches category: Electronics • Verified seller', rank: 2, score: 60, source: 'internal', candidate: { id: 'm2', title: 'MacBook Air M2', price: 900, currency: '€', verified: true, source: 'internal' } },
            ]);
        } finally {
            setMatchLoading(false);
        }
    };

    const handleRefreshMatches = async () => {
        if (!selectedPost || !sessionId) return;

        setMatchLoading(true);
        try {
            const result = await runMatchingPipeline(selectedPost.id, sessionId);
            setMatches(result.matches);
        } catch (e) {
            console.error('Refresh failed:', e);
        } finally {
            setMatchLoading(false);
        }
    };

    // Filter posts
    const filteredPosts = posts.filter(post => {
        if (filter === 'buy') return post.type === 'buy';
        if (filter === 'sell') return post.type === 'sell';
        return true;
    });

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" aria-label="Loading requests" />
            </div>
        );
    }

    // Empty state
    if (posts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <Search className="w-16 h-16 text-text-muted mb-4" aria-hidden="true" />
                <h2 className="text-xl font-bold mb-2">No Requests Yet</h2>
                <p className="text-text-muted max-w-sm mb-6">
                    Post your first buy or sell request through the chat!
                </p>
                <p className="text-sm text-text-secondary">
                    Try: "I want to buy a laptop" or "I want to sell my phone"
                </p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">My Requests</h2>

                {/* Filter pills */}
                <div className="flex gap-2" role="group" aria-label="Filter requests">
                    <ClayPill
                        size="sm"
                        active={filter === 'all'}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </ClayPill>
                    <ClayPill
                        size="sm"
                        active={filter === 'buy'}
                        onClick={() => setFilter('buy')}
                    >
                        <ShoppingCart size={14} aria-hidden="true" /> Buy
                    </ClayPill>
                    <ClayPill
                        size="sm"
                        active={filter === 'sell'}
                        onClick={() => setFilter('sell')}
                    >
                        <Store size={14} aria-hidden="true" /> Sell
                    </ClayPill>
                </div>
            </div>

            {/* Posts grid */}
            <BentoGrid columns={1}>
                {filteredPosts.map((post) => (
                    <BentoItem key={post.id}>
                        <ClayCard className="flex flex-col gap-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${post.type === 'buy' ? 'bg-purple-500/20' : 'bg-green-500/20'}`}>
                                        {post.type === 'buy' ? (
                                            <ShoppingCart className="w-5 h-5 text-purple-400" aria-hidden="true" />
                                        ) : (
                                            <Store className="w-5 h-5 text-green-400" aria-hidden="true" />
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-xs text-text-muted uppercase">
                                            {post.type === 'buy' ? 'Buying' : 'Selling'}
                                        </span>
                                        <h3 className="font-bold">{post.title}</h3>
                                    </div>
                                </div>
                                <StatusChip status={post.status === 'posted' ? 'verified' : 'pending'} showIcon={false} />
                            </div>

                            {post.description && (
                                <p className="text-text-muted text-sm line-clamp-2">
                                    {post.description}
                                </p>
                            )}

                            <div className="flex items-center gap-3 text-sm text-text-muted flex-wrap">
                                {post.category && (
                                    <span className="px-2 py-1 bg-white/5 rounded-full">
                                        {post.category}
                                    </span>
                                )}
                                {post.budget_max && (
                                    <span>
                                        Budget: {post.currency}{post.budget_min || 0} - {post.currency}{post.budget_max}
                                    </span>
                                )}
                                {post.location && <span>📍 {post.location}</span>}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-2">
                                <ClayButton
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleFindMatches(post)}
                                    className="flex-1"
                                >
                                    <Sparkles size={16} aria-hidden="true" />
                                    Find Matches
                                </ClayButton>
                            </div>
                        </ClayCard>
                    </BentoItem>
                ))}
            </BentoGrid>

            {/* Match results bottom sheet */}
            <GlassBottomSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                title={`Matches for "${selectedPost?.title || ''}"`}
            >
                <div className="p-4 pb-safe">
                    {matchLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-clay-action" />
                        </div>
                    ) : matches.length === 0 ? (
                        <div className="text-center py-12">
                            <X className="w-12 h-12 text-text-muted mx-auto mb-4" aria-hidden="true" />
                            <p className="text-text-muted">No matches found yet</p>
                            <ClayButton
                                variant="ghost"
                                size="sm"
                                onClick={handleRefreshMatches}
                                className="mt-4"
                            >
                                Try Again
                            </ClayButton>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-text-muted">
                                    Found {matches.length} match{matches.length !== 1 ? 'es' : ''}
                                </p>
                                <ClayButton variant="ghost" size="sm" onClick={handleRefreshMatches}>
                                    Refresh
                                </ClayButton>
                            </div>

                            {matches.map((match) => (
                                <ClayCard key={match.id} className="!p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <span className="text-xs text-clay-action font-bold">
                                                #{match.rank}
                                            </span>
                                            <h4 className="font-bold">{match.title}</h4>
                                        </div>
                                        {match.candidate.verified && (
                                            <StatusChip status="verified" showIcon />
                                        )}
                                    </div>
                                    <p className="text-sm text-text-muted mb-3">
                                        {match.reason}
                                    </p>
                                    {match.candidate.price && (
                                        <p className="text-clay-action font-bold">
                                            {match.candidate.currency}{match.candidate.price}
                                        </p>
                                    )}
                                </ClayCard>
                            ))}
                        </div>
                    )}
                </div>
            </GlassBottomSheet>
        </div>
    );
}

export default RequestsTab;
