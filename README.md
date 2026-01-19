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
