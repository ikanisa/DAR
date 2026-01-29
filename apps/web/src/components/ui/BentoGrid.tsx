/**
 * BentoGrid Component
 * 
 * Responsive grid layout for marketplace content.
 * Uses design tokens for gap and min-card-height.
 */

import React from 'react';
import clsx from 'clsx';

interface BentoGridProps {
    children: React.ReactNode;
    columns?: 1 | 2 | 3 | 4;
    className?: string;
}

export function BentoGrid({ children, columns = 2, className }: BentoGridProps) {
    const columnClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    };

    return (
        <div
            className={clsx(
                'grid',
                'gap-bento-gap',  // Uses design token: 14px
                columnClasses[columns],
                className
            )}
        >
            {children}
        </div>
    );
}

interface BentoItemProps {
    children: React.ReactNode;
    span?: 1 | 2;
    className?: string;
}

export function BentoItem({ children, span = 1, className }: BentoItemProps) {
    return (
        <div
            className={clsx(
                'min-h-card',  // Uses design token: 120px
                span === 2 && 'sm:col-span-2',
                className
            )}
        >
            {children}
        </div>
    );
}

export default BentoGrid;
