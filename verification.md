# Verification Steps for README Update

## 1. Verify Structure & File Existence
- [ ] Check that `README.md` exists and is the new comprehensive version.
- [ ] Check that `README.old.md` exists and is the original version.

## 2. Verify Command Accuracy
- [ ] Run `pnpm install` - ensure it works.
- [ ] Run `pnpm dev` - ensure it starts both web and backend.
- [ ] Run `pnpm lint` - ensure it runs across the monorepo.
- [ ] Run `pnpm test` - ensure it triggers vitest.

## 3. Verify Content Accuracy
- [ ] Confirm `apps/web` and `apps/backend` are correctly described in "Monorepo Structure".
- [ ] Confirm `VITE_API_URL` and `DATABASE_URL` are listed in "Required Environment Variables".
- [ ] Confirm Cloudflare Pages build settings match `DEPLOY_CLOUDFLARE.md` (Output dir: `dist`).

## 4. Visual Check
- [ ] Open `README.md` in a markdown viewer to ensure formatting (ASCII art, tables) renders correctly.
