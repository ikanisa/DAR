import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';

describe('App Smoke Test', () => {
    it('renders without crashing', () => {
        // Simple render check. 
        // Note: App might need providers if they aren't in App.tsx itself.
        // App.tsx has SessionProvider and RouterProvider.
        // But RouterProvider needs DOM. JSDOM environment provides that.
        render(<App />);
        expect(document.body).toBeInTheDocument();
    });
});
