import { useState } from 'react';
import { ClayButton } from '@dar/ui';
import { ClayInput } from '@dar/ui';
import { fetchWithAuth } from '../../lib/api';
import RiskBadge, { RiskLevel } from '../RiskBadge';
import { Loader2, ShieldAlert, CheckCircle, XCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface AdminRiskControlsProps {
    listingId: string;
    riskScore?: number;
    riskLevel?: RiskLevel;
    riskStatus?: 'ok' | 'hold' | 'review_required';
    reasons?: string[];
    onUpdate?: () => void;
}

export function AdminRiskControls({
    listingId,
    riskScore,
    riskLevel,
    riskStatus,
    reasons,
    onUpdate
}: AdminRiskControlsProps) {
    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState<'allow' | 'hold' | 'reject' | null>(null);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!action) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetchWithAuth('/api/risk/override', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listingId,
                    action,
                    notes: notes || undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update risk status');
            }

            setAction(null);
            setNotes('');
            if (onUpdate) onUpdate();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (!riskLevel) return null;

    return (
        <div className="bg-clay-card border border-white/10 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                    <ShieldAlert size={18} className="text-clay-action" />
                    Risk Assessment
                </h3>
                <RiskBadge level={riskLevel} score={riskScore} showScore />
            </div>

            {reasons && reasons.length > 0 && (
                <div className="text-sm bg-white/5 rounded-lg p-3 space-y-1">
                    <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Risk Factors</p>
                    <ul className="list-disc list-inside space-y-1 text-text-subtle">
                        {reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                        ))}
                    </ul>
                </div>
            )}

            {riskStatus && (
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                    <span className="uppercase tracking-wide">Status:</span>
                    <span className={clsx({
                        'text-green-400': riskStatus === 'ok',
                        'text-amber-400': riskStatus === 'hold',
                        'text-red-400': riskStatus === 'review_required'
                    })}>
                        {riskStatus.replace('_', ' ').toUpperCase()}
                    </span>
                </div>
            )}

            <div className="pt-2 border-t border-white/5">
                <p className="text-sm font-medium mb-3">Admin Override</p>

                {!action ? (
                    <div className="flex gap-2">
                        <ClayButton
                            variant="ghost"
                            size="sm"
                            className="bg-green-500/10 hover:!bg-green-500/20 text-green-400 border border-green-500/30"
                            onClick={() => setAction('allow')}
                        >
                            <CheckCircle size={14} className="mr-1.5" />
                            Allow
                        </ClayButton>
                        <ClayButton
                            variant="ghost"
                            size="sm"
                            className="bg-amber-500/10 hover:!bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            onClick={() => setAction('hold')}
                        >
                            <Clock size={14} className="mr-1.5" />
                            Hold
                        </ClayButton>
                        <ClayButton
                            variant="ghost"
                            size="sm"
                            className="bg-red-500/10 hover:!bg-red-500/20 text-red-400 border border-red-500/30"
                            onClick={() => setAction('reject')}
                        >
                            <XCircle size={14} className="mr-1.5" />
                            Reject
                        </ClayButton>
                    </div>
                ) : (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className={clsx("font-medium", {
                                'text-green-400': action === 'allow',
                                'text-amber-400': action === 'hold',
                                'text-red-400': action === 'reject'
                            })}>
                                Confirm {action.toUpperCase()}
                            </span>
                            <button
                                onClick={() => setAction(null)}
                                className="text-text-muted hover:text-white"
                            >
                                Cancel
                            </button>
                        </div>

                        <ClayInput
                            placeholder="Add notes (optional)..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="text-sm"
                        />

                        <ClayButton
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full"
                        >
                            {loading && <Loader2 size={16} className="animate-spin mr-2" />}
                            Apply Override
                        </ClayButton>
                    </div>
                )}

                {error && (
                    <p className="text-xs text-red-400 mt-2">{error}</p>
                )}
            </div>
        </div>
    );
}
