/**
 * GlassBottomSheet Component
 * 
 * Slide-up sheet with glass styling and spring physics.
 * Respects reduce-motion preference.
 */

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';

interface GlassBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export function GlassBottomSheet({
    isOpen,
    onClose,
    title,
    children,
    className
}: GlassBottomSheetProps) {
    const shouldReduceMotion = useReducedMotion();

    // Close on escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Prevent body scroll when sheet is open
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    // Animation variants
    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    const sheetVariants = {
        hidden: {
            y: '100%',
            transition: shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 30, stiffness: 300 }
        },
        visible: {
            y: 0,
            transition: shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 30, stiffness: 300 }
        },
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/60 z-50"
                        variants={backdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {/* Sheet */}
                    <motion.div
                        className={clsx(
                            'fixed bottom-0 left-0 right-0 z-50',
                            'max-h-[85vh] overflow-hidden',
                            'rounded-t-3xl',
                            'glass-panel',
                            className
                        )}
                        variants={sheetVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? 'sheet-title' : undefined}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 bg-white/20 rounded-full" />
                        </div>

                        {/* Title */}
                        {title && (
                            <div className="px-6 pb-4 border-b border-white/10">
                                <h2
                                    id="sheet-title"
                                    className="text-lg font-bold text-text-primary"
                                >
                                    {title}
                                </h2>
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar max-h-[70vh]">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default GlassBottomSheet;
