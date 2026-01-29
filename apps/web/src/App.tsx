import { useState, Suspense, lazy } from 'react';
import { SessionProvider, useSession, FeatureGate } from './lib/SessionContext';
import { GlassNavBar, TabId } from './components/ui/GlassNavBar';
import { ClayCard } from './components/ui/ClayCard';
import { ClayButton } from './components/ui/ClayButton';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { MapPin, Loader2 } from 'lucide-react';

// Lazy load page components for code-splitting
const ChatView = lazy(() => import('./pages/ChatView').then(m => ({ default: m.ChatView })));
const VendorsTab = lazy(() => import('./pages/VendorsTab').then(m => ({ default: m.VendorsTab })));
const ListingsTab = lazy(() => import('./pages/ListingsTab').then(m => ({ default: m.ListingsTab })));
const DiscoverView = lazy(() => import('./pages/DiscoverView').then(m => ({ default: m.DiscoverView })));
const ProfileView = lazy(() => import('./pages/ProfileView').then(m => ({ default: m.ProfileView })));
const SettingsView = lazy(() => import('./pages/SettingsView').then(m => ({ default: m.SettingsView })));
const MyListingsView = lazy(() => import('./pages/MyListingsView').then(m => ({ default: m.MyListingsView })));
const RequestsTab = lazy(() => import('./pages/RequestsTab').then(m => ({ default: m.RequestsTab })));
const NotificationsTab = lazy(() => import('./pages/NotificationsTab').then(m => ({ default: m.NotificationsTab })));
const FeedTab = lazy(() => import('./pages/FeedTab').then(m => ({ default: m.FeedTab })));

// Loading fallback for lazy components
function PageLoader() {
    return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-clay-action" />
        </div>
    );
}

function AppContent() {
    const { sessionId, isLoading, error } = useSession();
    const [activeTab, setActiveTab] = useState<TabId>('chat');

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center" role="status" aria-live="polite">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-clay-action mx-auto mb-4" aria-hidden="true" />
                    <p className="text-text-muted">Loading...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center p-4" role="alert">
                <ClayCard className="text-center max-w-sm">
                    <h2 className="text-xl font-bold mb-2 text-clay-action">Error</h2>
                    <p className="text-text-muted">{error}</p>
                    <ClayButton
                        onClick={() => window.location.reload()}
                        className="mt-4"
                    >
                        Retry
                    </ClayButton>
                </ClayCard>
            </div>
        );
    }

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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black border-2 border-white/20" aria-label="User profile">
                        ME
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main id="main-content" className="container mx-auto px-4">
                <Suspense fallback={<PageLoader />}>
                    {activeTab === 'chat' && <ChatView sessionId={sessionId} />}
                    {activeTab === 'vendors' && <VendorsTab />}
                    {activeTab === 'listings' && <ListingsTab />}
                    {activeTab === 'discover' && <DiscoverView />}
                    {activeTab === 'profile' && (
                        <ProfileView onNavigate={(tab) => setActiveTab(tab as TabId)} />
                    )}
                    {activeTab === 'settings' && (
                        <SettingsView onBack={() => setActiveTab('profile')} />
                    )}
                    {activeTab === 'notifications' && <NotificationsTab />}
                    {activeTab === 'my-listings' && <MyListingsView />}

                    {/* Requests and match suggestions */}
                    {activeTab === 'requests' && <RequestsTab />}

                    {/* External feeds (flag-gated) */}
                    {activeTab === 'feed' && <FeedTab />}
                </Suspense>
            </main>

            <InstallPrompt />

            <GlassNavBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
    );
}

function App() {
    return (
        <SessionProvider>
            <AppContent />
        </SessionProvider>
    );
}

export default App;


