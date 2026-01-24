import os
from pathlib import Path
import re

import bpy

HOTSPOT_NAME_REGEX = re.compile(r"^(HS__|HOTSPOT__|hs__)", re.IGNORECASE)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)


def set_units() -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def ensure_master_root() -> bpy.types.Object:
    root = bpy.data.objects.new("MASTER_ROOT", None)
    bpy.context.collection.objects.link(root)
    return root


def parse_hotspot_name(name: str) -> tuple[str, str]:
    parts = name.split("__")
    if len(parts) >= 2:
        hotspot_id = parts[1] or name
        label = parts[2] or hotspot_id
        return hotspot_id, label
    return name, name


def apply_transforms(objects: list[bpy.types.Object]) -> None:
    for obj in objects:
        if obj.type not in {"MESH", "EMPTY"}:
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        obj.select_set(False)


def import_glb(filepath: Path, master_root: bpy.types.Object) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(filepath))
    imported = [obj for obj in bpy.data.objects if obj not in before]

    prefix = re.sub(r"\W+", "_", filepath.stem)
    for obj in imported:
        obj.name = f"{prefix}__{obj.name}"
        if obj.parent is None:
            obj.parent = master_root

        if HOTSPOT_NAME_REGEX.match(obj.name):
            hotspot_id, label = parse_hotspot_name(obj.name)
            obj["hotspotId"] = hotspot_id
            obj["label"] = label
            obj["type"] = "hotspot"

    apply_transforms(imported)
    return imported


def create_placeholder_cubes(master_root: bpy.types.Object) -> None:
    if os.environ.get("PLACEHOLDERS") != "1":
        return
    devices = ["Monitor", "Ventilator", "Bed"]
    for index, name in enumerate(devices):
        bpy.ops.mesh.primitive_cube_add(size=0.2, location=(index * 0.4, 0, 0))
        cube = bpy.context.active_object
        cube.name = f"PLACEHOLDER__{name}"
        cube.parent = master_root


def find_source_dir(repo_root: Path) -> Path:
    candidates = [
        repo_root / "assets" / "parts",
        repo_root / "assets" / "glb_parts",
        repo_root / "public" / "parts",
    ]
    for path in candidates:
        if path.exists() and path.is_dir():
            return path
    raise FileNotFoundError("No source directory found. Expected assets/parts, assets/glb_parts, or public/parts.")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    source_dir = find_source_dir(repo_root)
    output_path = repo_root / "public" / "main.glb"

    clear_scene()
    set_units()
    master_root = ensure_master_root()

    glb_files = sorted([p for p in source_dir.iterdir() if p.suffix.lower() in {".glb", ".gltf"}])
    if not glb_files:
        raise FileNotFoundError(f"No GLB/GLTF files found in {source_dir}.")

    for filepath in glb_files:
        import_glb(filepath, master_root)

    create_placeholder_cubes(master_root)

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=False,
        export_extras=True,
        export_yup=True,
        apply_modifiers=True,
    )


if __name__ == "__main__":
    main()
