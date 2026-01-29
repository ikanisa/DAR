import React from 'react';
import clsx from 'clsx';
import { motion, useReducedMotion } from 'framer-motion';

interface ClayButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
    variant?: 'primary' | 'ghost' | 'icon';
    size?: 'sm' | 'md' | 'lg';
}

export function ClayButton({ children, className, variant = 'primary', size = 'md', ...props }: ClayButtonProps) {
    const shouldReduceMotion = useReducedMotion();

    const baseStyles = 'rounded-full font-bold transition-all flex items-center justify-center gap-2 relative overflow-hidden focus:outline-none focus-visible:shadow-focus-ring touch-target';

    const variants = {
        primary: 'bg-clay-action text-midnight shadow-clay hover:brightness-110 active:brightness-90',
        ghost: 'bg-transparent text-text-muted hover:bg-white/5',
        icon: 'p-3 rounded-full bg-clay-card shadow-clay text-text-main hover:text-clay-action'
    };

    const sizes = {
        sm: 'px-4 py-2 text-sm min-h-[44px]',
        md: 'px-6 py-3 text-base min-h-[44px]',
        lg: 'px-8 py-4 text-lg min-h-[48px]'
    };

    const sizeClass = variant === 'icon' ? 'min-w-[44px] min-h-[44px]' : sizes[size];

    return (
        <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            className={clsx(baseStyles, variants[variant], sizeClass, className)}
            {...props}
        >
            {children}
        </motion.button>
    );
}

