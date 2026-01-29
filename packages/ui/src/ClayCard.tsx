import React from 'react';
import clsx from 'clsx';

interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'primary' | 'secondary';
}

export function ClayCard({ children, className, variant = 'primary', ...props }: ClayCardProps) {
    return (
        <div
            className={clsx(
                'clay-card p-5 relative overflow-hidden transition-transform duration-300 hover:scale-[1.02]',
                variant === 'secondary' && 'bg-opacity-80',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
