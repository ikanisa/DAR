/**
 * NotificationsTab Component
 * 
 * Displays user notifications (match alerts, inquiries).
 * Uses existing fetchNotifications from moltbotActions.
 */

import { useState, useEffect } from 'react';
import { ClayCard } from '../components/ui/ClayCard';
import { ClayButton } from '../components/ui/ClayButton';
import { BentoGrid, BentoItem } from '../components/ui/BentoGrid';
import { useSession } from '../lib/SessionContext';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/moltbotActions';
import { Loader2, Bell, BellOff, Sparkles, MessageCircle, CheckCheck, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    read: boolean;
    created_at: string;
}

export function NotificationsTab() {
    const { sessionId } = useSession();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);

    useEffect(() => {
        if (sessionId) {
            loadNotifications();
        }
    }, [sessionId]);

    const loadNotifications = async () => {
        if (!sessionId) return;

        setLoading(true);
        try {
            const data = await fetchNotifications(sessionId, { limit: 50 });
            setNotifications(data as Notification[]);
        } catch (e) {
            console.error('Failed to load notifications:', e);
            // Demo data
            setNotifications([
                { id: '1', type: 'matches_found', title: 'Found 3 matches!', message: 'We found 3 listings matching your request for MacBook Pro', link: '/requests', read: false, created_at: new Date().toISOString() },
                { id: '2', type: 'match_alert', title: 'New match for your listing!', message: 'Someone is interested in your iPhone 14 Pro', link: '/listings/123', read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
                { id: '3', type: 'inquiry', title: 'New inquiry', message: 'A buyer is asking about your listing', link: '/listings/456', read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkRead = async (notificationId: string) => {
        if (!sessionId) return;

        const success = await markNotificationRead(notificationId, sessionId);
        if (success) {
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
        }
    };

    const handleMarkAllRead = async () => {
        if (!sessionId || markingAll) return;

        setMarkingAll(true);
        const success = await markAllNotificationsRead(sessionId);
        if (success) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
        setMarkingAll(false);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'matches_found':
            case 'match_alert':
                return <Sparkles size={18} className="text-clay-action" aria-hidden="true" />;
            case 'inquiry':
                return <MessageCircle size={18} className="text-purple-400" aria-hidden="true" />;
            default:
                return <Bell size={18} className="text-text-muted" aria-hidden="true" />;
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" aria-label="Loading notifications" />
            </div>
        );
    }

    // Empty state
    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <BellOff className="w-16 h-16 text-text-muted mb-4" aria-hidden="true" />
                <h2 className="text-xl font-bold mb-2">No Notifications</h2>
                <p className="text-text-muted max-w-sm">
                    You'll be notified when someone matches your requests or inquires about your listings.
                </p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">Notifications</h2>
                    {unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-clay-action text-white text-xs font-bold rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>

                {unreadCount > 0 && (
                    <ClayButton
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllRead}
                        disabled={markingAll}
                    >
                        {markingAll ? (
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <CheckCheck size={14} aria-hidden="true" />
                        )}
                        Mark all read
                    </ClayButton>
                )}
            </div>

            {/* Notifications list */}
            <BentoGrid columns={1}>
                {notifications.map((notification) => (
                    <BentoItem key={notification.id}>
                        <ClayCard
                            className={clsx(
                                'cursor-pointer transition-all',
                                !notification.read && 'border-l-4 border-l-clay-action'
                            )}
                            onClick={() => {
                                if (!notification.read) {
                                    handleMarkRead(notification.id);
                                }
                                if (notification.link) {
                                    // In a real app, navigate
                                    console.log('Navigate to:', notification.link);
                                }
                            }}
                        >
                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className={clsx(
                                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                    notification.read ? 'bg-white/5' : 'bg-clay-action/20'
                                )}>
                                    {getIcon(notification.type)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className={clsx(
                                            'font-bold truncate',
                                            notification.read && 'text-text-muted'
                                        )}>
                                            {notification.title}
                                        </h3>
                                        <span className="text-xs text-text-muted whitespace-nowrap">
                                            {formatTime(notification.created_at)}
                                        </span>
                                    </div>
                                    <p className={clsx(
                                        'text-sm mt-1 line-clamp-2',
                                        notification.read ? 'text-text-muted' : 'text-text-secondary'
                                    )}>
                                        {notification.message}
                                    </p>

                                    {notification.link && (
                                        <div className="flex items-center gap-1 text-xs text-clay-action mt-2">
                                            <ExternalLink size={12} aria-hidden="true" />
                                            View details
                                        </div>
                                    )}
                                </div>

                                {/* Unread indicator */}
                                {!notification.read && (
                                    <div className="w-2 h-2 rounded-full bg-clay-action flex-shrink-0" aria-label="Unread" />
                                )}
                            </div>
                        </ClayCard>
                    </BentoItem>
                ))}
            </BentoGrid>
        </div>
    );
}

export default NotificationsTab;
