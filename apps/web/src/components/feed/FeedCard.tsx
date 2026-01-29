/**
 * FeedCard Component
 * 
 * Displays an external feed item with image, title, source badge.
 * Links to external URL (no inventory ownership).
 */

import { ExternalLink, Clock } from 'lucide-react';
import { ClayCard } from '../ui/ClayCard';
import { ExternalFeedItem } from '../../lib/types';

interface FeedCardProps {
    item: ExternalFeedItem;
    variant?: 'default' | 'compact';
}

// Format source name nicely
function formatSource(url: string, source?: string): string {
    if (source) return source;
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return 'External';
    }
}

// Time ago formatter
function timeAgo(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

export function FeedCard({ item, variant = 'default' }: FeedCardProps) {
    const sourceName = formatSource(item.url, item.source);
    const publishedTime = timeAgo(item.published_at || item.crawled_at);

    // Compact variant for horizontal scroll
    if (variant === 'compact') {
        return (
            <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-48 flex-shrink-0 bg-clay-card border border-white/10 rounded-xl overflow-hidden hover:border-clay-action/50 transition-all duration-200"
            >
                {/* Image */}
                <div className="aspect-video bg-gradient-to-br from-clay-action/20 to-purple-500/20 relative">
                    {item.image_url ? (
                        <img
                            src={item.image_url}
                            alt={item.title || 'Feed item'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <ExternalLink size={24} className="text-text-muted" />
                        </div>
                    )}

                    {/* Source badge */}
                    <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">
                        {sourceName}
                    </span>
                </div>

                {/* Title */}
                <div className="p-3">
                    <p className="text-sm font-medium text-text-primary line-clamp-2">
                        {item.title || 'View listing'}
                    </p>
                    {publishedTime && (
                        <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                            <Clock size={10} /> {publishedTime}
                        </p>
                    )}
                </div>
            </a>
        );
    }

    // Default full card variant
    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
        >
            <ClayCard className="!p-0 overflow-hidden hover:border-clay-action/50 transition-all duration-200">
                <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-24 h-24 bg-gradient-to-br from-clay-action/20 to-purple-500/20 flex-shrink-0">
                        {item.image_url ? (
                            <img
                                src={item.image_url}
                                alt={item.title || 'Feed item'}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <ExternalLink size={24} className="text-text-muted" />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 py-3 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-clay-action font-medium">{sourceName}</span>
                            {publishedTime && (
                                <span className="text-xs text-text-muted">• {publishedTime}</span>
                            )}
                        </div>
                        <h4 className="font-medium text-text-primary line-clamp-2">
                            {item.title || 'View listing'}
                        </h4>
                        <div className="flex items-center gap-1 mt-2 text-xs text-text-muted">
                            <ExternalLink size={12} />
                            <span>Open in new tab</span>
                        </div>
                    </div>
                </div>
            </ClayCard>
        </a>
    );
}

export default FeedCard;
