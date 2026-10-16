"""Headless/CI batch export.

Usage:
    blender --background --python scripts/export_cli.py -- file1.blend [file2.blend ...] [options]

Options (defaults match the add-on's export panel; see `exporter.export_glb_meta`):
    --skip-textures              no materials/textures
    --no-texcoords               no UV maps (TEXCOORD_n), and so no TANGENT
    --no-normals                 no NORMAL (also no TANGENT, vertices no longer split by normal)
    --no-tangents                no TANGENT
    --vertex-color MODE          MATERIAL (default), ACTIVE or NONE
    --no-lights                  no lights
    -h, --help                   print this text

Imports `exporter.py` straight from the add-on folder next to this script, so a
pipeline just needs a checkout of this repo (or a copy of `blender-addon/`) - the
add-on does not need to be installed/registered first. This is the same module
the interactive `File > Export` operator calls, so a batch/CI export can't drift
from what an artist gets manually - if your project used to vendor a copy of the
old `build_blender_scene.py` script, point it at this file instead of copying
exporter.py again.
"""
import argparse
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gg_web_engine_exporter"))
import exporter  # noqa: E402  (must follow the sys.path insert above)

USAGE = "blender --background --python export_cli.py -- file1.blend [file2.blend ...] [options]"


def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    # argparse's own --help would list the flags without the descriptions the module
    # docstring already has, so -h/--help prints that instead.
    parser = argparse.ArgumentParser(prog="export_cli.py", usage=USAGE, add_help=False)
    parser.add_argument("files", nargs="*")
    parser.add_argument("-h", "--help", action="store_true")
    parser.add_argument("--skip-textures", action="store_true")
    parser.add_argument("--no-texcoords", action="store_true")
    parser.add_argument("--no-normals", action="store_true")
    parser.add_argument("--no-tangents", action="store_true")
    parser.add_argument("--vertex-color", choices=exporter.VERTEX_COLOR_MODES, default="MATERIAL")
    parser.add_argument("--no-lights", action="store_true")
    args = parser.parse_intermixed_args(argv)
    if args.help:
        print(__doc__)
        sys.exit(0)
    if not args.files:
        print(__doc__)
        sys.exit(1)

    for blend_path in args.files:
        blend_path = os.path.abspath(blend_path)
        bpy.ops.wm.open_mainfile(filepath=blend_path)
        out_path = os.path.splitext(blend_path)[0]
        exporter.export_glb_meta(
            out_path,
            export_materials=not args.skip_textures,
            export_texcoords=not args.no_texcoords,
            export_normals=not args.no_normals,
            export_tangents=not args.no_tangents,
            export_vertex_color=args.vertex_color,
            export_lights=not args.no_lights,
        )
        print(f"Exported {out_path}.glb / {out_path}.meta")


if __name__ == "__main__":
    main()
