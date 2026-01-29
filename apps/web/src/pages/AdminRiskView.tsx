import { useState, useEffect } from 'react';
import { ClayCard } from '@dar/ui';
import { ClayButton } from '@dar/ui';
import { AdminRiskControls } from '../components/listings/AdminRiskControls';
import { fetchWithAuth } from '../lib/api';
import { Loader2, ShieldAlert } from 'lucide-react';
import { RiskLevel } from '../components/RiskBadge';

interface HeldListing {
    property_id: string;
    title: string;
    price: number;
    location: string;
    risk_score: number;
    risk_level: RiskLevel;
    status: 'hold' | 'review_required';
    reasons: string[];
    created_at: string;
}

export function AdminRiskView() {
    const [listings, setListings] = useState<HeldListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const loadListings = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth('/api/admin/risk/held');
            if (res.ok) {
                const data = await res.json();
                setListings(data.listings);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadListings();
    }, []);

    return (
        <div className="pt-4 pb-24 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldAlert className="text-red-400" />
                    Risk Review Queue
                </h2>
                <ClayButton size="sm" variant="ghost" onClick={loadListings}>
                    Refresh
                </ClayButton>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-clay-action" />
                </div>
            ) : listings.length === 0 ? (
                <div className="text-center py-12 bg-white/5 rounded-xl">
                    <p className="text-text-muted">No listings requiring review.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {listings.map(listing => (
                        <ClayCard key={listing.property_id} className="space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{listing.title}</h3>
                                    <p className="text-sm text-text-muted">
                                        €{listing.price.toLocaleString()} • {listing.location}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-mono text-text-muted">
                                        Score: {listing.risk_score}
                                    </div>
                                    <div className="text-xs font-bold text-red-400 uppercase">
                                        {listing.status.replace('_', ' ')}
                                    </div>
                                </div>
                            </div>

                            {selectedId === listing.property_id ? (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <AdminRiskControls
                                        listingId={listing.property_id}
                                        riskScore={listing.risk_score}
                                        riskLevel={listing.risk_level}
                                        riskStatus={listing.status}
                                        reasons={listing.reasons}
                                        onUpdate={() => {
                                            setSelectedId(null);
                                            loadListings();
                                        }}
                                    />
                                    <div className="mt-2 text-center">
                                        <button
                                            onClick={() => setSelectedId(null)}
                                            className="text-xs text-text-muted hover:text-white"
                                        >
                                            Hide Controls
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <ClayButton
                                    className="w-full"
                                    onClick={() => setSelectedId(listing.property_id)}
                                >
                                    Review
                                </ClayButton>
                            )}
                        </ClayCard>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AdminRiskView;
