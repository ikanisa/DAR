/**
 * GlassModal Component
 * 
 * Center-positioned modal with glass styling.
 * Includes focus trap and ESC key to close.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface GlassModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
    showCloseButton?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function GlassModal({
    isOpen,
    onClose,
    title,
    children,
    className,
    showCloseButton = true,
    size = 'md',
}: GlassModalProps) {
    const shouldReduceMotion = useReducedMotion();
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    // Size classes
    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
    };

    // Close on escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    // Focus trap
    useEffect(() => {
        if (isOpen) {
            // Store current focus
            previousActiveElement.current = document.activeElement as HTMLElement;

            // Focus the modal
            modalRef.current?.focus();

            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';

            // Restore focus on close
            if (previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        };
    }, [isOpen, handleKeyDown]);

    // Animation variants
    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    const modalVariants = {
        hidden: {
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.95,
            transition: { duration: shouldReduceMotion ? 0 : 0.15 }
        },
        visible: {
            opacity: 1,
            scale: 1,
            transition: shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 25, stiffness: 300 }
        },
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                        variants={backdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            ref={modalRef}
                            className={clsx(
                                'w-full relative',
                                sizeClasses[size],
                                'rounded-3xl',
                                'glass-panel',
                                'focus:outline-none',
                                className
                            )}
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={title ? 'modal-title' : undefined}
                            tabIndex={-1}
                        >
                            {/* Header */}
                            {(title || showCloseButton) && (
                                <div className="flex items-center justify-between p-6 border-b border-white/10">
                                    {title && (
                                        <h2
                                            id="modal-title"
                                            className="text-lg font-bold text-text-primary"
                                        >
                                            {title}
                                        </h2>
                                    )}
                                    {showCloseButton && (
                                        <button
                                            onClick={onClose}
                                            className={clsx(
                                                'p-2 rounded-full',
                                                'text-text-muted hover:text-text-primary',
                                                'hover:bg-white/5',
                                                'transition-colors duration-fast',
                                                'focus:outline-none focus-visible:shadow-focus-ring',
                                                'touch-target'
                                            )}
                                            aria-label="Close modal"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Content */}
                            <div className="p-6">
                                {children}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

export default GlassModal;
