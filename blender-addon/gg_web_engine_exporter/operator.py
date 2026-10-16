import os

import bpy
from bpy.props import BoolProperty, EnumProperty, StringProperty
from bpy.types import Operator
from bpy_extras.io_utils import ExportHelper

from .exporter import export_glb_meta


class GG_OT_export_scene(Operator, ExportHelper):
    """Export the current scene to a format @gg-web-engine/core's loader can read"""

    bl_idname = "export_scene.gg_web_engine"
    bl_label = "Export GG Web Engine Scene"
    bl_options = {"PRESET"}

    filename_ext = ".glb"
    filter_glob: StringProperty(default="*.glb", options={"HIDDEN"})

    # Only one format exists today. This is an EnumProperty rather than a single
    # code path so a future "Level JSON" format (see exporter.py's module
    # docstring) is one more item here plus a dispatch branch in execute() below,
    # not a rework of the operator/UI.
    export_format: EnumProperty(
        name="Format",
        description="Target format for the exported scene",
        items=[
            (
                "GLB_META",
                "GLB + .meta",
                "Binary glTF (.glb) with a JSON sidecar (.meta) carrying rigid bodies, "
                "empties and curves - read by Gg3dLoader.loadGgGlb",
            ),
        ],
        default="GLB_META",
    )
    export_materials: BoolProperty(
        name="Export Materials",
        description="Include materials/textures in the .glb (uncheck to skip textures entirely, "
        "e.g. for a fast collision/layout-only export)",
        default=True,
    )
    export_copyright: StringProperty(
        name="Copyright",
        description="Copyright string embedded in the .glb (glTF asset.copyright field)",
        default="",
    )

    # Vertex data / content switches - see exporter.export_glb_meta's docstring. Defaults
    # match export_glb_meta's (and export_cli.py's).
    export_texcoords: BoolProperty(
        name="UVs",
        description="Write texture coordinates (UV maps)",
        default=True,
    )
    export_normals: BoolProperty(
        name="Normals",
        description="Write vertex normals. Unchecked also drops tangents and stops splitting "
        "vertices by normal (fewer vertices) - for meshes rendered unlit",
        default=True,
    )
    export_tangents: BoolProperty(
        name="Tangents",
        description="Write vertex tangents (needed by normal maps; requires Normals, UVs and a UV map)",
        default=True,
    )
    export_vertex_color: EnumProperty(
        name="Vertex Colors",
        description="Which color attributes to write as COLOR_n",
        items=[
            ("MATERIAL", "Material", "The glTF exporter's default: colors the materials use"),
            ("ACTIVE", "Active", "The active color attribute"),
            ("NONE", "None", "No vertex colors"),
        ],
        default="MATERIAL",
    )
    export_lights: BoolProperty(
        name="Lights",
        description="Write lights (KHR_lights_punctual)",
        default=True,
    )

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "export_format")
        layout.prop(self, "export_materials")
        layout.prop(self, "export_copyright")
        col = layout.column(heading="Include")
        col.prop(self, "export_texcoords")
        col.prop(self, "export_normals")
        sub = col.column()
        sub.active = self.export_normals and self.export_texcoords
        sub.prop(self, "export_tangents")
        col.prop(self, "export_lights")
        layout.prop(self, "export_vertex_color")

    def execute(self, context):
        filepath = os.path.splitext(self.filepath)[0]
        try:
            if self.export_format == "GLB_META":
                export_glb_meta(
                    filepath,
                    export_materials=self.export_materials,
                    copyright=self.export_copyright,
                    export_texcoords=self.export_texcoords,
                    export_normals=self.export_normals,
                    export_tangents=self.export_tangents,
                    export_vertex_color=self.export_vertex_color,
                    export_lights=self.export_lights,
                )
            else:
                raise NotImplementedError(f"Unknown export format {self.export_format}")
        except Exception as exc:  # noqa: BLE001 - surfaced to the user via self.report
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Exported GG scene to {filepath}.glb / {filepath}.meta")
        return {"FINISHED"}


def menu_func_export(self, context):
    self.layout.operator(GG_OT_export_scene.bl_idname, text="GG Web Engine (.glb + .meta)")
