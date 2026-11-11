# SPDX-License-Identifier: GPL-3.0-or-later
# Yamakan's camera-tracking script (Blender integration: tracking). The Blender worker runs this
# file and nothing else for a track: it reads one settings file (core/blender/track.ts), loads the
# one video it is given, finds features, follows them through the clip and solves how the camera
# moved, then writes the solved cameras (track.json) and a receipt. It never runs code from the
# video, the project or the person.
#
#   blender -b --factory-startup -Y --offline-mode -noaudio -t <threads> \
#     --python yamakan_track.py -- <settings.json> <video> <output folder>
import json
import math
import os
import sys

import bpy

FORMAT = "yamakan.blender-track/1"
RESULT = "yamakan.camera-track/1"


def fail(message):
    print("YAMAKAN_TRACK_ERROR " + message)
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


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 3:
        fail("usage: -- <settings.json> <video> <output folder>")
    settings_path, video, out = args
    if not os.path.isfile(video):
        fail("the video does not exist")
    if not os.path.isdir(out):
        fail("the output folder does not exist")
    with open(settings_path, "r", encoding="utf-8") as f:
        text = f.read(65537)
    if len(text) > 65536:
        fail("the settings are too large")
    s = json.loads(text)
    if not isinstance(s, dict) or s.get("format") != FORMAT:
        fail("not " + FORMAT + " settings")
    expected = {
        "format",
        "focalLengthMm",
        "sensorWidthMm",
        "maxFrames",
        "maxWidth",
        "maxHeight",
        "maxErrorPixels",
        "minTracks",
    }
    if set(s) != expected:
        fail("the settings are not as described")
    focal = number(s["focalLengthMm"], 1, 1000, "focal length")
    sensor = number(s["sensorWidthMm"], 1, 100, "sensor width")
    max_frames = integer(s["maxFrames"], 10, 720, "most frames")
    max_width = integer(s["maxWidth"], 64, 1920, "widest")
    max_height = integer(s["maxHeight"], 64, 1080, "tallest")
    max_error = number(s["maxErrorPixels"], 0.1, 10, "largest error")
    min_tracks = integer(s["minTracks"], 8, 1000, "fewest tracks")

    # Decoded frames are cached within a bound well inside the worker's memory.
    bpy.context.preferences.system.memory_cache_limit = 1024
    clip = bpy.data.movieclips.load(video)
    frames = clip.frame_duration
    width, height = clip.size[0], clip.size[1]
    # Cleaning drops features followed for fewer than 10 frames, so shorter clips cannot solve.
    if not (10 <= frames <= max_frames):
        fail("the video has " + str(frames) + " frames; tracking takes 10 to " + str(max_frames))
    if not (64 <= width <= max_width and 64 <= height <= max_height):
        fail("the video is " + str(width) + " x " + str(height) + ", larger than tracking takes")
    fps = float(clip.fps) if clip.fps else 24.0
    # Tracking runs over the scene's frame range, which is 1 to 250 after a factory start: the
    # whole clip, then.
    scene = bpy.context.scene
    scene.frame_start = clip.frame_start
    scene.frame_end = clip.frame_start + frames - 1

    tracking = clip.tracking
    settings = tracking.settings
    # Features the size of a small patch, searched for in a wider window, following movement.
    settings.default_pattern_size = 21
    settings.default_search_size = 71
    settings.default_motion_model = "Loc"
    settings.use_keyframe_selection = True
    lens = tracking.camera
    lens.sensor_width = sensor
    lens.focal_length = focal

    # The clip operators need a clip editor; background Blender still has a window, so one of
    # its areas becomes one for the length of this work.
    wm = bpy.context.window_manager
    if not wm.windows:
        fail("Blender has no window to track in")
    window = wm.windows[0]
    screen = window.screen
    area = screen.areas[0]
    area.type = "CLIP_EDITOR"
    space = area.spaces.active
    space.clip = clip
    region = next((r for r in area.regions if r.type == "WINDOW"), None)
    if region is None:
        fail("the clip editor has no region to track in")
    with bpy.context.temp_override(
        window=window,
        screen=screen,
        area=area,
        region=region,
        space_data=space,
        edit_movieclip=clip,
    ):
        spacing = max(12, width // 32)
        if bpy.ops.clip.detect_features(threshold=0.02, min_distance=spacing, margin=16) != {"FINISHED"}:
            fail("features could not be found")
        found = len(tracking.tracks)
        if found < min_tracks:
            fail("only " + str(found) + " features were found; the picture needs more detail")
        bpy.ops.clip.select_all(action="SELECT")
        if bpy.ops.clip.track_markers(backwards=False, sequence=True) != {"FINISHED"}:
            fail("the features could not be followed")
        # A camera that does not move gives the solver nothing to work from, and it would still
        # return cameras that look solved: how far the features travelled is measured first, and
        # a clip whose features barely move is refused.
        moved = []
        for track in tracking.tracks:
            markers = [m for m in track.markers if not m.mute]
            if len(markers) < 2:
                continue
            # The furthest it got from where it started (a camera can move and come back).
            a = markers[0].co
            moved.append(
                max(math.hypot((m.co[0] - a[0]) * width, (m.co[1] - a[1]) * height) for m in markers)
            )
        moved.sort()
        travel = moved[len(moved) // 2] if moved else 0.0
        if travel < 0.02 * width:
            fail(
                "the camera does not move enough to be solved (the features moved "
                + format(travel, ".1f")
                + " px)"
            )
        try:
            bpy.ops.clip.solve_camera()
            # Features the first solve could not place well are dropped, and the camera solved again.
            bpy.ops.clip.clean_tracks(frames=10, error=max_error, action="DELETE_TRACK")
            bpy.ops.clip.solve_camera()
        except RuntimeError as e:
            reason = str(e).replace("Error:", "").strip().splitlines()[0][:100]
            fail("the camera could not be solved: " + reason)

    reconstruction = tracking.reconstruction
    if not reconstruction.is_valid:
        fail("the camera could not be solved")
    error = float(reconstruction.average_error)
    if not math.isfinite(error) or error > max_error:
        fail("the solve is not good enough (" + format(error, ".2f") + " px on average)")
    # Features the solve actually placed in 3D, not every track left.
    kept = sum(1 for t in tracking.tracks if t.has_bundle)
    if kept < min_tracks:
        fail("too few features were placed by the solve (" + str(kept) + ")")
    cameras = []
    for camera in reconstruction.cameras:
        values = [float(v) for row in camera.matrix for v in row]
        if not all(math.isfinite(v) and abs(v) <= 1e6 for v in values):
            fail("a solved camera is out of range")
        cameras.append({"frame": int(camera.frame), "matrix": values})
    # Most of the clip, not a piece of it: a solve that lost the camera part way is refused.
    if len(cameras) < max(2, math.ceil(0.8 * frames)):
        fail(
            "the camera was solved for only "
            + str(len(cameras))
            + " of "
            + str(frames)
            + " frames"
        )
    target = tracking.objects.active

    with open(os.path.join(out, "track.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "format": RESULT,
                "width": width,
                "height": height,
                "fps": fps,
                "frames": frames,
                "lens": {"focalLengthMm": focal, "sensorWidthMm": sensor},
                "tracks": kept,
                "averageErrorPixels": error,
                "keyframes": [int(target.keyframe_a), int(target.keyframe_b)],
                "cameras": cameras,
            },
            f,
        )
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
    print("YAMAKAN_TRACK_DONE")


main()
