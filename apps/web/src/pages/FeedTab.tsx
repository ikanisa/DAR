/**
 * FeedTab Component
 * 
 * Displays external feed items as link cards.
 * Gate-controlled: hidden when WEB_EXTERNAL_DISCOVERY_ENABLED is false.
 */

import { useState, useEffect } from 'react';
import { ClayCard } from '@dar/ui';
import { ClayPill } from '@dar/ui';
import { BentoGrid, BentoItem } from '@dar/ui';
import { isFeatureEnabled } from '../lib/featureFlags';
import {
    fetchAllFeedItems,
    webSearchItems,
    mapsPlacesItems,
    socialProfileItems,
    ExternalFeedItem,
    formatRelativeTime
} from '../lib/discoveryService';
import {
    Loader2,
    Globe,
    MapPin,
    Users,
    Newspaper,
    Link,
    ExternalLink,
    Search,
    Rss
} from 'lucide-react';
import clsx from 'clsx';

type SourceFilter = 'all' | 'web' | 'maps' | 'social' | 'news';

export function FeedTab() {
    const [items, setItems] = useState<ExternalFeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<SourceFilter>('all');
    const [flagsEnabled, setFlagsEnabled] = useState(false);

    useEffect(() => {
        // Check if feature is enabled
        const enabled = isFeatureEnabled('WEB_EXTERNAL_DISCOVERY_ENABLED');
        setFlagsEnabled(enabled);

        if (enabled) {
            loadItems();
        } else {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (flagsEnabled) {
            loadItems();
        }
    }, [filter, flagsEnabled]);

    const loadItems = async () => {
        setLoading(true);
        try {
            let result: ExternalFeedItem[] = [];

            switch (filter) {
                case 'web':
                    result = (await webSearchItems()).items;
                    break;
                case 'maps':
                    result = (await mapsPlacesItems()).items;
                    break;
                case 'social':
                    result = (await socialProfileItems()).items;
                    break;
                default:
                    result = await fetchAllFeedItems(30);
            }

            setItems(result);
        } catch (e) {
            console.error('Failed to load feed:', e);
            // Demo data for development
            setItems([
                { id: '1', url: 'https://example.com/tech', title: 'Latest Tech News', source: 'web', description: 'Stay updated with the latest technology trends', published_at: new Date().toISOString() },
                { id: '2', url: 'https://example.com/cafe', title: 'Best Coffee Shops Nearby', source: 'maps', description: 'Top rated coffee shops in your area', published_at: new Date(Date.now() - 3600000).toISOString() },
                { id: '3', url: 'https://example.com/social', title: '@techinfluencer', source: 'social', description: 'Follow for tech tips and tutorials', published_at: new Date(Date.now() - 86400000).toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (source: ExternalFeedItem['source']) => {
        const iconClass = "w-5 h-5";
        switch (source) {
            case 'web': return <Globe className={iconClass} aria-hidden="true" />;
            case 'maps': return <MapPin className={iconClass} aria-hidden="true" />;
            case 'social': return <Users className={iconClass} aria-hidden="true" />;
            case 'news': return <Newspaper className={iconClass} aria-hidden="true" />;
            default: return <Link className={iconClass} aria-hidden="true" />;
        }
    };

    const getSourceColor = (source: ExternalFeedItem['source']) => {
        switch (source) {
            case 'web': return 'text-blue-400 bg-blue-500/20';
            case 'maps': return 'text-green-400 bg-green-500/20';
            case 'social': return 'text-purple-400 bg-purple-500/20';
            case 'news': return 'text-yellow-400 bg-yellow-500/20';
            default: return 'text-text-muted bg-white/10';
        }
    };

    // Flags disabled state
    if (!flagsEnabled) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <Rss className="w-16 h-16 text-text-muted mb-4" aria-hidden="true" />
                <h2 className="text-xl font-bold mb-2">External Feeds Disabled</h2>
                <p className="text-text-muted max-w-sm">
                    External discovery features are currently turned off.
                </p>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" aria-label="Loading feed" />
            </div>
        );
    }

    // Empty state
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <Search className="w-16 h-16 text-text-muted mb-4" aria-hidden="true" />
                <h2 className="text-xl font-bold mb-2">No Items Found</h2>
                <p className="text-text-muted max-w-sm">
                    {filter === 'all'
                        ? 'No external feed items available yet.'
                        : `No ${filter} items available.`}
                </p>
            </div>
        );
    }

    // Check which filters are available
    const mapsEnabled = isFeatureEnabled('WEB_MAPS_ENABLED');
    const socialEnabled = isFeatureEnabled('WEB_SOCIAL_ENABLED');

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Discover</h2>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4" role="group" aria-label="Filter feed sources">
                <ClayPill
                    size="sm"
                    active={filter === 'all'}
                    onClick={() => setFilter('all')}
                >
                    All
                </ClayPill>
                <ClayPill
                    size="sm"
                    active={filter === 'web'}
                    onClick={() => setFilter('web')}
                >
                    <Globe size={14} aria-hidden="true" /> Web
                </ClayPill>
                {mapsEnabled && (
                    <ClayPill
                        size="sm"
                        active={filter === 'maps'}
                        onClick={() => setFilter('maps')}
                    >
                        <MapPin size={14} aria-hidden="true" /> Places
                    </ClayPill>
                )}
                {socialEnabled && (
                    <ClayPill
                        size="sm"
                        active={filter === 'social'}
                        onClick={() => setFilter('social')}
                    >
                        <Users size={14} aria-hidden="true" /> Social
                    </ClayPill>
                )}
            </div>

            {/* Feed items grid */}
            <BentoGrid columns={1}>
                {items.map((item) => (
                    <BentoItem key={item.id}>
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                        >
                            <ClayCard className="hover:scale-[1.01] transition-transform cursor-pointer">
                                <div className="flex items-start gap-4">
                                    {/* Source icon */}
                                    <div className={clsx(
                                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                        getSourceColor(item.source)
                                    )}>
                                        {getIcon(item.source)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold truncate">
                                                {item.title}
                                            </h3>
                                            <ExternalLink
                                                size={16}
                                                className="text-text-muted flex-shrink-0"
                                                aria-label="Opens in new tab"
                                            />
                                        </div>

                                        {item.description && (
                                            <p className="text-sm text-text-muted mt-1 line-clamp-2">
                                                {item.description}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                                            <span className="capitalize">{item.source}</span>
                                            {item.published_at && (
                                                <>
                                                    <span>•</span>
                                                    <span>{formatRelativeTime(item.published_at)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Thumbnail if available */}
                                    {item.image_url && (
                                        <img
                                            src={item.image_url}
                                            alt=""
                                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                            loading="lazy"
                                        />
                                    )}
                                </div>
                            </ClayCard>
                        </a>
                    </BentoItem>
                ))}
            </BentoGrid>
        </div>
    );
}

export default FeedTab;
