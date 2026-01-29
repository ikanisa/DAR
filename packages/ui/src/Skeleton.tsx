/**
 * Skeleton Component
 * 
 * Pulsating loading placeholder for native-like feel.
 * Respects reduce-motion preference.
 */

import clsx from 'clsx';

interface SkeletonProps {
    variant?: 'text' | 'card' | 'circle' | 'rectangle';
    width?: string | number;
    height?: string | number;
    className?: string;
    lines?: number; // For text variant - number of lines
}

export function Skeleton({
    variant = 'rectangle',
    width,
    height,
    className,
    lines = 1,
}: SkeletonProps) {
    const baseStyles = 'bg-white/5 animate-pulse rounded';

    // Variant-specific styles
    const variants = {
        text: 'h-4 rounded',
        card: 'rounded-[28px] min-h-[120px]',
        circle: 'rounded-full',
        rectangle: 'rounded-xl',
    };

    // For text variant with multiple lines
    if (variant === 'text' && lines > 1) {
        return (
            <div className={clsx('space-y-2', className)}>
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={clsx(
                            baseStyles,
                            variants.text,
                            // Last line is shorter for natural look
                            i === lines - 1 && 'w-3/4'
                        )}
                        style={{
                            width: i === lines - 1 ? '75%' : width,
                            height: height || 16,
                        }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={clsx(baseStyles, variants[variant], className)}
            style={{
                width: width,
                height: height,
            }}
            role="status"
            aria-label="Loading..."
        />
    );
}

/**
 * SkeletonCard - Pre-configured skeleton for listing cards
 */
export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={clsx('clay-card p-5 space-y-4', className)}>
            {/* Image placeholder */}
            <Skeleton variant="rectangle" height={120} className="w-full" />
            {/* Title */}
            <Skeleton variant="text" width="80%" />
            {/* Description */}
            <Skeleton variant="text" lines={2} />
            {/* Footer */}
            <div className="flex justify-between items-center">
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="circle" width={32} height={32} />
            </div>
        </div>
    );
}

/**
 * SkeletonList - Grid of skeleton cards
 */
export function SkeletonList({
    count = 4,
    columns = 2,
    className,
}: {
    count?: number;
    columns?: 1 | 2 | 3 | 4;
    className?: string;
}) {
    const columnClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    };

    return (
        <div className={clsx('grid gap-4', columnClasses[columns], className)}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

export default Skeleton;
