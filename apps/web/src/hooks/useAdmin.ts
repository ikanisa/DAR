import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAdmin() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAdmin();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN') {
                checkRole(session?.user);
            } else if (event === 'SIGNED_OUT') {
                setIsAdmin(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function checkAdmin() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            checkRole(user);
        } catch (e) {
            console.error(e);
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    }

    function checkRole(user: any) {
        if (!user) {
            setIsAdmin(false);
            return;
        }

        // Check app_metadata.role or user_metadata.role
        const appRole = user.app_metadata?.role;
        const userRole = user.user_metadata?.role;

        if (['admin', 'moderator'].includes(appRole) || ['admin', 'moderator'].includes(userRole)) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
        setLoading(false);
    }

    return { isAdmin, loading };
}
