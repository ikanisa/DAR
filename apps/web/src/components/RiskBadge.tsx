/**
 * RiskBadge Component
 * Displays risk level indicator for admin review queue
 */

import { clsx } from 'clsx';

export type RiskLevel = 'low' | 'medium' | 'high';

interface RiskBadgeProps {
    level: RiskLevel;
    score?: number;
    showScore?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const RISK_CONFIG = {
    low: {
        label: 'Low Risk',
        bgColor: 'bg-emerald-500/20',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
    },
    medium: {
        label: 'Medium Risk',
        bgColor: 'bg-amber-500/20',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/30',
    },
    high: {
        label: 'High Risk',
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/30',
    },
};

const SIZE_CONFIG = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
};

export function RiskBadge({
    level,
    score,
    showScore = false,
    size = 'md',
    className,
}: RiskBadgeProps) {
    const config = RISK_CONFIG[level];
    const sizeClass = SIZE_CONFIG[size];

    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border font-medium',
                config.bgColor,
                config.textColor,
                config.borderColor,
                sizeClass,
                className
            )}
            role="status"
            aria-label={`${config.label}${showScore && score !== undefined ? `, score ${score}` : ''}`}
        >
            {/* Risk icon */}
            <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
            >
                {level === 'high' ? (
                    <path
                        fillRule="evenodd"
                        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                    />
                ) : level === 'medium' ? (
                    <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                    />
                ) : (
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                        clipRule="evenodd"
                    />
                )}
            </svg>

            <span>
                {config.label}
                {showScore && score !== undefined && (
                    <span className="ml-1 opacity-75">({score})</span>
                )}
            </span>
        </span>
    );
}

export default RiskBadge;
