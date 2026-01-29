/**
 * ClayInput Component
 * 
 * Claymorphism-styled input with subtle inset shadow and focus glow.
 * Per Midnight Savory design spec.
 */

import React, { forwardRef } from 'react';
import clsx from 'clsx';

interface ClayInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
    label?: string;
    error?: string;
    inputPrefix?: React.ReactNode;
    suffix?: React.ReactNode;
}

export const ClayInput = forwardRef<HTMLInputElement, ClayInputProps>(
    ({ className, label, error, inputPrefix, suffix, disabled, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-text-muted mb-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {inputPrefix && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                            {inputPrefix}
                        </div>
                    )}
                    <input
                        ref={ref}
                        disabled={disabled}
                        className={clsx(
                            // Base styles
                            'w-full h-12 rounded-clay bg-clay-card',
                            'border border-white/10',
                            'text-text-primary placeholder-text-muted',
                            'transition-all duration-normal ease-smooth',
                            // Inset shadow for clay effect
                            'shadow-clay-inset',
                            // Focus styles
                            'focus:outline-none focus:border-clay-action focus:shadow-focus-ring',
                            // Disabled styles
                            disabled && 'opacity-50 cursor-not-allowed',
                            // Error styles
                            error && 'border-red-500 focus:border-red-500',
                            // Padding based on prefix/suffix
                            inputPrefix ? 'pl-12' : 'pl-4',
                            suffix ? 'pr-12' : 'pr-4',
                            className
                        )}
                        {...props}
                    />
                    {suffix && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                            {suffix}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="mt-2 text-sm text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

ClayInput.displayName = 'ClayInput';

export default ClayInput;
