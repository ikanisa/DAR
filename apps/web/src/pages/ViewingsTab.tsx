
/**
 * ViewingsTab Component
 * 
 * Displays and manages scheduled property viewings (P6B).
 * Users can see current status (proposed, confirmed) and cancel/reschedule.
 */

import { useState, useEffect } from 'react';
import { ClayCard } from '@dar/ui';
import { ClayButton } from '@dar/ui';
import { fetchWithAuth } from '../lib/api';
import { ViewingRequest } from '@dar/core';
import { Loader2, Calendar, Clock, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';

export function ViewingsTab() {
    const [viewings, setViewings] = useState<ViewingRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const loadViewings = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth('/api/viewings');
            if (res.ok) {
                const data = await res.json();
                setViewings(data);
            }
        } catch (e) {
            console.error('Failed to load viewings:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadViewings();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'proposed': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'cancelled': return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'completed': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            default: return 'text-text-muted bg-white/5 border-white/10';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'confirmed': return <CheckCircle size={14} className="mr-1.5" />;
            case 'proposed': return <AlertCircle size={14} className="mr-1.5" />;
            case 'cancelled': return <XCircle size={14} className="mr-1.5" />;
            case 'completed': return <CheckCircle size={14} className="mr-1.5" />;
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" />
            </div>
        );
    }

    if (viewings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <Calendar className="w-16 h-16 text-text-muted mb-4" strokeWidth={1.5} />
                <h2 className="text-xl font-bold mb-2">No Viewings Scheduled</h2>
                <p className="text-text-muted max-w-sm mb-6">
                    Schedule a viewing directly from any property listing page using the chat.
                </p>
            </div>
        );
    }

    // Group by status
    const confirmed = viewings.filter(v => v.status === 'confirmed');
    const proposed = viewings.filter(v => ['proposed', 'rescheduled'].includes(v.status));
    const past = viewings.filter(v => ['completed', 'cancelled'].includes(v.status));

    const ViewingCard = ({ viewing }: { viewing: ViewingRequest }) => (
        <ClayCard className="mb-4">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="font-bold">{viewing.listing_title || 'Property Viewing'}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex items-center w-fit ${getStatusColor(viewing.status)}`}>
                            {getStatusIcon(viewing.status)}
                            {viewing.status.toUpperCase()}
                        </span>
                    </div>
                </div>
                {/* Chat Action - Link to chat would be ideal here */}
                {/* <ClayButton size="sm" variant="ghost">
                    <MessageCircle size={16} />
                </ClayButton> */}
            </div>

            <div className="space-y-2 text-sm text-text-secondary">
                {viewing.scheduled_at ? (
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-text-muted" />
                        <span>
                            {new Date(viewing.scheduled_at).toLocaleString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: 'numeric'
                            })}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-amber-400">
                        <Clock size={16} />
                        <span>Time TBD</span>
                    </div>
                )}

                {viewing.poster_name && (
                    <div className="flex items-center gap-2">
                        <User size={16} className="text-text-muted" />
                        <span>Agent: {viewing.poster_name}</span>
                    </div>
                )}
            </div>

            {viewing.notes && (
                <div className="mt-3 p-3 bg-white/5 rounded-lg text-xs italic text-text-muted">
                    "{viewing.notes}"
                </div>
            )}

            {/* Action buttons could go here */}
        </ClayCard>
    );

    return (
        <div className="pt-4 pb-24 px-4 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Viewings</h2>
                <ClayButton size="sm" variant="ghost" onClick={loadViewings}>
                    Refresh
                </ClayButton>
            </div>

            {confirmed.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Confirmed</h3>
                    {confirmed.map(v => <ViewingCard key={v.id} viewing={v} />)}
                </section>
            )}

            {proposed.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Proposed / Pending</h3>
                    {proposed.map(v => <ViewingCard key={v.id} viewing={v} />)}
                </section>
            )}

            {past.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Past & Cancelled</h3>
                    {past.map(v => <ViewingCard key={v.id} viewing={v} />)}
                </section>
            )}
        </div>
    );
}

export default ViewingsTab;
