import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
    test('should load app and show chat tab by default', async ({ page }) => {
        await page.goto('/');

        // Wait for app to load
        await expect(page.locator('header')).toBeVisible();

        // Chat tab should be active by default
        await expect(page.locator('[aria-selected="true"]')).toContainText('Chat');
    });

    test('should navigate between all tabs', async ({ page }) => {
        await page.goto('/');

        const tabs = ['Discover', 'Listings', 'Chat', 'Alerts', 'Profile'];

        for (const tabName of tabs) {
            await page.click(`button[aria-label="${tabName}"]`);
            await expect(page.locator(`button[aria-label="${tabName}"][aria-selected="true"]`)).toBeVisible();
        }
    });

    test('should navigate from Profile to Settings and back', async ({ page }) => {
        await page.goto('/');

        // Go to Profile
        await page.click('button[aria-label="Profile"]');
        await expect(page.getByText('Your Profile')).toBeVisible();

        // Click Settings
        await page.click('text=Settings');
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

        // Go back
        await page.click('button:has([class*="ArrowLeft"])');
        await expect(page.getByText('Your Profile')).toBeVisible();
    });
});

test.describe('Chat Flow', () => {
    test('should send a message', async ({ page }) => {
        await page.goto('/');

        // Type a message
        const input = page.locator('input[placeholder*="Type"]');
        await input.fill('Hello');

        // Send
        await page.click('button[aria-label*="Send"]');

        // Message should appear
        await expect(page.locator('text=Hello')).toBeVisible();
    });
});

test.describe('Accessibility', () => {
    test('should have skip link', async ({ page }) => {
        await page.goto('/');

        // Focus skip link
        await page.keyboard.press('Tab');
        const skipLink = page.locator('.skip-link');
        await expect(skipLink).toBeFocused();

        // Activate it
        await page.keyboard.press('Enter');

        // Main content should be focused
        await expect(page.locator('#main-content')).toBeFocused();
    });

    test('should have visible focus rings', async ({ page }) => {
        await page.goto('/');

        // Tab to first interactive element
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Check for focus indicator (visible focus ring)
        const focusedElement = page.locator(':focus-visible');
        await expect(focusedElement).toBeVisible();
    });

    test('touch targets should be at least 44px', async ({ page }) => {
        await page.goto('/');

        // Check nav buttons
        const navButtons = page.locator('nav button');
        const count = await navButtons.count();

        for (let i = 0; i < count; i++) {
            const box = await navButtons.nth(i).boundingBox();
            expect(box?.height).toBeGreaterThanOrEqual(44);
        }
    });
});

test.describe('PWA Install', () => {
    test('skip test - requires 45s wait', async () => {
        // This test is skipped in CI due to long wait time
        // Manual testing recommended for PWA install flow
        test.skip();
    });
});

test.describe('Discover', () => {
    test('should show search bar', async ({ page }) => {
        await page.goto('/');

        await page.click('button[aria-label="Discover"]');

        await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    });

    test('should show categories', async ({ page }) => {
        await page.goto('/');

        await page.click('button[aria-label="Discover"]');

        await expect(page.getByText('Browse Categories')).toBeVisible();
    });
});
