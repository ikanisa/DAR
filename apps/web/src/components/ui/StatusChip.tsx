/**
 * StatusChip Component
 * 
 * Badge showing verification status.
 * Pending: yellow (#FFCC00)
 * Ready/Verified: green (#00E676)
 */

import React from 'react';
import clsx from 'clsx';
import { Check, AlertCircle } from 'lucide-react';

type StatusType = 'pending' | 'verified' | 'ready';

interface StatusChipProps {
    status: StatusType;
    showIcon?: boolean;
    className?: string;
}

const statusConfig: Record<StatusType, {
    label: string;
    className: string;
    icon: React.ReactNode;
}> = {
    pending: {
        label: 'Pending',
        className: 'status-chip--pending',
        icon: <AlertCircle size={12} />,
    },
    verified: {
        label: 'Verified',
        className: 'status-chip--ready',
        icon: <Check size={12} />,
    },
    ready: {
        label: 'Ready',
        className: 'status-chip--ready',
        icon: <Check size={12} />,
    },
};

export function StatusChip({ status, showIcon = true, className }: StatusChipProps) {
    const config = statusConfig[status];

    return (
        <span
            className={clsx('status-chip', config.className, className)}
            role="status"
            aria-label={`Status: ${config.label}`}
        >
            {showIcon && config.icon}
            {config.label}
        </span>
    );
}

/**
 * VerifiedBadge - Shorthand for verified status
 */
export function VerifiedBadge({ className }: { className?: string }) {
    return <StatusChip status="verified" className={className} />;
}

/**
 * PendingBadge - Shorthand for pending status
 */
export function PendingBadge({ className }: { className?: string }) {
    return <StatusChip status="pending" className={className} />;
}

export default StatusChip;
