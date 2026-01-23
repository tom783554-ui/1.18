# GLB Viewer (Next.js)

## Overview
This repo hosts a minimal Next.js viewer for GLB assets using Babylon.js. It targets a lightweight 3D preview experience with a small UI surface area and a simple, self-contained runtime.

## Default asset path
The viewer auto-loads the default GLB from:

- `/public/assets/main/main.glb`

## Local development
Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Then open the app in your browser to load the default asset.

## Deployment
This project is designed for Vercel deployment and targets iPhone Safari as a primary runtime. Keep the build output lean and avoid adding extra tooling unless necessary.

## Troubleshooting
If you see the **"missing main.glb"** banner:

- Confirm the file exists at `/public/assets/main/main.glb`.
- Use the on-screen file picker to load a local `.glb` as a fallback.

## iPhone Safari zoom fix (before/after)
**Before**
- ArcRotateCamera limits (radius + minZ) prevented close zoom on iPhone Safari, so pinch/wheel would clamp too early.

**After**
- Relaxed camera limits (lowerRadiusLimit, minZ, wheel/pinch precision, inertia) and added an on-screen Zoom Test overlay with controls.
- Added reframe logic and a Normalize GLB toggle to scale oversized assets and refit the camera.

**How to test on iPhone**
- Open the viewer in Safari on iPhone 13 Pro.
- Pinch to zoom until radius reaches <= 0.2 while watching the Zoom Test overlay.
- Use the Zoom+ button if pinch is finicky.
