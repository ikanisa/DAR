/**
 * ClayPill Component
 * 
 * Quick reply chip with clay styling.
 * Touch target ≥ 44px for accessibility.
 */

import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface ClayPillProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
    active?: boolean;
    size?: 'sm' | 'md';
}

export function ClayPill({
    children,
    className,
    active = false,
    size = 'md',
    disabled,
    ...props
}: ClayPillProps) {
    const sizes = {
        sm: 'px-3 py-1.5 text-xs min-h-[36px]',
        md: 'px-4 py-2 text-sm min-h-[44px]',  // 44px for touch target
    };

    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            className={clsx(
                // Base styles
                'inline-flex items-center justify-center',
                'rounded-full font-medium',
                'border transition-all duration-normal ease-smooth',
                'touch-target',  // Ensures 44px minimum
                // Size variant
                sizes[size],
                // Active state
                active ? [
                    'bg-clay-action/20',
                    'border-clay-action/50',
                    'text-clay-action',
                ] : [
                    'bg-white/5',
                    'border-white/10',
                    'text-text-muted',
                    'hover:bg-clay-action/10',
                    'hover:border-clay-action/30',
                    'hover:text-text-primary',
                ],
                // Disabled state
                disabled && 'opacity-50 cursor-not-allowed',
                // Focus state
                'focus:outline-none focus-visible:shadow-focus-ring',
                className
            )}
            disabled={disabled}
            {...props}
        >
            {children}
        </motion.button>
    );
}

export default ClayPill;
