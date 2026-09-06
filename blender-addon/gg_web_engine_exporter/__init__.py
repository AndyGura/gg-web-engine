"""GG Web Engine Exporter - Blender add-on.

Adds `File > Export > GG Web Engine (.glb + .meta)`, exporting the current scene
to the format read by @gg-web-engine/core's `Gg3dLoader.loadGgGlb` and the `"Glb"`
level-JSON class. See blender-addon/README.md (in the gg-web-engine repo) for
install instructions and the object custom-property conventions this exporter
expects (rigid bodies, empties/dummies, curves).

`bl_info` below is legacy metadata, read by Blender versions older than 4.2 (which
predate the Extensions system and `blender_manifest.toml` next to this file) and
ignored by 4.2+ once a manifest is present - kept in sync by hand since Blender
doesn't derive one from the other.
"""

bl_info = {
    "name": "GG Web Engine Exporter",
    "author": "AndyGura",
    "version": (1, 0, 0),
    "blender": (4, 2, 0),
    "location": "File > Export > GG Web Engine (.glb + .meta)",
    "description": "Export scenes to the .glb + .meta format read by @gg-web-engine/core's GLB loader",
    "doc_url": "https://github.com/AndyGura/gg-web-engine/blob/main/blender-addon/README.md",
    "tracker_url": "https://github.com/AndyGura/gg-web-engine/issues",
    "category": "Import-Export",
}

import bpy

from . import operator


def register():
    bpy.utils.register_class(operator.GG_OT_export_scene)
    bpy.types.TOPBAR_MT_file_export.append(operator.menu_func_export)


def unregister():
    bpy.types.TOPBAR_MT_file_export.remove(operator.menu_func_export)
    bpy.utils.unregister_class(operator.GG_OT_export_scene)


if __name__ == "__main__":
    register()
