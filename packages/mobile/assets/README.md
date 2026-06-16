# App icons

Drop the Trashy icon art here. `app.json` already points at these filenames:

- `icon.png`: 1024x1024, the main app icon (Leaf Green `#4CAF50` square with Trashy's happy face).
- `adaptive-icon.png`: 1024x1024 foreground for Android adaptive icons (Trashy face, transparent
  background; the green background is set in `app.json` as `#4CAF50`).

Until the PNGs land, `expo start` runs fine but `expo prebuild` / an EAS build will complain about
the missing files. The web favicon lives separately at `packages/web/src/app/icon.png`.
