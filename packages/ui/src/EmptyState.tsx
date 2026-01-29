/**
 * EmptyState Component
 * 
 * Reusable empty state with icon, title, description, and optional action.
 * Follows Midnight Savory design system.
 */

import clsx from 'clsx';
import { ClayButton } from './ClayButton';
import { LucideIcon, Package } from 'lucide-react';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon: Icon = Package,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={clsx(
                'flex flex-col items-center justify-center py-12 px-6 text-center',
                className
            )}
            role="status"
            aria-label={title}
        >
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <Icon
                    className="w-10 h-10 text-text-muted"
                    aria-hidden="true"
                />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-text-primary mb-2">
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p className="text-text-muted max-w-sm mb-6">
                    {description}
                </p>
            )}

            {/* Action */}
            {action && (
                <ClayButton onClick={action.onClick}>
                    {action.label}
                </ClayButton>
            )}
        </div>
    );
}

export default EmptyState;
