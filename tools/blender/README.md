# Blender GLB build

Run the build script to merge GLB parts into `public/main.glb` while preserving hotspot metadata:

```bash
blender --background --python tools/blender/build_master_glb.py
```

The script searches for parts in `assets/parts`, `assets/glb_parts`, or `public/parts` (in that order) and exports a single `public/main.glb` with custom hotspot properties included.
