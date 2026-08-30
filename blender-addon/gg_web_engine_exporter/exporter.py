"""GG Web Engine scene export - the actual logic, kept free of any Blender-UI
concerns so it has exactly one home.

This module is imported two ways:
- by `operator.py`, as part of the registered add-on, for interactive export via
  `File > Export > GG Web Engine`;
- by `../scripts/export_cli.py`, standalone (no add-on install needed), for
  headless/CI batch export via `blender --background --python export_cli.py`.

Both entry points call the same functions below. If you need this export logic in
another project, install/vendor this add-on and import it - don't copy this file;
that's exactly the drift this module replaced (see blender-addon/README.md).

## Export formats

Right now there is exactly one export format: a `.glb` (geometry/materials/lights,
via Blender's own glTF exporter) plus a sidecar `.meta` JSON file carrying
everything glTF has no slot for - empties, curves/splines, and rigid body physics
shapes - consumed by `Gg3dLoader.loadGgGlb` (`packages/core/src/3d/loader.ts`) and
the `"Glb"` level-JSON class. `collect_scene_metadata()` below is deliberately kept
separate from the glTF-writing half of `export_glb_meta()`: a planned second export
format - serializing a scene directly to a GG level JSON document (see
`gg-engine-level-json`) instead of a GLB+meta sidecar - will reuse this same scene
walk and shape/curve/dummy parsing to build level-JSON entities rather than a
`.meta` sidecar, so avoid folding scene-walking logic into the glTF-specific half.
"""
import json
import os

import bpy
from rna_prop_ui import rna_idprop_value_to_python

# Bumped whenever the .meta JSON shape changes in a way old readers can't ignore.
# `Gg3dLoader`/`GgMeta` on the JS side can check this to warn on stale/future
# exports instead of silently misreading them.
GG_META_FORMAT_VERSION = 1


def parse_curve_obj(obj):
    curve = bpy.data.curves[obj.data.name]
    spline = curve.splines[0]
    is_cyclic = spline.use_cyclic_u
    points = [
        {
            "x": p.co.x + obj.location.x,
            "y": p.co.y + obj.location.y,
            "z": p.co.z + obj.location.z,
        }
        for p in spline.points
    ]
    return {
        "name": obj.name,
        "cyclic": is_cyclic,
        "points": points,
        **{x: rna_idprop_value_to_python(obj[x]) for x in obj.keys() if x != "_RNA_UI"},
    }


def parse_dummy_obj(obj):
    obj.rotation_mode = "QUATERNION"
    return {
        "name": obj.name,
        "position": {
            "x": obj.location.x,
            "y": obj.location.y,
            "z": obj.location.z,
        },
        "rotation": {
            "x": obj.rotation_quaternion.x,
            "y": obj.rotation_quaternion.y,
            "z": obj.rotation_quaternion.z,
            "w": obj.rotation_quaternion.w,
        },
        **{x: obj[x] for x in obj.keys() if x != "_RNA_UI"},
    }


