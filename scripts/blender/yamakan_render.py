# SPDX-License-Identifier: GPL-3.0-or-later
# Yamakan's only Blender script (Blender integration, first slice). The Blender worker runs
# this file and nothing else: it reads one scene description (core/blender/scene.ts,
# format "yamakan.blender-scene/1"), builds the scene from it and renders PNG frames with
# Cycles on the CPU. It never runs code from the scene, the project or the person.
#
#   blender -b --factory-startup -Y --offline-mode -noaudio -t <threads> \
#     --python yamakan_render.py -- <scene.json> <output folder> <models folder> <plate folder>
#
# The plate folder holds the tracked footage when the scene has a plate (match-move), as one
# clip.<ext>, or nothing. Both folders are read, never written.
# The models folder holds the 3D models the scene names, as <sha256>.glb: copies the worker has
# hashed and checked (core/cinema/glb.ts), which this script can read but not write.
import json
import math
import os
import re
import sys

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

FORMAT = "yamakan.blender-scene/1"


def fail(message):
    print("YAMAKAN_RENDER_ERROR " + message)
    sys.exit(2)


def number(value, low, high, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        fail(name + " is not a number")
    if not (low <= value <= high) or value != value:
        fail(name + " is out of range")
    return float(value)


def integer(value, low, high, name):
    if isinstance(value, bool) or not isinstance(value, int) or not (low <= value <= high):
        fail(name + " is not a whole number in range")
    return value


def vec3(value, low, high, name):
    if not isinstance(value, dict) or set(value) != {"x", "y", "z"}:
        fail(name + " is not a vector")
    return [number(value[k], low, high, name) for k in ("x", "y", "z")]


def colour(value, name):
    if not isinstance(value, str) or len(value) != 7 or value[0] != "#":
        fail(name + " is not a colour")
    try:
        return [int(value[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    except ValueError:
        fail(name + " is not a colour")


# The scene's coordinates are three.js's (Y up); Blender's world is Z up. A quarter turn about X
# takes one to the other, and every transform passes through it whole.
Y_UP_TO_Z_UP = Matrix.Rotation(math.radians(90), 4, "X")
# The world the scene's coordinates are placed into: Blender's Z up, or, over tracked footage,
# the solve's own frame (the first tracked camera's: Y up, looking down -Z), as it is.
WORLD = [Y_UP_TO_Z_UP]


def transform(position, rotation, scale):
    # three.js Euler "XYZ" is the matrix Rx·Ry·Rz, which is Blender's "ZYX".
    r = Euler(rotation, "ZYX").to_matrix().to_4x4()
    s = Matrix.Diagonal((*scale, 1.0))
    return WORLD[0] @ (Matrix.Translation(position) @ r @ s)


def point(p):
    return (WORLD[0] @ Vector((*p, 1.0))).xyz


def place(obj, root, position, rotation, scale):
    """Puts an object under the world's parent with its own position, turn (the scene's order:
    three.js "XYZ" is Blender's "ZYX") and size, exactly as transform() would place it."""
    obj.parent = root
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.rotation_mode = "ZYX"
    obj.location = position
    obj.rotation_euler = Euler(rotation, "ZYX")
    obj.scale = scale


def animate(obj, item, frames, name):
    """Moves a placed object from its own pose (frame 1) to the item's motion (the last frame),
    easing in and out (Blender's default keyframes). The values are the scene's own, keyframed
    as given: a turn of two full turns is two full turns."""
    if "motion" not in item:
        return
    m = item["motion"]
    if not isinstance(m, dict) or set(m) != {"position", "rotation", "scale"}:
        fail(name + "'s motion is not as described")
    position = vec3(m["position"], -1000, 1000, name + " motion position")
    rotation = vec3(m["rotation"], -4 * math.pi, 4 * math.pi, name + " motion rotation")
    scale = vec3(m["scale"], 0.001, 100, name + " motion scale")
    if frames < 2:
        return
    for path in ("location", "rotation_euler", "scale"):
        obj.keyframe_insert(data_path=path, frame=1)
    obj.location = position
    obj.rotation_euler = Euler(rotation, "ZYX")
    obj.scale = scale
    for path in ("location", "rotation_euler", "scale"):
        obj.keyframe_insert(data_path=path, frame=frames)


DIGEST = re.compile(r"[a-f0-9]{64}")


def import_model(path, name):
    """Imports one checked .glb and returns an empty holding it, fitted to a 1 m box at the
    origin in the scene's own (Y up) frame, so it is placed exactly like a 1 m box."""
    before = set(bpy.data.objects)
    # Every option the importer takes that could reach further is set here, not left to its
    # defaults: no extra texture decoders, no custom properties from the file, nothing beyond
    # the objects themselves.
    result = bpy.ops.import_scene.gltf(
        filepath=path,
        import_pack_images=True,
        merge_vertices=False,
        import_shading="NORMALS",
        import_webp_texture=False,
        import_ktx_texture=False,
        import_unused_materials=False,
        import_select_created_objects=False,
        import_scene_extras=False,
        import_scene_as_collection=False,
        import_merge_material_slots=True,
        import_point_as_pointcloud=False,
    )
    if result != {"FINISHED"}:
        fail("a 3D model could not be imported")
    created = [o for o in bpy.data.objects if o not in before]
    # Only meshes and the empties that group them; the check has already refused cameras,
    # lights and skins, and nothing else is kept even so.
    for o in [o for o in created if o.type not in ("MESH", "EMPTY")]:
        bpy.data.objects.remove(o, do_unlink=True)
    kept = set(created)
    created = [o for o in bpy.data.objects if o in kept]
    kept = set(created)
    meshes = [o for o in created if o.type == "MESH"]
    if not meshes:
        fail("a 3D model holds no mesh")
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    low = Vector([min(c[i] for c in corners) for i in range(3)])
    high = Vector([max(c[i] for c in corners) for i in range(3)])
    extent = max(high - low)
    if not all(math.isfinite(v) for v in (*low, *high, extent)) or not extent > 0:
        fail("a 3D model has no finite size")
    # The importer has already turned glTF's Y up into Blender's Z up; this turns it back, so
    # the empty's own transform (from the scene) does the one conversion, as for a box.
    fit = (
        Y_UP_TO_Z_UP.inverted()
        @ Matrix.Scale(1.0 / extent, 4)
        @ Matrix.Translation(-(low + high) / 2)
    )
    holder = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(holder)
    for o in created:
        if o.parent is None or o.parent not in kept:
            world = o.matrix_world.copy()
            o.parent = holder
            o.matrix_parent_inverse = Matrix.Identity(4)
            o.matrix_basis = fit @ world
    return holder


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 4:
        fail("usage: -- <scene.json> <output folder> <models folder> <plate folder>")
    scene_path, out, models, plates = args
    if not os.path.isdir(out):
        fail("the output folder does not exist")
    if not os.path.isdir(models):
        fail("the models folder does not exist")
    if not os.path.isdir(plates):
        fail("the plate folder does not exist")
    with open(scene_path, "r", encoding="utf-8") as f:
        text = f.read(4 * 1024 * 1024 + 1)
    if len(text) > 4 * 1024 * 1024:
        fail("the scene description is too large")
    s = json.loads(text)
    if not isinstance(s, dict) or s.get("format") != FORMAT:
        fail("not a " + FORMAT + " scene")

    width = integer(s["width"], 64, 1280, "width")
    height = integer(s["height"], 64, 720, "height")
    fps = integer(s["fps"], 24, 30, "fps")
    frames = integer(s["frames"], 1, 120, "frames")
    samples = integer(s["samples"], 1, 32, "samples")
    objects = s["objects"]
    if not isinstance(objects, list) or len(objects) > 200:
        fail("objects is not a list of at most 200")

    # Tracked footage (match-move): a solved camera for every frame, checked here as in the
    # service, and the one clip in the plate folder.
    plate = s.get("plate")
    plate_clip = None
    plate_cameras = []
    if plate is not None:
        if not isinstance(plate, dict) or set(plate) != {
            "focalLengthMm",
            "sensorWidthMm",
            "width",
            "height",
            "cameras",
        }:
            fail("the plate is not as described")
        plate_focal = number(plate["focalLengthMm"], 1, 1000, "plate focal length")
        plate_sensor = number(plate["sensorWidthMm"], 1, 100, "plate sensor width")
        plate_width = integer(plate["width"], 16, 8192, "plate width")
        plate_height = integer(plate["height"], 16, 8192, "plate height")
        cams = plate["cameras"]
        if not isinstance(cams, list) or len(cams) != frames:
            fail("the plate has not one solved camera for every frame")
        for i, m in enumerate(cams):
            if not isinstance(m, list) or len(m) != 16:
                fail("plate camera " + str(i) + " is not a 4 x 4 matrix")
            values = [number(v, -1e6, 1e6, "plate camera") for v in m]
            plate_cameras.append(Matrix([values[0:4], values[4:8], values[8:12], values[12:16]]))
        names = os.listdir(plates)
        if len(names) != 1 or not names[0].startswith("clip."):
            fail("the plate folder does not hold one clip")
        # Decoded footage is cached within a bound well inside the worker's memory.
        bpy.context.preferences.system.memory_cache_limit = 1024
        plate_clip = bpy.data.movieclips.load(os.path.join(plates, names[0]))
        if plate_clip.frame_duration < frames:
            fail("the footage is shorter than the render")
        if (plate_clip.size[0], plate_clip.size[1]) != (plate_width, plate_height):
            fail("the footage is not the size it was tracked at")
        WORLD[0] = Matrix.Identity(4)
    if sum(1 for o in objects if isinstance(o, dict) and o.get("shape") == "model") > 8:
        fail("a render holds at most 8 3D models")

    scene = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)

    # The world: one background colour.
    world = bpy.data.worlds.new("yamakan")
    scene.world = world
    bg = colour(s["background"], "background")
    if world.node_tree is None:
        world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs[0].default_value = (*bg, 1.0)
    world.color = bg

    # The surface: plain (flat colours) or detail (a ground, and fine non-repeating detail on it
    # and on every box, each box's colour kept).
    surface = s.get("surface", "plain")
    if surface not in ("plain", "detail"):
        fail("surface is not plain or detail")
    def detail_group(name, travels):
        group = bpy.data.node_groups.new(name, "ShaderNodeTree")
        group.interface.new_socket("Shade", in_out="OUTPUT", socket_type="NodeSocketColor")
        out_node = group.nodes.new("NodeGroupOutput")
        # Laid out in the world, in metres: equally fine on the ground and on a box of any size
        # or scale, and fixed in place while the camera moves (as tracking needs); on a moving
        # box, in its own coordinates, so it travels with the box. Three octaves, so it does not
        # shimmer at low sample counts.
        noise = group.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 4.0
        noise.inputs["Detail"].default_value = 3.0
        if travels:
            coords = group.nodes.new("ShaderNodeTexCoord")
            group.links.new(coords.outputs["Object"], noise.inputs["Vector"])
        else:
            geometry = group.nodes.new("ShaderNodeNewGeometry")
            group.links.new(geometry.outputs["Position"], noise.inputs["Vector"])
        ramp = group.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.45
        ramp.color_ramp.elements[0].color = (0.3, 0.3, 0.3, 1.0)
        ramp.color_ramp.elements[1].position = 0.55
        ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
        group.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        group.links.new(ramp.outputs["Color"], out_node.inputs[0])
        return group

    detail = None
    moving_detail = None
    if surface == "detail":
        detail = detail_group("yamakan-detail", False)
        moving_detail = detail_group("yamakan-detail-moving", True)

    def surfaced(material, rgb, moving=False):
        # The colour as it is, or multiplied by the detail.
        material.diffuse_color = (*rgb, 1.0)
        tree = material.node_tree
        principled = tree.nodes.get("Principled BSDF") if tree is not None else None
        if principled is None:
            if detail is not None:
                fail("a material has no shader to carry the detail")
            return
        principled.inputs["Base Color"].default_value = (*rgb, 1.0)
        if detail is None:
            return
        shade = tree.nodes.new("ShaderNodeGroup")
        shade.node_tree = moving_detail if moving else detail
        mix = tree.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        # The mix node has a float, a vector and a colour socket of each name: the colour ones.
        colours = [i for i in mix.inputs if i.type == "RGBA"]
        factor = [i for i in mix.inputs if i.name == "Factor" and i.type == "VALUE"][0]
        factor.default_value = 1.0
        colours[0].default_value = (*rgb, 1.0)
        tree.links.new(shade.outputs[0], colours[1])
        result = [o for o in mix.outputs if o.type == "RGBA"][0]
        tree.links.new(result, principled.inputs["Base Color"])

    if detail is not None:
        # The ground: the scene's floor (y = 0, Blender's z = 0), 2 km across so no edge shows
        # however far the boxes spread, a light grey with the detail. It hides anything below
        # the floor.
        bpy.ops.mesh.primitive_plane_add(size=2000)
        ground = bpy.context.active_object
        ground.name = "ground"
        ground_material = bpy.data.materials.new("ground")
        surfaced(ground_material, [0.6, 0.6, 0.6])
        ground.data.materials.append(ground_material)

    # Boxes, each with its own colour, and 3D models with their own materials.
    # One parent carries the world's turn (Y up to Blender's Z up, or the solve's frame as it
    # is); every object hangs under it with its own position, turn and size.
    root = bpy.data.objects.new("yamakan-world", None)
    scene.collection.objects.link(root)
    root.matrix_world = WORLD[0]
    for i, item in enumerate(objects):
        if not isinstance(item, dict) or item.get("shape") not in ("box", "model"):
            fail("object " + str(i) + " is not a box or a model")
        position = vec3(item["position"], -1000, 1000, "position")
        rotation = vec3(item["rotation"], -4 * math.pi, 4 * math.pi, "rotation")
        scale = vec3(item["scale"], 0.001, 100, "scale")
        if item["shape"] == "model":
            if not {"shape", "model", "position", "rotation", "scale"} <= set(item) <= {
                "shape",
                "model",
                "position",
                "rotation",
                "scale",
                "motion",
            }:
                fail("object " + str(i) + " is not a model as described")
            digest = item["model"]
            if not isinstance(digest, str) or not DIGEST.fullmatch(digest):
                fail("object " + str(i) + " names no model")
            path = os.path.join(models, digest + ".glb")
            if not os.path.isfile(path):
                fail("a 3D model the scene names was not provided")
            holder = import_model(path, "model-" + str(i))
            place(holder, root, position, rotation, scale)
            animate(holder, item, frames, "object " + str(i))
            continue
        rgb = colour(item["colour"], "colour")
        bpy.ops.mesh.primitive_cube_add(size=1)
        box = bpy.context.active_object
        box.name = "box-" + str(i)
        place(box, root, position, rotation, scale)
        animate(box, item, frames, "object " + str(i))
        material = bpy.data.materials.new("box-" + str(i))
        surfaced(material, rgb, moving="motion" in item)
        box.data.materials.append(material)

    # The camera: its lens, where it starts, and how it moves over the shot: around what it looks
    # at (orbit), toward or away from it (dolly), turning where it stands (pan), and a steady
    # handheld sway (shake). Every move is a fixed function of the frame: the same scene, the
    # same shot.
    c = s["camera"]
    start = vec3(c["position"], -1000, 1000, "camera position")
    target = point(vec3(c["target"], -1000, 1000, "camera target"))
    orbit = math.radians(number(c["orbitDegrees"], -360, 360, "orbit"))
    dolly = number(c.get("dolly", 0), -0.9, 0.9, "dolly")
    pan = math.radians(number(c.get("panDegrees", 0), -90, 90, "pan"))
    shake = number(c.get("shake", 0), 0, 0.1, "shake")
    lens = bpy.data.cameras.new("yamakan")
    lens.sensor_fit = "HORIZONTAL"
    lens.sensor_width = number(c["sensorWidthMm"], 1, 1000, "sensor width")
    lens.lens = number(c["focalLengthMm"], 1, 10000, "focal length")
    lens.clip_start = 0.05
    lens.clip_end = 5000
    camera = bpy.data.objects.new("camera", lens)
    scene.collection.objects.link(camera)
    scene.camera = camera
    first = point(start)
    reach = max(0.001, (target - first).length)
    for frame in range(1, frames + 1):
        t = (frame - 1) / max(1, frames - 1)
        turn = Matrix.Translation(target) @ Matrix.Rotation(orbit * t, 4, "Z") @ Matrix.Translation(-target)
        where = (turn @ Vector((*first, 1.0))).xyz
        # Toward the target (or away), a share of the way over the shot.
        if dolly != 0:
            where = target + (where - target) * (1.0 - dolly * t)
        # A hand's sway: slow waves of about one a second, in seconds rather than frames, so the
        # same at 24 and 30 fps; the same every time; within shake x the distance.
        seconds = (frame - 1) / fps
        wave = lambda hz, phase: math.sin(2 * math.pi * hz * seconds + phase)
        if shake > 0:
            sway = shake * reach
            where = where + Vector((
                sway * 0.6 * wave(0.7, 0.4),
                sway * 0.6 * wave(0.5, 1.1),
                sway * 0.4 * wave(1.1, 2.0),
            ))
        # Aimed at the target, then turned where it stands: from one side to the other, centred
        # on the target halfway through (a one-frame shot looks straight at it).
        aim = (target - where).to_track_quat("-Z", "Y")
        if pan != 0 and frames > 1:
            aim = Quaternion((0.0, 0.0, 1.0), pan * (t - 0.5)) @ aim
        # A hand also wavers the aim a little, side to side and up and down.
        if shake > 0:
            aim = Quaternion((0.0, 0.0, 1.0), shake * 1.2 * wave(0.6, 0.7)) @ aim
            aim = aim @ Quaternion((1.0, 0.0, 0.0), shake * 0.8 * wave(0.9, 1.5))
        camera.location = where
        camera.rotation_euler = aim.to_euler()
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)

    # Over footage, the camera is the solve's for every frame instead.
    if plate_clip is not None:
        # The lens the footage was solved with.
        lens.lens = plate_focal
        lens.sensor_width = plate_sensor
        camera.animation_data_clear()
        for frame, m in enumerate(plate_cameras, start=1):
            camera.matrix_world = m
            camera.keyframe_insert(data_path="location", frame=frame)
            camera.keyframe_insert(data_path="rotation_euler", frame=frame)

    # One sun.
    l = s["light"]
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", type="SUN"))
    sun.data.energy = number(l["strength"], 0, 20, "light strength")
    sun.data.color = colour(l.get("colour", "#ffffff"), "light colour")
    sun.rotation_euler = vec3(l["rotation"], -4 * math.pi, 4 * math.pi, "light rotation")
    scene.collection.objects.link(sun)

    # The finish: a glow, a vignette and a lens's colour fringe, made by the compositor on every
    # frame. With all three at 0 no compositor is set up at all, as before there was a finish.
    f = s.get("finish", {})
    if not isinstance(f, dict):
        fail("finish is not an object")
    glow = number(f.get("glow", 0), 0, 1, "glow")
    vignette = number(f.get("vignette", 0), 0, 1, "vignette")
    dispersion = number(f.get("dispersion", 0), 0, 0.1, "dispersion")
    if glow > 0 or vignette > 0 or dispersion > 0:
        tree = bpy.data.node_groups.new("yamakan-finish", "CompositorNodeTree")
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        nodes, links = tree.nodes, tree.links
        image = nodes.new("CompositorNodeRLayers").outputs["Image"]
        if glow > 0:
            g = nodes.new("CompositorNodeGlare")
            # Bloom from the lit parts upward (a threshold under the boxes' light), its spread
            # wide and its strength the glow chosen.
            g.inputs["Type"].default_value = "Bloom"
            g.inputs["Threshold"].default_value = 0.25
            g.inputs["Smoothness"].default_value = 0.5
            g.inputs["Strength"].default_value = glow
            links.new(image, g.inputs["Image"])
            image = g.outputs["Image"]
        if dispersion > 0:
            d = nodes.new("CompositorNodeLensdist")
            d.inputs["Dispersion"].default_value = dispersion
            links.new(image, d.inputs["Image"])
            image = d.outputs["Image"]
        if vignette > 0:
            mask = nodes.new("CompositorNodeEllipseMask")
            mask.inputs["Size"].default_value = (0.9, 0.9)
            soft = nodes.new("CompositorNodeBlur")
            edge = max(2, int(width * 0.25))
            soft.inputs["Size"].default_value = (edge, edge)
            links.new(mask.outputs["Mask"], soft.inputs["Image"])
            mix = nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            colour_inputs = [i for i in mix.inputs if i.type == "RGBA"]
            factor = [i for i in mix.inputs if i.name == "Factor" and i.type == "VALUE"][0]
            factor.default_value = vignette
            links.new(image, colour_inputs[0])
            links.new(soft.outputs["Image"], colour_inputs[1])
            image = [o for o in mix.outputs if o.type == "RGBA"][0]
        links.new(image, nodes.new("NodeGroupOutput").inputs[0])
        scene.compositing_node_group = tree

    # Over footage: the render, with nothing behind its objects, over the clip's frame at the
    # same index, scaled to the render's size. (A plate has no finish; the service refuses both.)
    if plate_clip is not None:
        if glow > 0 or vignette > 0 or dispersion > 0:
            fail("a render over footage has no finish")
        tree = bpy.data.node_groups.new("yamakan-plate", "CompositorNodeTree")
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        nodes, links = tree.nodes, tree.links
        layers = nodes.new("CompositorNodeRLayers")
        footage = nodes.new("CompositorNodeMovieClip")
        footage.clip = plate_clip
        fit = nodes.new("CompositorNodeScale")
        fit.inputs["Type"].default_value = "Render Size"
        links.new(footage.outputs["Image"], fit.inputs["Image"])
        # Footage with its own transparency is laid on black first, so the frame stays opaque.
        under = nodes.new("CompositorNodeAlphaOver")
        under_colours = [i for i in under.inputs if i.type == "RGBA"]
        under_colours[0].default_value = (0.0, 0.0, 0.0, 1.0)
        links.new(fit.outputs["Image"], under_colours[1])
        over = nodes.new("CompositorNodeAlphaOver")
        colours = [i for i in over.inputs if i.type == "RGBA"]
        links.new(under.outputs["Image"], colours[0])
        links.new(layers.outputs["Image"], colours[1])
        links.new(over.outputs["Image"], nodes.new("NodeGroupOutput").inputs[0])
        scene.compositing_node_group = tree

    # Cycles on the CPU, PNG frames into the output folder only.
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    scene.render.fps_base = 1.0
    scene.frame_start = 1
    scene.frame_end = frames
    # Over footage nothing is drawn behind the objects: the footage is.
    scene.render.film_transparent = plate_clip is not None
    # Colours as the project gives them (Blender's default view would tone them).
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = os.path.join(out, "frame_")
    bpy.ops.render.render(animation=True)

    with open(os.path.join(out, "receipt.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "format": "yamakan.blender-receipt/1",
                "blender": bpy.app.version_string,
                "frames": frames,
                "width": width,
                "height": height,
                "online": bool(bpy.app.online_access),
            },
            f,
        )
    print("YAMAKAN_RENDER_DONE")


try:
    main()
except SystemExit:
    raise
except Exception as e:  # Any other failure ends the worker plainly, without a trace of paths.
    print("YAMAKAN_RENDER_ERROR " + type(e).__name__)
    sys.exit(2)
