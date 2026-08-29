"""Headless/CI batch export.

Usage:
    blender --background --python scripts/export_cli.py -- file1.blend [file2.blend ...] [--skip-textures]

Imports `exporter.py` straight from the add-on folder next to this script, so a
pipeline just needs a checkout of this repo (or a copy of `blender-addon/`) - the
add-on does not need to be installed/registered first. This is the same module
the interactive `File > Export` operator calls, so a batch/CI export can't drift
from what an artist gets manually - if your project used to vendor a copy of the
old `build_blender_scene.py` script, point it at this file instead of copying
exporter.py again.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gg_web_engine_exporter"))
import exporter  # noqa: E402  (must follow the sys.path insert above)


def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    skip_textures = "--skip-textures" in argv
    files = [a for a in argv if a != "--skip-textures"]
    if not files:
        print(__doc__)
        sys.exit(1)

    for blend_path in files:
        blend_path = os.path.abspath(blend_path)
        bpy.ops.wm.open_mainfile(filepath=blend_path)
        out_path = os.path.splitext(blend_path)[0]
        exporter.export_glb_meta(out_path, export_materials=not skip_textures)
        print(f"Exported {out_path}.glb / {out_path}.meta")


if __name__ == "__main__":
    main()
