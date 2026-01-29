/**
 * ErrorState Component
 * 
 * Reusable error state with message and retry action.
 * Uses red accent for clear error indication.
 */

import clsx from 'clsx';
import { ClayButton } from './ClayButton';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
}

export function ErrorState({
    title = 'Something went wrong',
    message,
    onRetry,
    retryLabel = 'Try again',
    className,
}: ErrorStateProps) {
    return (
        <div
            className={clsx(
                'flex flex-col items-center justify-center py-12 px-6 text-center',
                className
            )}
            role="alert"
        >
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                <AlertTriangle
                    className="w-10 h-10 text-red-400"
                    aria-hidden="true"
                />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-text-primary mb-2">
                {title}
            </h3>

            {/* Message */}
            <p className="text-text-muted max-w-sm mb-6">
                {message}
            </p>

            {/* Retry Action */}
            {onRetry && (
                <ClayButton onClick={onRetry}>
                    <RefreshCw size={16} className="mr-2" aria-hidden="true" />
                    {retryLabel}
                </ClayButton>
            )}
        </div>
    );
}

export default ErrorState;