def get_rigid_body_description(obj, export_body_parameters=True):
    body = obj.rigid_body
    obj.rotation_mode = "QUATERNION"
    meta = {
        "name": obj.name,
        "position": {
            "x": obj.location.x,
            "y": obj.location.y,
            "z": obj.location.z,
        },
        # FIXME relative rotation
        "rotation": {
            "x": obj.rotation_quaternion.x,
            "y": obj.rotation_quaternion.y,
            "z": obj.rotation_quaternion.z,
            "w": obj.rotation_quaternion.w,
        },
        "shape": {
            "shape": body.collision_shape,
        },
    }
    if export_body_parameters:
        meta["body"] = {
            "dynamic": body.type == "ACTIVE",
            "mass": body.mass,
            "restitution": body.restitution,
            "friction": body.friction,
        }
    parent = obj.parent
    while parent:
        meta["position"]["x"] -= parent.location.x
        meta["position"]["y"] -= parent.location.y
        meta["position"]["z"] -= parent.location.z
        parent = parent.parent
    meta["position"]["x"] = round(meta["position"]["x"], 6)
    meta["position"]["y"] = round(meta["position"]["y"], 6)
    meta["position"]["z"] = round(meta["position"]["z"], 6)
    if meta["shape"]["shape"] == "SPHERE":
        meta["shape"]["radius"] = max(obj.dimensions.x, obj.dimensions.y, obj.dimensions.z) / 2
    elif meta["shape"]["shape"] == "BOX":
        meta["shape"]["dimensions"] = {"x": obj.dimensions.x, "y": obj.dimensions.y, "z": obj.dimensions.z}
    elif meta["shape"]["shape"] in ["CONE", "CYLINDER"]:
        meta["shape"]["radius"] = max(obj.dimensions.x, obj.dimensions.y) / 2
        meta["shape"]["height"] = obj.dimensions.z
    elif meta["shape"]["shape"] == "CAPSULE":
        meta["shape"]["radius"] = max(obj.dimensions.x, obj.dimensions.y) / 2
        meta["shape"]["centersDistance"] = obj.dimensions.z - max(obj.dimensions.x, obj.dimensions.y)
    elif meta["shape"]["shape"] == "CONVEX_HULL":
        meta["shape"]["vertices"] = [{"x": v.co.x, "y": v.co.y, "z": v.co.z} for v in obj.data.vertices]
    elif meta["shape"]["shape"] == "MESH":
        meta["shape"]["vertices"] = [{"x": v.co.x, "y": v.co.y, "z": v.co.z} for v in obj.data.vertices]
        import bmesh

        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        meta["shape"]["faces"] = [[v.index for v in f.verts] for f in bm.faces]
        bm.free()
    elif meta["shape"]["shape"] == "COMPOUND":
        meta["shape"]["children"] = [
            get_rigid_body_description(sub_obj, export_body_parameters=False)
            for sub_obj in bpy.context.scene.objects
            if sub_obj.rigid_body is not None and sub_obj.parent == obj
        ]
    else:
        raise NotImplementedError(f"GG does not support exporting rigid body {meta['shape']['shape']} shape")
    return meta


def collect_scene_metadata():
    """Walk `bpy.context.scene.objects` and return the format-agnostic dict of
    curves/dummies/rigid bodies described in this module's docstring. Also drives
    which objects get selected for the glTF export in `export_glb_meta` below, so
    call this before touching `obj.select_set`.
    """
    metadata = {"formatVersion": GG_META_FORMAT_VERSION, "curves": [], "dummies": [], "rigidBodies": []}
    for obj in bpy.data.objects:
        if obj.type == "CURVE":
            metadata["curves"].append(parse_curve_obj(obj))
        elif obj.type == "EMPTY":
            metadata["dummies"].append(parse_dummy_obj(obj))
    for obj in bpy.context.scene.objects:
        if obj.rigid_body is None:
            continue
        parent_body = obj.parent.rigid_body if obj.parent else None
        if parent_body is not None and parent_body.collision_shape == "COMPOUND":
            continue  # exported as a child of the COMPOUND shape instead
        metadata["rigidBodies"].append(get_rigid_body_description(obj))
    return metadata


def export_glb_meta(filepath, export_materials=True, copyright=""):
    """Export whatever is currently loaded in `bpy.context` as a `.glb` + `.meta`
    pair at `filepath` (no extension - `.glb`/`.meta` are appended). Caller is
    responsible for opening the right `.blend` first (the interactive operator
    doesn't need to - it already has one open; the headless CLI does).
    """
    out_dir = os.path.dirname(filepath)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    metadata = collect_scene_metadata()

    for obj in bpy.context.scene.objects:
        include_in_export = obj.type in ["MESH", "LIGHT", "CURVE"]
        include_in_glb = not obj.hide_render
        obj.select_set(state=include_in_export and include_in_glb)
        if not include_in_export:
            continue
        for modifier in obj.modifiers:
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    bpy.ops.export_scene.gltf(
        export_format="GLB",
        export_copyright=copyright,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT" if export_materials else "NONE",
        export_cameras=False,
        export_lights=True,
        export_extras=True,
        export_yup=False,
        export_apply=False,
        export_animations=False,
        use_selection=True,
        export_skins=False,
        export_morph=False,
        filepath=filepath + ".glb",
    )
    with open(filepath + ".meta", "w") as outfile:
        json.dump(metadata, outfile)
