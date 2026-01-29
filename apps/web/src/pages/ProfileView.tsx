/**
 * ProfileView
 * 
 * User profile page with stats, activity, and quick actions.
 */

import { useSession } from '../lib/SessionContext';
import { ClayCard } from '@dar/ui';
import { ClayButton } from '@dar/ui';
import {
    User, Package, Store, MessageCircle, Star,
    Settings, LogOut, Plus, ChevronRight, ShieldAlert, Calendar
} from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';

interface ProfileViewProps {
    onNavigate?: (tab: string) => void;
}

export function ProfileView({ onNavigate }: ProfileViewProps) {
    const { sessionId } = useSession();
    const { isAdmin } = useAdmin();

    // Quick stats (would be fetched from DB in production)
    const stats = {
        listings: 3,
        messages: 12,
        favorites: 5,
        reviews: 2,
    };

    const handleSettingsClick = () => {
        onNavigate?.('settings');
    };

    return (
        <div className="pb-24 pt-4 space-y-6">
            {/* Profile header */}
            <ClayCard className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-clay-action/40 to-purple-500/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User size={40} className="text-white" />
                </div>

                <h2 className="text-xl font-bold">Anonymous User</h2>
                <p className="text-sm text-text-muted mt-1">
                    Session: {sessionId?.slice(0, 8)}...
                </p>

                <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-white/10">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-clay-action">{stats.listings}</p>
                        <p className="text-xs text-text-muted">Listings</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold">{stats.favorites}</p>
                        <p className="text-xs text-text-muted">Saved</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold">{stats.reviews}</p>
                        <p className="text-xs text-text-muted">Reviews</p>
                    </div>
                </div>
            </ClayCard>

            {/* Admin Dashboard */}
            {isAdmin && (
                <button
                    onClick={() => onNavigate?.('admin')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-xl hover:border-red-400/50 transition-all"
                >
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <ShieldAlert size={20} className="text-red-400" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-bold text-red-200">Admin Dashboard</p>
                        <p className="text-xs text-red-200/70">Manage risks and approvals</p>
                    </div>
                    <ChevronRight size={18} className="text-red-400" />
                </button>
            )}

            {/* Quick actions */}
            <div className="space-y-2">
                <h3 className="text-sm font-medium text-text-muted px-1">Quick Actions</h3>

                <button
                    onClick={() => onNavigate?.('my-listings')}
                    className="w-full flex items-center gap-4 p-4 bg-clay-card border border-white/10 rounded-xl hover:border-clay-action/50 transition-all"
                >
                    <div className="w-10 h-10 bg-clay-action/20 rounded-lg flex items-center justify-center">
                        <Package size={20} className="text-clay-action" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-medium">My Listings</p>
                        <p className="text-xs text-text-muted">{stats.listings} active listings</p>
                    </div>
                    <ChevronRight size={18} className="text-text-muted" />
                </button>

                <button
                    onClick={() => onNavigate?.('create')}
                    className="w-full flex items-center gap-4 p-4 bg-clay-card border border-white/10 rounded-xl hover:border-clay-action/50 transition-all"
                >
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Plus size={20} className="text-green-400" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-medium">Create Listing</p>
                        <p className="text-xs text-text-muted">Sell a product or service</p>
                    </div>
                    <ChevronRight size={18} className="text-text-muted" />
                </button>

                <button
                    onClick={() => onNavigate?.('notifications')}
                    className="w-full flex items-center gap-4 p-4 bg-clay-card border border-white/10 rounded-xl hover:border-clay-action/50 transition-all"
                >
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <MessageCircle size={20} className="text-purple-400" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-medium">Messages</p>
                        <p className="text-xs text-text-muted">{stats.messages} conversations</p>
                    </div>
                    <ChevronRight size={18} className="text-text-muted" />
                </button>

                <button
                    onClick={() => onNavigate?.('favorites')}
                    className="w-full flex items-center gap-4 p-4 bg-clay-card border border-white/10 rounded-xl hover:border-clay-action/50 transition-all"
                >
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                        <Star size={20} className="text-yellow-400" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-medium">Saved Items</p>
                        <p className="text-xs text-text-muted">{stats.favorites} favorites</p>
                    </div>
                    <ChevronRight size={18} className="text-text-muted" />
                </button>

                <button
                    onClick={() => onNavigate?.('viewings')}
                    className="w-full flex items-center gap-4 p-4 bg-clay-card border border-white/10 rounded-xl hover:border-clay-action/50 transition-all"
                >
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Calendar size={20} className="text-cyan-400" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-medium">My Viewings</p>
                        <p className="text-xs text-text-muted">Manage scheduled visits</p>
                    </div>
                    <ChevronRight size={18} className="text-text-muted" />
                </button>
            </div>

            {/* Become a vendor */}
            <ClayCard variant="primary" className="!bg-gradient-to-br !from-clay-action/30 !to-purple-500/30">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Store size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold mb-1">Become a Vendor</h3>
                        <p className="text-sm text-text-secondary mb-3">
                            Get verified and reach more customers with a vendor profile.
                        </p>
                        <ClayButton size="sm">
                            Apply Now
                        </ClayButton>
                    </div>
                </div>
            </ClayCard>

            {/* Settings & logout */}
            <div className="space-y-2">
                <button
                    onClick={handleSettingsClick}
                    className="w-full flex items-center gap-4 p-4 bg-clay-card border border-white/10 rounded-xl hover:border-clay-action/50 transition-all"
                >
                    <Settings size={20} className="text-text-muted" />
                    <span className="flex-1 text-left font-medium">Settings</span>
                    <ChevronRight size={18} className="text-text-muted" />
                </button>

                <button
                    className="w-full flex items-center gap-4 p-4 bg-clay-card border border-white/10 rounded-xl hover:border-red-500/50 transition-all text-red-400"
                >
                    <LogOut size={20} />
                    <span className="flex-1 text-left font-medium">Clear Session</span>
                </button>
            </div>
        </div>
    );
}
