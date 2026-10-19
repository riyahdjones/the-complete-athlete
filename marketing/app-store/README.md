# The Complete Athlete — App Store Creative Studio V2

This workspace is isolated from the production application. It uses authentic captured app screens as phone textures and generated sports environments as replaceable background plates.

## Initial proof set

- `01A-train-the-mind.png` — hero A
- `01B-the-game-no-one-sees.png` — hero B
- `02-game-day-ready.png` — Game Day Mode
- `initial-proofs-contact-sheet.png` — full campaign proof comparison at thumbnail scale

The chosen master size is **1290 × 2796 px**, an accepted portrait size for Apple’s current iPhone with Dynamic Island (large display) screenshot class. PNGs are opaque RGB.

## Open the editor

From the repository root:

```bash
pnpm exec vite marketing/app-store --host 127.0.0.1 --port 4175
```

Open `http://127.0.0.1:4175/`. The editor supports copy changes, A/B switching, phone position, scale, rotation, 3D tilt, background blur, and lighting intensity. Changes save in browser local storage and update both the large preview and thumbnail preview.

## Capture the authentic Game Day screen

With the main app running on port 5173 and Chrome DevTools on port 9224:

```bash
node marketing/app-store/scripts/capture-game-day.mjs marketing/app-store/assets/ui/game-day.png
```

The fixture writes only representative local browser storage for the screenshot session. It does not touch production data or application behavior.

## Batch export

With the editor on port 4175 and Chrome DevTools on port 9224:

```bash
node marketing/app-store/scripts/render-proofs.mjs
```

The script exports the three master PNGs and the contact sheet. Verify dimensions with `sips -g pixelWidth -g pixelHeight marketing/app-store/exports/*.png`.

## Updating assets

Replace files in `assets/ui` only with fresh authentic captures from the current app. Replace files in `assets/backgrounds` with text-free portrait plates. Do not bake UI or marketing copy into generated imagery; the editor owns all text and device compositing.
