# Plan: Prevent Vite Dev Loader From Shipping in Prod Builds

## Summary
Separate dev and prod output directories so `pnpm dev` never overwrites production `dist`, and update scripts/docs to make the correct folder obvious. This eliminates the “Vite Dev Mode” page appearing in a production build.

## Changes (Decision-Complete)
1. **Vite config**  
   Update `vite.config.ts` to use different output folders based on command:
   - `command === "serve"` → `dist-dev`
   - `command === "build"` → `dist`
   Also ensure `emptyOutDir` is enabled for production builds.

2. **Docs**  
   Update `README.md`:
   - Dev: load `dist-dev` while `pnpm dev` is running.
   - Prod: load `dist` after `pnpm build`.

3. **Optional script clarity**  
   Add a convenience script to open dev output or to clean production output before build (optional, if you want belt-and-suspenders).

## Public APIs / Interfaces
- No public API changes.

## Test Cases and Scenarios
1. Run `pnpm dev`, load `dist-dev`, confirm popup loads and hot reload works.
2. Stop dev server, reload extension from `dist-dev`, confirm it shows the Vite Dev Mode message (expected dev behavior).
3. Run `pnpm build`, load `dist`, confirm popup loads without Vite Dev Mode and works offline.
4. Verify `dist/src/popup/index.html` contains real built HTML and not the Vite Dev Mode loader.

## Assumptions / Defaults
- We keep using port `5000` for dev server, unchanged.
- We accept separate output directories as the primary fix.
- We do not change runtime logic or manifest behavior beyond build output locations.
