/**
 * GlassToast Component
 * 
 * Toast notification with glass styling.
 * Supports success/error/info/warning variants.
 * Auto-dismiss with configurable duration.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    toast: (type: ToastType, message: string, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Toast config per type
const toastConfig: Record<ToastType, {
    icon: React.ReactNode;
    className: string;
}> = {
    success: {
        icon: <Check size={18} />,
        className: 'bg-status-ready/20 border-status-ready/30 text-status-ready',
    },
    error: {
        icon: <X size={18} />,
        className: 'bg-red-500/20 border-red-500/30 text-red-400',
    },
    warning: {
        icon: <AlertTriangle size={18} />,
        className: 'bg-status-pending/20 border-status-pending/30 text-status-pending',
    },
    info: {
        icon: <Info size={18} />,
        className: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    },
};

// Individual toast component
function ToastItem({
    toast,
    onDismiss,
}: {
    toast: Toast;
    onDismiss: (id: string) => void;
}) {
    const shouldReduceMotion = useReducedMotion();
    const config = toastConfig[toast.type];

    // Auto-dismiss
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, toast.duration || 4000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    return (
        <motion.div
            layout
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 300 }}
            className={clsx(
                'flex items-center gap-3 px-4 py-3',
                'rounded-2xl border backdrop-blur-xl',
                'shadow-lg',
                config.className
            )}
            role="alert"
            aria-live="polite"
        >
            <span className="flex-shrink-0" aria-hidden="true">
                {config.icon}
            </span>
            <p className="text-sm font-medium text-text-primary flex-1">
                {toast.message}
            </p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
            >
                <X size={14} />
            </button>
        </motion.div>
    );
}

// Toast container
function ToastContainer({
    toasts,
    onDismiss,
}: {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}) {
    return (
        <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4"
            aria-label="Notifications"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onDismiss={onDismiss}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}

// Provider component
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]); // Max 5 toasts
    }, []);

    const contextValue: ToastContextValue = {
        toast: addToast,
        success: (message, duration) => addToast('success', message, duration),
        error: (message, duration) => addToast('error', message, duration),
        warning: (message, duration) => addToast('warning', message, duration),
        info: (message, duration) => addToast('info', message, duration),
    };

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </ToastContext.Provider>
    );
}

// Hook to use toast
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export default ToastProvider;
