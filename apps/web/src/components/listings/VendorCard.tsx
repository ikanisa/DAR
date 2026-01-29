/**
 * VendorCard Component
 * 
 * Displays a vendor with logo, name, verification status, and stats.
 */

import { UserCheck, Star, MessageCircle, ExternalLink } from 'lucide-react';
import { ClayCard } from '../ui/ClayCard';
import { Vendor } from '../../lib/types';

interface VendorCardProps {
    vendor: Vendor;
    variant?: 'default' | 'compact' | 'inline';
    onClick?: (vendor: Vendor) => void;
}

export function VendorCard({
    vendor,
    variant = 'default',
    onClick
}: VendorCardProps) {
    // Format response time
    const formatResponseTime = (hours: number) => {
        if (hours < 1) return '< 1 hour';
        if (hours < 24) return `${Math.round(hours)} hours`;
        return `${Math.round(hours / 24)} days`;
    };

    // Inline variant for listing attribution
    if (variant === 'inline') {
        return (
            <button
                onClick={() => onClick?.(vendor)}
                className="inline-flex items-center gap-2 hover:text-clay-action transition-colors"
            >
                {/* Avatar */}
                <div className="w-6 h-6 rounded-full bg-clay-card border border-white/10 overflow-hidden flex-shrink-0">
                    {vendor.logo_url ? (
                        <img src={vendor.logo_url} alt={vendor.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-clay-action/50 to-purple-500/50 flex items-center justify-center text-xs font-bold text-white">
                            {vendor.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <span className="text-sm font-medium">{vendor.name}</span>

                {vendor.verified && (
                    <UserCheck size={14} className="text-green-400" />
                )}
            </button>
        );
    }

    // Compact variant for lists
    if (variant === 'compact') {
        return (
            <button
                onClick={() => onClick?.(vendor)}
                className="w-full flex items-center gap-3 p-3 bg-clay-card border border-white/10 rounded-xl hover:border-clay-action/50 transition-all duration-200"
            >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-clay-action/50 to-purple-500/50 overflow-hidden flex-shrink-0">
                    {vendor.logo_url ? (
                        <img src={vendor.logo_url} alt={vendor.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white">
                            {vendor.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{vendor.name}</span>
                        {vendor.verified && (
                            <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <UserCheck size={10} /> ✓
                            </span>
                        )}
                    </div>
                    {vendor.category && (
                        <p className="text-xs text-text-muted">{vendor.category}</p>
                    )}
                </div>

                {/* Response rate */}
                <div className="text-right">
                    <p className="text-sm font-medium text-clay-action">{vendor.response_rate}%</p>
                    <p className="text-xs text-text-muted">response</p>
                </div>
            </button>
        );
    }

    // Default full card variant
    return (
        <ClayCard
            className="cursor-pointer hover:border-clay-action/50 transition-all duration-200"
            onClick={() => onClick?.(vendor)}
        >
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
                {/* Logo */}
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-clay-action/50 to-purple-500/50 overflow-hidden flex-shrink-0">
                    {vendor.logo_url ? (
                        <img src={vendor.logo_url} alt={vendor.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">
                            {vendor.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Name and category */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-text-primary">{vendor.name}</h3>
                        {vendor.verified && (
                            <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <UserCheck size={12} /> VERIFIED
                            </span>
                        )}
                    </div>
                    {vendor.category && (
                        <p className="text-sm text-text-muted">{vendor.category}</p>
                    )}
                    {vendor.location && (
                        <p className="text-sm text-text-muted">{vendor.location}</p>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 py-3 border-t border-white/10">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-clay-action mb-1">
                        <MessageCircle size={14} />
                        <span className="font-bold">{vendor.response_rate}%</span>
                    </div>
                    <p className="text-xs text-text-muted">Response Rate</p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-clay-action mb-1">
                        <Star size={14} />
                        <span className="font-bold">{formatResponseTime(vendor.avg_response_time)}</span>
                    </div>
                    <p className="text-xs text-text-muted">Avg Response</p>
                </div>
            </div>

            {/* Description */}
            {vendor.description && (
                <p className="text-sm text-text-secondary mt-3 line-clamp-2">
                    {vendor.description}
                </p>
            )}

            {/* Links */}
            {vendor.website && (
                <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-sm text-clay-action hover:underline mt-3"
                >
                    <ExternalLink size={12} /> Visit website
                </a>
            )}
        </ClayCard>
    );
}

export default VendorCard;
