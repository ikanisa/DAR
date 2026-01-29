import { Link } from 'react-router-dom';
import { ClayCard, ClayButton } from '@dar/ui';
import { HelpCircle } from 'lucide-react';

export function NotFoundView() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center animate-in fade-in duration-300">
            <ClayCard className="max-w-sm w-full p-6 flex flex-col items-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <HelpCircle className="w-8 h-8 text-clay-action" />
                </div>

                <h1 className="text-2xl font-bold mb-2">Page not found</h1>
                <p className="text-text-muted mb-6">
                    The page you are looking for doesn't exist or has been moved.
                </p>

                <Link to="/" className="w-full">
                    <ClayButton variant="primary" className="w-full">
                        Return Home
                    </ClayButton>
                </Link>
            </ClayCard>
        </div>
    );
}
