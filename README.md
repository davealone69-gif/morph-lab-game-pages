# MORPH LAB

MORPH LAB is a browser-playable, local-first 3D avatar RPG. Create a fully clothed procedural avatar, optionally apply a cropped local face reference, then explore three gothic worlds, collect shards and relics, complete quests, and save progress in browser storage.

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview --host 0.0.0.0 --port 4173
```

Open `http://localhost:4173`.

## Controls

- **Desktop:** WASD or arrow keys to move; drag to look; use the UI to change worlds, outfits, quests, and settings.
- **Touch:** on-screen joystick to move; DASH button for a burst; drag to look.
- **Photo reference:** the browser crops the selected image and keeps the resulting texture in memory for the current session. It is not uploaded or included in the save.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy-pages.yml` builds and publishes `dist/` when code is pushed to `main` or when manually run. Vite derives the base URL from `GITHUB_REPOSITORY`, so project sites (for example, `/Morph-Lab/`) and user/organization sites use the appropriate asset paths. GitHub Pages must be enabled for the repository with **GitHub Actions** as the build source.

The production build generates `dist/sw.js` with a content-versioned precache of the complete static app. After the first successful online visit and service-worker installation, the app shell and bundled assets can reopen offline. This is a web-installable PWA, not a native Android APK.

## Validation

- `pnpm build` — production bundle plus generated offline cache.
- `pnpm test:profile` — profile/save unit tests.
- `pnpm smoke` — desktop, Android-sized viewport, upload, save/reload, touch, wardrobe, and world flows.

## Privacy and implementation boundaries

- Character progression and preferences stay in local browser storage; there is no account or cloud save.
- The photo reference is a face-texture overlay on procedural geometry. **This app does not generate a photorealistic or AI-reconstructed 3D likeness from a photo or prompt.**
- There is no online multiplayer service, native APK, or remote AI-driven NPC service. The companion dialogue is local, authored game text.
- No user photo or screenshot is required by the Pages build; these local files are ignored by Git.
