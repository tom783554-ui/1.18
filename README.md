# GLB Viewer (Next.js)

## Overview
This repo hosts a Next.js + Babylon.js ICU demo with a deterministic Code Blue simulation engine, interactive hotspots, and a lightweight 3D scene. The runtime stays mobile-friendly (iPhone Safari) and Vercel-ready.

## Default asset path
The viewer auto-loads the default GLB from:

- `/public/assets/main/main.glb`

You can later swap in a prettier room GLB by setting `ICU_PRETTY_OVERRIDE_GLB_PATH` in `src/config/assets.ts` to a non-empty path. For example, drop a new GLB at `/public/assets/pretty/icu_pretty.glb` and set the constant accordingly.【F:src/config/assets.ts†L1-L4】

## Simulation engine
The simulation engine updates vitals every tick, logs actions, and scores stability based on vitals and interventions. Vitals include HR/RR/SpO₂/BP/MAP/FiO₂/PEEP/rhythm with a deterministic Code Blue script and seeded arrhythmia events.【F:src/engine/simEngine.ts†L1-L380】【F:src/engine/vitalsModel.ts†L1-L175】【F:src/scenarios/codeBlueScript.ts†L1-L77】

### Diagnoses (5)
1. Legionella/worsening pneumonia
2. Iatrogenic volume overload
3. Post-op hemorrhage
4. Acute MI
5. Stroke

Each diagnosis defines baseline vitals, progression, win/loss conditions, and default labs/imaging results.【F:src/scenarios/diagnoses.ts†L1-L188】

## Hotspots + fallback pucks
Hotspots bind to GLB mesh names when available. If a mesh is missing, the app creates emissive “puck” hotspots at a sensible fallback layout around the bed, vent, monitor, and wall panels.【F:src/interactions/hotspotCatalog.ts†L1-L210】【F:src/interactions/fallbackHotspotLayout.ts†L1-L33】【F:src/interactions/fallbackHotspotPucks.ts†L1-L68】

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
