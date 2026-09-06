"""Builds a fixture scene covering every object kind the GG Web Engine Exporter
understands, then exports it - all in one headless Blender process, so there is
no binary `.blend` fixture to keep in sync in the repo.

Usage:
    blender --background --python build_scene.py -- <output-path-without-extension>

Writes `<output-path>.glb` + `<output-path>.meta`, read back by
`../app/test/export-load.e2e.spec.ts` via a real @gg-web-engine/core +
@gg-web-engine/three + @gg-web-engine/rapier3d app. Keep the object names/values
below and the expectations in that spec file in sync - neither reads the other.

Covers:
- a mesh ("ExportedCube") -> should end up as a THREE.Mesh in the loaded scene
- a light ("ExportedLight") -> should end up as a THREE.Light
- an empty ("SpawnPoint") with a custom property -> a `.meta` dummy, not rendered
- a curve ("PatrolPath", POLY spline) with a custom property -> a `.meta` spline
- rigid bodies: a dynamic box, a static sphere, and a compound of two boxes -
  exercises the non-compound path, a second shape kind, and the COMPOUND
  recursion in `exporter.get_rigid_body_description`

Not covered (deliberately, to keep this fixture/test maintainable rather than
exhaustive): CONE/CYLINDER/CAPSULE/CONVEX_HULL/MESH collision shapes, textures/
image materials (avoids needing DOM/canvas polyfills on the Node/three.js side),
and whether the bare POLY curve itself shows up as renderable glTF geometry
(Blender's glTF exporter's handling of a surface-less curve is an edge case
inherited from the exporter's pre-add-on design, not something this fixture
takes a position on).
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "blender-addon", "gg_web_engine_exporter"))
import exporter  # noqa: E402


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # --- mesh ---
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
    cube = bpy.context.object
    cube.name = "ExportedCube"

    # --- light ---
    bpy.ops.object.light_add(type="POINT", location=(0, 0, 5))
    light = bpy.context.object
    light.name = "ExportedLight"
    light.data.energy = 1000

    # --- empty / dummy ---
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(3, 0, 0))
    spawn_point = bpy.context.object
    spawn_point.name = "SpawnPoint"
    spawn_point["tag"] = "spawn"

    # --- curve / spline (POLY, not BEZIER - exporter.parse_curve_obj reads
    # spline.points, which only NURBS/POLY splines populate) ---
    curve_data = bpy.data.curves.new("PatrolPathCurve", type="CURVE")
    curve_data.dimensions = "3D"
    spline = curve_data.splines.new("POLY")
    points = [(-2.0, 0.0, 0.0), (0.0, 0.0, 2.0), (2.0, 0.0, 0.0)]
    spline.points.add(len(points) - 1)
    for i, (x, y, z) in enumerate(points):
        spline.points[i].co = (x, y, z, 1.0)
    spline.use_cyclic_u = False
    patrol_path = bpy.data.objects.new("PatrolPath", curve_data)
    bpy.context.collection.objects.link(patrol_path)
    patrol_path["speed"] = 2.5

    # --- rigid bodies ---
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-3, 0, 1))
    phys_box = bpy.context.object
    phys_box.name = "PhysBox"
    bpy.context.view_layer.objects.active = phys_box
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    phys_box.rigid_body.collision_shape = "BOX"
    phys_box.rigid_body.mass = 2.0
    phys_box.rigid_body.friction = 0.5
    phys_box.rigid_body.restitution = 0.3

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(-1, 0, 1))
    phys_ball = bpy.context.object
    phys_ball.name = "PhysBall"
    bpy.context.view_layer.objects.active = phys_ball
    bpy.ops.rigidbody.object_add(type="PASSIVE")
    phys_ball.rigid_body.collision_shape = "SPHERE"

    # Compound parent: a mesh (rigid body needs geometry to attach to), hidden
    # from render so it doesn't also show up as a glTF mesh node - the .meta
    # rigidBodies walk isn't gated on hide_render, only the glTF export selection is.
    bpy.ops.mesh.primitive_cube_add(size=0.01, location=(1, 0, 1))
    phys_compound = bpy.context.object
    phys_compound.name = "PhysCompound"
    phys_compound.hide_render = True
    bpy.context.view_layer.objects.active = phys_compound
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    phys_compound.rigid_body.collision_shape = "COMPOUND"

    for suffix, offset in (("A", -0.3), ("B", 0.3)):
        bpy.ops.mesh.primitive_cube_add(size=0.5, location=(1, offset, 1))
        child = bpy.context.object
        child.name = f"CompoundChild{suffix}"
        child.parent = phys_compound
        child.matrix_parent_inverse = phys_compound.matrix_world.inverted()
        bpy.context.view_layer.objects.active = child
        bpy.ops.rigidbody.object_add(type="ACTIVE")
        child.rigid_body.collision_shape = "BOX"


def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    if len(argv) != 1:
        print(__doc__)
        sys.exit(1)
    out_path = os.path.abspath(argv[0])

    build_scene()
    exporter.export_glb_meta(out_path, export_materials=True)
    print(f"Exported fixture to {out_path}.glb / {out_path}.meta")


if __name__ == "__main__":
    main()
