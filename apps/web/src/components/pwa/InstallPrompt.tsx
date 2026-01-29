/**
 * InstallPrompt Component
 * 
 * Prompts user to install the PWA after meaningful engagement.
 * Shows after order placed, 2+ items added, or ~45s browsing.
 */

import { useState, useEffect } from 'react';
import { ClayCard } from '@dar/ui';
import { ClayButton } from '@dar/ui';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'dar_pwa_install_dismissed';
const MIN_ENGAGEMENT_TIME = 45000; // 45 seconds

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [dismissed, setDismissed] = useState(() => {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    });

    useEffect(() => {
        // Skip if already dismissed or already installed
        if (dismissed) return;
        if (window.matchMedia('(display-mode: standalone)').matches) return;

        // Listen for install prompt
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // Show after engagement delay
        const engagementTimer = setTimeout(() => {
            if (deferredPrompt || !dismissed) {
                setShowPrompt(true);
            }
        }, MIN_ENGAGEMENT_TIME);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            clearTimeout(engagementTimer);
        };
    }, [dismissed, deferredPrompt]);

    const handleInstall = async () => {
        if (!deferredPrompt) {
            // Fallback for iOS - show instructions
            setShowPrompt(false);
            alert('To install: tap the Share button in Safari, then "Add to Home Screen"');
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }

        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        setDismissed(true);
        localStorage.setItem(STORAGE_KEY, 'true');
    };

    if (!showPrompt || dismissed) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-slide-up">
            <ClayCard className="!bg-gradient-to-r !from-clay-action/40 !to-purple-500/40 backdrop-blur-xl">
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                    <X size={16} className="text-text-muted" />
                </button>

                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Smartphone size={24} className="text-white" />
                    </div>

                    <div className="flex-1">
                        <h3 className="font-bold text-white">Install Dar</h3>
                        <p className="text-sm text-text-secondary mt-1">
                            Get quick access from your home screen
                        </p>

                        <ClayButton
                            onClick={handleInstall}
                            size="sm"
                            className="mt-3"
                        >
                            <Download size={16} className="mr-2" />
                            Install App
                        </ClayButton>
                    </div>
                </div>
            </ClayCard>
        </div>
    );
}

/**
 * Trigger install prompt after specific actions (for use in other components)
 */
export function triggerInstallPrompt() {
    // Remove dismissed flag to allow prompt again
    localStorage.removeItem(STORAGE_KEY);

    // Dispatch custom event for the InstallPrompt component
    window.dispatchEvent(new CustomEvent('dar:trigger-install'));
}

export default InstallPrompt;
