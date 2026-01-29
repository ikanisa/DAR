/**
 * NotificationsView
 * 
 * Displays user notifications with unread count and mark-all-read action.
 * Also shows external feed items in a horizontal scroll section.
 */

import { useState, useEffect } from 'react';
import { ClayButton } from '@dar/ui';
import { NotificationCard } from '../components/notifications/NotificationCard';
import { FeedCard } from '../components/feed/FeedCard';
import {
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    fetchExternalFeedItems
} from '../lib/moltbotActions';
import { WebNotification, ExternalFeedItem } from '@dar/core';
import { useSession } from '../lib/SessionContext';
import { Bell, Check, Loader2, ExternalLink } from 'lucide-react';

export function NotificationsView() {
    const { sessionId } = useSession();
    const [notifications, setNotifications] = useState<WebNotification[]>([]);
    const [feedItems, setFeedItems] = useState<ExternalFeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);

    // Fetch data on mount
    useEffect(() => {
        async function loadData() {
            if (!sessionId) return;

            setLoading(true);
            try {
                const [notificationsData, feedData] = await Promise.all([
                    fetchNotifications(sessionId, { limit: 50 }),
                    fetchExternalFeedItems({ limit: 10 }),
                ]);
                setNotifications(notificationsData as WebNotification[]);
                setFeedItems(feedData as ExternalFeedItem[]);
            } catch (e) {
                console.error('Failed to load notifications:', e);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [sessionId]);

    // Handle mark single as read
    const handleMarkRead = async (id: string) => {
        if (!sessionId) return;

        const success = await markNotificationRead(id, sessionId);
        if (success) {
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
        }
    };

    // Handle dismiss (mark as read + remove from view)
    const handleDismiss = async (id: string) => {
        if (!sessionId) return;

        await markNotificationRead(id, sessionId);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Handle mark all as read
    const handleMarkAllRead = async () => {
        if (!sessionId) return;

        setMarkingAll(true);
        const success = await markAllNotificationsRead(sessionId);
        if (success) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
        setMarkingAll(false);
    };

    // Handle notification click (navigate to link if available)
    const handleNotificationClick = (notification: WebNotification) => {
        if (notification.link) {
            // For now, just log - could navigate or open modal
            console.log('Navigate to:', notification.link);
        }
    };

    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" />
            </div>
        );
    }

    return (
        <div className="pb-24 pt-4 space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-display font-bold">Notifications</h2>
                    {unreadCount > 0 && (
                        <span className="bg-clay-action text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <ClayButton
                        size="sm"
                        variant="ghost"
                        onClick={handleMarkAllRead}
                        disabled={markingAll}
                    >
                        {markingAll ? (
                            <Loader2 size={14} className="animate-spin mr-1" />
                        ) : (
                            <Check size={14} className="mr-1" />
                        )}
                        Mark all read
                    </ClayButton>
                )}
            </div>

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <div className="text-center py-16 bg-clay-card border border-white/10 rounded-2xl">
                    <Bell size={48} className="text-text-muted mx-auto mb-4" />
                    <p className="text-text-muted">No notifications yet</p>
                    <p className="text-sm text-text-muted mt-1">
                        You'll see updates about your listings and matches here
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notification) => (
                        <NotificationCard
                            key={notification.id}
                            notification={notification}
                            onRead={handleMarkRead}
                            onDismiss={handleDismiss}
                            onClick={handleNotificationClick}
                        />
                    ))}
                </div>
            )}

            {/* External Feed Section */}
            {feedItems.length > 0 && (
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <ExternalLink size={18} className="text-clay-action" />
                            From Around the Web
                        </h3>
                    </div>
                    <div className="overflow-x-auto -mx-4 px-4 pb-2">
                        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
                            {feedItems.map((item) => (
                                <FeedCard
                                    key={item.id}
                                    item={item}
                                    variant="compact"
                                />
                            ))}
                        </div>
                    </div>
                    <p className="text-xs text-text-muted mt-3 text-center">
                        External links open in new tabs. Listings not hosted on this platform.
                    </p>
                </section>
            )}
        </div>
    );
}
