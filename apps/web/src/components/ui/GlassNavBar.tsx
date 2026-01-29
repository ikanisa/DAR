import React from 'react';
import { Home, MessageCircle, Bell, User, Compass } from 'lucide-react';
import clsx from 'clsx';

export type TabId = 'discover' | 'listings' | 'chat' | 'notifications' | 'profile' | 'vendors' | 'requests' | 'settings' | 'my-listings' | 'feed';

interface GlassNavBarProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

export function GlassNavBar({ activeTab, onTabChange }: GlassNavBarProps) {
    const tabs: { id: TabId; icon: React.ReactNode; label: string }[] = [
        { id: 'discover', icon: <Compass size={20} aria-hidden="true" />, label: 'Discover' },
        { id: 'listings', icon: <Home size={20} aria-hidden="true" />, label: 'Listings' },
        { id: 'chat', icon: <MessageCircle size={24} aria-hidden="true" />, label: 'Chat' }, // Center/Main
        { id: 'notifications', icon: <Bell size={20} aria-hidden="true" />, label: 'Alerts' },
        { id: 'profile', icon: <User size={20} aria-hidden="true" />, label: 'Profile' },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 p-4 z-50 pointer-events-none flex justify-center"
            aria-label="Main navigation"
            role="navigation"
        >
            <div className="glass-panel rounded-full px-2 py-2 flex items-center gap-1 pointer-events-auto" role="tablist">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            role="tab"
                            aria-selected={isActive}
                            aria-label={tab.label}
                            className={clsx(
                                'relative flex flex-col items-center justify-center rounded-full transition-all duration-300',
                                'min-w-[56px] min-h-[44px] p-3', // Ensures 44px touch target
                                'focus:outline-none focus-visible:shadow-focus-ring',
                                isActive ? 'text-clay-action' : 'text-text-muted hover:text-text-main'
                            )}
                        >
                            {isActive && (
                                <span className="absolute inset-0 bg-white/5 rounded-full blur-md" aria-hidden="true" />
                            )}
                            <div className={clsx('relative z-10 transition-transform', isActive && 'scale-110')}>
                                {tab.icon}
                            </div>
                            {/* Screen reader only label */}
                            <span className="sr-only">{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
