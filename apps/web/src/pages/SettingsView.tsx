/**
 * SettingsView
 * 
 * App settings including preferences, notifications, and about.
 */

import { useState } from 'react';
import { ClayCard } from '../components/ui/ClayCard';
import { useSession } from '../lib/SessionContext';
import {
    ArrowLeft, Bell, Moon, Globe, Shield, HelpCircle,
    Info, ChevronRight, ToggleLeft, ToggleRight
} from 'lucide-react';

interface SettingsViewProps {
    onBack?: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
    const { sessionId, flags } = useSession();

    // Local settings state
    const [darkMode, setDarkMode] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [language] = useState('English');

    const appVersion = '1.0.0';

    return (
        <div className="pb-24 pt-4 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <h2 className="text-2xl font-display font-bold">Settings</h2>
            </div>

            {/* Preferences */}
            <section className="space-y-2">
                <h3 className="text-sm font-medium text-text-muted px-1">Preferences</h3>

                <SettingRow
                    icon={<Moon size={20} className="text-purple-400" />}
                    label="Dark Mode"
                    description="Always on in this version"
                    action={
                        <button onClick={() => setDarkMode(!darkMode)} disabled>
                            {darkMode ? (
                                <ToggleRight size={28} className="text-clay-action" />
                            ) : (
                                <ToggleLeft size={28} className="text-text-muted" />
                            )}
                        </button>
                    }
                />

                <SettingRow
                    icon={<Bell size={20} className="text-yellow-400" />}
                    label="Notifications"
                    description={notifications ? 'Enabled' : 'Disabled'}
                    action={
                        <button onClick={() => setNotifications(!notifications)}>
                            {notifications ? (
                                <ToggleRight size={28} className="text-clay-action" />
                            ) : (
                                <ToggleLeft size={28} className="text-text-muted" />
                            )}
                        </button>
                    }
                />

                <SettingRow
                    icon={<Globe size={20} className="text-blue-400" />}
                    label="Language"
                    description={language}
                    onClick={() => {/* Would open language picker */ }}
                />
            </section>

            {/* Privacy & Security */}
            <section className="space-y-2">
                <h3 className="text-sm font-medium text-text-muted px-1">Privacy & Security</h3>

                <SettingRow
                    icon={<Shield size={20} className="text-green-400" />}
                    label="Privacy Policy"
                    onClick={() => window.open('/privacy', '_blank')}
                />

                <SettingRow
                    icon={<Info size={20} className="text-text-muted" />}
                    label="Terms of Service"
                    onClick={() => window.open('/terms', '_blank')}
                />
            </section>

            {/* Support */}
            <section className="space-y-2">
                <h3 className="text-sm font-medium text-text-muted px-1">Support</h3>

                <SettingRow
                    icon={<HelpCircle size={20} className="text-clay-action" />}
                    label="Help & FAQ"
                    onClick={() => window.open('/help', '_blank')}
                />
            </section>

            {/* Feature Flags (dev only) */}
            {flags && Object.keys(flags).length > 0 && (
                <section className="space-y-2">
                    <h3 className="text-sm font-medium text-text-muted px-1">
                        Feature Flags (Dev)
                    </h3>
                    <ClayCard className="!p-3 text-xs font-mono">
                        <pre className="text-text-muted overflow-x-auto">
                            {JSON.stringify(flags, null, 2)}
                        </pre>
                    </ClayCard>
                </section>
            )}

            {/* About */}
            <ClayCard className="text-center">
                <p className="text-lg font-bold">Dar Marketplace</p>
                <p className="text-sm text-text-muted">Version {appVersion}</p>
                <p className="text-xs text-text-muted mt-2">
                    Session: {sessionId?.slice(0, 12)}...
                </p>
                <p className="text-xs text-text-muted mt-4">
                    © 2024 Dar. All rights reserved.
                </p>
            </ClayCard>
        </div>
    );
}

// Setting row component
interface SettingRowProps {
    icon: React.ReactNode;
    label: string;
    description?: string;
    action?: React.ReactNode;
    onClick?: () => void;
}

function SettingRow({ icon, label, description, action, onClick }: SettingRowProps) {
    const Wrapper = onClick ? 'button' : 'div';

    return (
        <Wrapper
            onClick={onClick}
            className={`
        w-full flex items-center gap-4 p-4 
        bg-clay-card border border-white/10 rounded-xl
        ${onClick ? 'hover:border-clay-action/50 transition-all cursor-pointer' : ''}
      `}
        >
            <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                {icon}
            </div>
            <div className="flex-1 text-left">
                <p className="font-medium">{label}</p>
                {description && <p className="text-xs text-text-muted">{description}</p>}
            </div>
            {action || (onClick && <ChevronRight size={18} className="text-text-muted" />)}
        </Wrapper>
    );
}
