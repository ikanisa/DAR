/**
 * NotificationCard Component
 * 
 * Displays a single notification with type indicator, read status, and link action.
 */

import { Bell, MessageCircle, Package, Star, AlertCircle, CheckCircle, X } from 'lucide-react';
import { WebNotification } from '@dar/core';

interface NotificationCardProps {
    notification: WebNotification;
    onRead?: (id: string) => void;
    onDismiss?: (id: string) => void;
    onClick?: (notification: WebNotification) => void;
}

// Icon based on notification type
function getNotificationIcon(type: string) {
    switch (type) {
        case 'match':
            return <Star size={18} className="text-yellow-400" />;
        case 'inquiry':
            return <MessageCircle size={18} className="text-blue-400" />;
        case 'listing':
            return <Package size={18} className="text-green-400" />;
        case 'alert':
            return <AlertCircle size={18} className="text-red-400" />;
        case 'success':
            return <CheckCircle size={18} className="text-green-400" />;
        default:
            return <Bell size={18} className="text-clay-action" />;
    }
}

// Time ago formatter
function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

export function NotificationCard({
    notification,
    onRead,
    onDismiss,
    onClick,
}: NotificationCardProps) {
    const isUnread = !notification.read;

    const handleClick = () => {
        if (!notification.read && onRead) {
            onRead(notification.id);
        }
        onClick?.(notification);
    };

    return (
        <div
            onClick={handleClick}
            className={`
        relative flex items-start gap-3 p-4 rounded-xl cursor-pointer
        transition-all duration-200 
        ${isUnread
                    ? 'bg-clay-action/10 border border-clay-action/30'
                    : 'bg-clay-card border border-white/10 hover:border-white/20'
                }
      `}
        >
            {/* Unread dot */}
            {isUnread && (
                <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-clay-action" />
            )}

            {/* Icon */}
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                {getNotificationIcon(notification.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h4 className={`font-medium ${isUnread ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {notification.title}
                </h4>
                <p className="text-sm text-text-muted line-clamp-2 mt-0.5">
                    {notification.message}
                </p>
                <p className="text-xs text-text-muted mt-2">
                    {timeAgo(notification.created_at)}
                </p>
            </div>

            {/* Dismiss button */}
            {onDismiss && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(notification.id);
                    }}
                    className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                    <X size={16} className="text-text-muted" />
                </button>
            )}
        </div>
    );
}

export default NotificationCard;
