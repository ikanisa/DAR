import { NavLink } from 'react-router-dom';
import { Home, MessageCircle, Bell, User, Compass } from 'lucide-react';
import clsx from 'clsx';

export function GlassNavBar() {
    const tabs = [
        { path: '/discover', icon: <Compass size={20} aria-hidden="true" />, label: 'Discover' },
        { path: '/listings', icon: <Home size={20} aria-hidden="true" />, label: 'Listings' },
        { path: '/chat', icon: <MessageCircle size={24} aria-hidden="true" />, label: 'Chat' },
        { path: '/notifications', icon: <Bell size={20} aria-hidden="true" />, label: 'Alerts' },
        { path: '/profile', icon: <User size={20} aria-hidden="true" />, label: 'Profile' },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 p-4 z-50 pointer-events-none flex justify-center"
            aria-label="Main navigation"
            role="navigation"
        >
            <div className="glass-panel rounded-full px-2 py-2 flex items-center gap-1 pointer-events-auto" role="tablist">
                {tabs.map((tab) => (
                    <NavLink
                        key={tab.path}
                        to={tab.path}
                        role="tab"
                        aria-label={tab.label}
                        className={({ isActive }) => clsx(
                            'relative flex flex-col items-center justify-center rounded-full transition-all duration-300',
                            'min-w-[56px] min-h-[44px] p-3', // Ensures 44px touch target
                            'focus:outline-none focus-visible:shadow-focus-ring',
                            isActive ? 'text-clay-action' : 'text-text-muted hover:text-text-main'
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <span className="absolute inset-0 bg-white/5 rounded-full blur-md" aria-hidden="true" />
                                )}
                                <div className={clsx('relative z-10 transition-transform', isActive && 'scale-110')}>
                                    {tab.icon}
                                </div>
                                <span className="sr-only">{tab.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
