import { Outlet, NavLink } from 'react-router-dom';
import { GlassNavBar } from '@dar/ui';
import { MapPin } from 'lucide-react';
import { FeatureGate } from '../lib/SessionContext';
import { InstallPrompt } from './pwa/InstallPrompt';

export function RootLayout() {
    return (
        <div className="min-h-screen bg-midnight text-text-primary font-sans pb-24">
            {/* Skip link for keyboard accessibility */}
            <a href="#main-content" className="skip-link">
                Skip to main content
            </a>

            {/* Header */}
            <header className="sticky top-0 z-40 p-4 bg-glass-bg backdrop-blur-xl border-b border-glass-border rounded-b-3xl mb-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white" aria-hidden="true">D</div>
                    <h1 className="font-bold text-lg">Dar</h1>
                </div>
                <div className="flex items-center gap-2">
                    {/* Maps button - gated */}
                    <FeatureGate flag="WEB_MAPS_ENABLED">
                        <button
                            className="p-2 rounded-full bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:shadow-focus-ring"
                            aria-label="Open map"
                        >
                            <MapPin size={18} aria-hidden="true" />
                        </button>
                    </FeatureGate>
                    <NavLink
                        to="/profile"
                        className={({ isActive }) => `w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-clay-action ${isActive ? 'border-white' : 'border-white/20'}`}
                        aria-label="User profile"
                    >
                        ME
                    </NavLink>
                </div>
            </header>

            {/* Main Content Area */}
            <main id="main-content" className="container mx-auto px-4">
                <Outlet />
            </main>

            <InstallPrompt />

            <GlassNavBar />
        </div>
    );
}
