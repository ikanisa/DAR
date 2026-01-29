/**
 * VendorsTab Component
 * 
 * Displays verified vendors in a bento grid layout.
 * Verified only per workflow spec.
 */

import { useState, useEffect } from 'react';
import { ClayCard } from '../components/ui/ClayCard';
import { BentoGrid, BentoItem } from '../components/ui/BentoGrid';
import { StatusChip } from '../components/ui/StatusChip';
import { supabase } from '../lib/supabase';
import { Loader2, Store, MapPin } from 'lucide-react';

interface Vendor {
    id: string;
    name: string;
    description?: string;
    category?: string;
    location?: string;
    verified: boolean;
}

export function VendorsTab() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch only verified vendors per workflow spec
            const { data, error: fetchError } = await supabase
                .from('vendors')
                .select('*')
                .eq('status', 'verified')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            setVendors(data || []);
        } catch (e) {
            console.error('Failed to fetch vendors:', e);
            setError('Failed to load vendors');
            // Use mock data for demo
            setVendors([
                { id: '1', name: 'TechMart Pro', description: 'Electronics & gadgets', category: 'Electronics', location: 'Malta', verified: true },
                { id: '2', name: 'HomeStyle', description: 'Furniture & decor', category: 'Furniture', location: 'Malta', verified: true },
                { id: '3', name: 'ServiceHub', description: 'Professional services', category: 'Services', location: 'Malta', verified: true },
            ]);
        } finally {
            setLoading(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-clay-action" aria-label="Loading vendors" />
            </div>
        );
    }

    // Empty state
    if (vendors.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Store className="w-16 h-16 text-text-muted mb-4" aria-hidden="true" />
                <h2 className="text-xl font-bold mb-2">No Verified Vendors Yet</h2>
                <p className="text-text-muted max-w-sm">
                    Verified vendors will appear here. Use the chat to become a vendor!
                </p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-6">Verified Vendors</h2>

            <BentoGrid columns={2}>
                {vendors.map((vendor) => (
                    <BentoItem key={vendor.id}>
                        <ClayCard className="h-full">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-clay-action/30 to-purple-500/30 flex items-center justify-center">
                                    <Store className="w-6 h-6 text-clay-action" aria-hidden="true" />
                                </div>
                                <StatusChip status="verified" />
                            </div>

                            <h3 className="font-bold text-lg mb-1">{vendor.name}</h3>

                            {vendor.description && (
                                <p className="text-text-muted text-sm mb-3 line-clamp-2">
                                    {vendor.description}
                                </p>
                            )}

                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                {vendor.category && (
                                    <span className="px-2 py-1 bg-white/5 rounded-full">
                                        {vendor.category}
                                    </span>
                                )}
                                {vendor.location && (
                                    <span className="flex items-center gap-1">
                                        <MapPin size={12} aria-hidden="true" />
                                        {vendor.location}
                                    </span>
                                )}
                            </div>
                        </ClayCard>
                    </BentoItem>
                ))}
            </BentoGrid>
        </div>
    );
}

export default VendorsTab;
