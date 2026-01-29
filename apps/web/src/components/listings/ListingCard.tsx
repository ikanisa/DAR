/**
 * ListingCard Component
 * 
 * Displays a single listing with image, price, location, verified badge.
 * Uses the ProductListing type from our schema.
 */

import { MapPin, UserCheck, Heart } from 'lucide-react';
import { ClayCard } from '@dar/ui';
import { ProductListing } from '@dar/core';

interface ListingCardProps {
    listing: ProductListing;
    variant?: 'default' | 'compact' | 'featured';
    onFavorite?: (id: string) => void;
    onClick?: (listing: ProductListing) => void;
}

export function ListingCard({
    listing,
    variant = 'default',
    onFavorite,
    onClick
}: ListingCardProps) {
    const isVerified = listing.is_verified_vendor || listing.verified;
    const imageUrl = listing.images?.[0] || null;
    const displayPrice = listing.price
        ? `${listing.currency || '€'}${listing.price.toLocaleString()}`
        : 'Price on request';

    // Compact variant for grids
    if (variant === 'compact') {
        return (
            <button
                onClick={() => onClick?.(listing)}
                className="w-full text-left bg-clay-card border border-white/10 rounded-xl overflow-hidden hover:border-clay-action/50 transition-all duration-200 active:scale-[0.98]"
            >
                {/* Thumbnail */}
                <div className="aspect-square bg-gradient-to-br from-clay-action/20 to-purple-500/20 relative">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <span className="text-4xl">
                                {listing.listing_type === 'service' ? '🛠️' : '📦'}
                            </span>
                        </div>
                    )}

                    {/* Verified badge */}
                    {isVerified && (
                        <span className="absolute top-2 right-2 bg-green-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <UserCheck size={10} /> ✓
                        </span>
                    )}
                </div>

                {/* Info */}
                <div className="p-3">
                    <p className="font-medium text-sm text-text-primary line-clamp-2">{listing.title}</p>
                    <p className="text-clay-action font-bold mt-1">{displayPrice}</p>
                    {listing.location && (
                        <p className="text-xs text-text-muted flex items-center gap-1 mt-1">
                            <MapPin size={10} /> {listing.location}
                        </p>
                    )}
                </div>
            </button>
        );
    }

    // Featured variant for hero cards
    if (variant === 'featured') {
        return (
            <ClayCard
                className="relative group cursor-pointer !p-0 aspect-[16/9] overflow-hidden"
                onClick={() => onClick?.(listing)}
            >
                {/* Background image */}
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={listing.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-clay-action/30 to-purple-600/30" />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl font-bold text-white">{displayPrice}</span>
                                {isVerified && (
                                    <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm border border-green-500/30 flex items-center gap-1">
                                        <UserCheck size={12} /> VERIFIED
                                    </span>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-white leading-tight">{listing.title}</h3>
                            {listing.location && (
                                <p className="text-sm text-gray-300 flex items-center gap-1 mt-2">
                                    <MapPin size={14} /> {listing.location}
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            {onFavorite && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onFavorite(listing.id); }}
                                    className="p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-red-500/50 transition-colors"
                                >
                                    <Heart size={18} className="text-white" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </ClayCard>
        );
    }

    // Default variant
    return (
        <ClayCard
            className="relative group cursor-pointer !p-0 aspect-[4/3] overflow-hidden"
            onClick={() => onClick?.(listing)}
        >
            {/* Background image */}
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={listing.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-clay-action/20 to-purple-600/20 flex items-center justify-center">
                    <span className="text-5xl">
                        {listing.listing_type === 'service' ? '🛠️' : '📦'}
                    </span>
                </div>
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-white">{displayPrice}</span>
                            {isVerified && (
                                <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border border-green-500/30 flex items-center gap-1">
                                    <UserCheck size={10} /> ✓
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-white leading-tight">{listing.title}</h3>
                        {listing.location && (
                            <p className="text-sm text-gray-300 flex items-center gap-1 mt-1">
                                <MapPin size={12} /> {listing.location}
                            </p>
                        )}
                    </div>

                    {onFavorite && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onFavorite(listing.id); }}
                            className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-red-500/50 transition-colors"
                        >
                            <Heart size={16} className="text-white" />
                        </button>
                    )}
                </div>
            </div>
        </ClayCard>
    );
}

export default ListingCard;
