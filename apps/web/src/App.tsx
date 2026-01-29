import { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SessionProvider, useSession } from './lib/SessionContext';
import { RootLayout } from './components/RootLayout';
import { ClayCard } from '@dar/ui';
import { ClayButton } from '@dar/ui';

// Lazy load page components
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
const AdminRiskView = lazy(() => import('./pages/AdminRiskView').then(m => ({ default: m.AdminRiskView })));
const ViewingsTab = lazy(() => import('./pages/ViewingsTab').then(m => ({ default: m.ViewingsTab })));
const NotFoundView = lazy(() => import('./pages/NotFoundView').then(m => ({ default: m.NotFoundView })));

function PageLoader() {
    return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-clay-action" />
        </div>
    );
}

function ErrorBoundary() {
    return (
        <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
            <ClayCard className="text-center max-w-sm">
                <h2 className="text-xl font-bold mb-2 text-clay-action">Something went wrong</h2>
                <ClayButton onClick={() => window.location.reload()} className="mt-4">
                    Reload App
                </ClayButton>
            </ClayCard>
        </div>
    );
}

// Global session loader
function SessionLoader({ children }: { children: React.ReactNode }) {
    const { isLoading, error } = useSession();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-clay-action mx-auto mb-4" />
                    <p className="text-text-muted">Loading...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
                <ClayCard className="text-center max-w-sm">
                    <h2 className="text-xl font-bold mb-2 text-clay-action">Error</h2>
                    <p className="text-text-muted">{error}</p>
                    <ClayButton onClick={() => window.location.reload()} className="mt-4">
                        Retry
                    </ClayButton>
                </ClayCard>
            </div>
        );
    }

    return <>{children}</>;
}

const router = createBrowserRouter([
    {
        path: '/',
        element: (
            <SessionLoader>
                <RootLayout />
            </SessionLoader>
        ),
        errorElement: <ErrorBoundary />,
        children: [
            { index: true, element: <Navigate to="/chat" replace /> },
            {
                path: 'chat',
                element: <Suspense fallback={<PageLoader />}><ChatView /></Suspense>
            },
            {
                path: 'vendors',
                element: <Suspense fallback={<PageLoader />}><VendorsTab /></Suspense>
            },
            {
                path: 'listings',
                element: <Suspense fallback={<PageLoader />}><ListingsTab /></Suspense>
            },
            {
                path: 'discover',
                element: <Suspense fallback={<PageLoader />}><DiscoverView /></Suspense>
            },
            {
                path: 'profile',
                element: <Suspense fallback={<PageLoader />}><ProfileView /></Suspense>
            },
            {
                path: 'settings',
                element: <Suspense fallback={<PageLoader />}><SettingsView /></Suspense>
            },
            {
                path: 'my-listings',
                element: <Suspense fallback={<PageLoader />}><MyListingsView /></Suspense>
            },
            {
                path: 'notifications',
                element: <Suspense fallback={<PageLoader />}><NotificationsTab /></Suspense>
            },
            {
                path: 'requests',
                element: <Suspense fallback={<PageLoader />}><RequestsTab /></Suspense>
            },
            {
                path: 'viewings',
                element: <Suspense fallback={<PageLoader />}><ViewingsTab /></Suspense>
            },
            {
                path: 'feed',
                element: <Suspense fallback={<PageLoader />}><FeedTab /></Suspense>
            },
            {
                path: 'admin',
                element: <Suspense fallback={<PageLoader />}><AdminRiskView /></Suspense>
            },
            {
                path: '*',
                element: <Suspense fallback={<PageLoader />}><NotFoundView /></Suspense>
            },
        ]
    }
]);

function App() {
    return (
        <SessionProvider>
            <RouterProvider router={router} />
        </SessionProvider>
    );
}

export default App;


