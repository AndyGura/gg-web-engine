"""Generates a pixel-art character sprite atlas: idle/walk/run/jump/crouch rows on a uniform grid.

Logical drawing grid is small (chunky pixel-art look), then upscaled with NEAREST to the final
per-frame size and composited into one atlas PNG, one row per animation clip.
"""
import math
import os
from PIL import Image

# ---- logical grid ----
LW, LH = 16, 24  # logical width/height of one frame
SCALE = 3
FW, FH = LW * SCALE, LH * SCALE

COLS = 6
ROWS = ["idle", "walk", "run", "jump", "crouch"]

SKIN = (235, 188, 148, 255)
HAIR = (86, 58, 42, 255)
SHIRT = (66, 135, 198, 255)
SHIRT_DARK = (48, 103, 156, 255)
PANTS = (72, 74, 94, 255)
PANTS_DARK = (52, 54, 70, 255)
SHOE = (35, 33, 38, 255)
EYE = (25, 22, 26, 255)
BG = (0, 0, 0, 0)


def rect(px, x, y, w, h, color):
    """Fill a logical-pixel rectangle [x, x+w) x [y, y+h) on the logical canvas `px`."""
    for yy in range(y, y + h):
        if yy < 0 or yy >= LH:
            continue
        for xx in range(x, x + w):
            if xx < 0 or xx >= LW:
                continue
            px[xx, yy] = color


def shade_bottom_edge(px, x, y, w, h, color):
    """One darker logical-pixel row along a rect's bottom edge - cheap pixel-art shading."""
    yy = y + h - 1
    if 0 <= yy < LH:
        for xx in range(x, x + w):
            if 0 <= xx < LW:
                px[xx, yy] = color


def draw_frame(pose):
    """pose: dict with body-part offsets/lengths for this single frame, see callers below."""
    img = Image.new("RGBA", (LW, LH), BG)
    px = img.load()

    bob = pose.get("bob", 0)  # top-of-body vertical offset (head/torso/arms)
    # legs' own vertical offset - defaults to `bob` so a whole-body bounce (walk/run/jump) still
    # moves the legs too; idle passes `leg_bob=0` explicitly so only the top of the body breathes
    # while the legs/feet stay planted at a constant Y (a uniform `bob` there reads as a hop/jump).
    leg_bob = pose.get("leg_bob", bob)
    lean = pose.get("lean", 0)  # whole-body horizontal offset (torso/head), for running

    head_x = 5 + lean
    head_y = 1 + bob
    torso_x = 5 + lean
    torso_y = 7 + bob
    torso_h = pose.get("torso_h", 8)  # shorter for a hunched/crouched silhouette

    # legs: independent x-offset (stride) and vertical "lift" (shortens the leg, foot off ground).
    # `leg_top` sits `torso_h` below the *leg_bob*-based torso top (rather than the top's own bob)
    # so a shortened `torso_h` (crouching) still pulls the legs up to meet it with no gap, without
    # coupling leg position to a top-of-body breathing bob that isn't meant to move the legs.
    l_off, l_lift = pose["left_leg"]
    r_off, r_lift = pose["right_leg"]
    leg_top = 7 + leg_bob + torso_h
    leg_h = 9 - l_lift
    rleg_h = 9 - r_lift

    # arms: x-offset (swing) and a raised flag (shoulders-up "cheer" pose for jump apex)
    l_arm_off, l_arm_up = pose["left_arm"]
    r_arm_off, r_arm_up = pose["right_arm"]

    # legs (drawn first, behind torso overlap at hips)
    rect(px, 5 + l_off, leg_top, 3, leg_h, PANTS)
    shade_bottom_edge(px, 5 + l_off, leg_top, 3, leg_h, PANTS_DARK)
    rect(px, 5 + l_off, leg_top + leg_h - 2, 3, 2, SHOE)

    rect(px, 8 + r_off, leg_top, 3, rleg_h, PANTS)
    shade_bottom_edge(px, 8 + r_off, leg_top, 3, rleg_h, PANTS_DARK)
    rect(px, 8 + r_off, leg_top + rleg_h - 2, 3, 2, SHOE)

    # arms
    arm_y = (torso_y + 1) - (3 if l_arm_up else 0)
    rect(px, 3 + lean + l_arm_off, arm_y, 2, 6, SKIN)
    arm_y2 = (torso_y + 1) - (3 if r_arm_up else 0)
    rect(px, 11 + lean + r_arm_off, arm_y2, 2, 6, SKIN)

    # torso
    rect(px, torso_x, torso_y, 6, torso_h, SHIRT)
    shade_bottom_edge(px, torso_x, torso_y, 6, torso_h, SHIRT_DARK)

    # head + hair
    rect(px, head_x, head_y, 6, 6, SKIN)
    rect(px, head_x, head_y - 1, 6, 2, HAIR)
    # eyes (facing right)
    px[head_x + 4, head_y + 3] = EYE
    px[head_x + 3, head_y + 3] = EYE

    return img.resize((FW, FH), Image.NEAREST)


def idle_frames():
    frames = []
    for i in range(4):
        bob = [0, 1, 0, 1][i]
        frames.append(
            draw_frame(
                dict(
                    bob=bob,
                    leg_bob=0,  # breathing only lifts the chest/head/arms - feet stay put
                    left_leg=(0, 0),
                    right_leg=(0, 0),
                    left_arm=(0, False),
                    right_arm=(0, False),
                )
            )
        )
    return frames


def stride_frames(n, amp, lift_amp, lean, arm_amp):
    frames = []
    for i in range(n):
        phase = 2 * math.pi * i / n
        l_stride = amp * math.sin(phase)
        r_stride = amp * math.sin(phase + math.pi)
        # vertical bob follows a double-frequency wave (two foot-falls per cycle)
        bob = round(abs(math.sin(phase)) * (2 if lean else 1))
        l_lift = round(max(0, math.sin(phase)) * lift_amp)
        r_lift = round(max(0, math.sin(phase + math.pi)) * lift_amp)
        l_arm = round(-r_stride * arm_amp / max(amp, 1))
        r_arm = round(-l_stride * arm_amp / max(amp, 1))
        frames.append(
            draw_frame(
                dict(
                    bob=bob,
                    lean=lean,
                    left_leg=(round(l_stride), l_lift),
                    right_leg=(round(r_stride), r_lift),
                    left_arm=(l_arm, False),
                    right_arm=(r_arm, False),
                )
            )
        )
    return frames


def crouch_frames():
    frames = []
    for i in range(4):
        # bob just large enough that the shortened torso still meets the legs at their normal
        # standing `leg_top` (7 + bob + torso_h == 15, same as idle/walk) - a bigger bob overshoots
        # that and pushes the whole pose (legs included) below the frame, clipping the feet off and
        # reading as "sunk into the floor" relative to the (unchanged) capsule position.
        bob = [2, 3, 2, 3][i]  # small hunched-breathing variation, compact silhouette
        frames.append(
            draw_frame(
                dict(
                    bob=bob,
                    torso_h=5,
                    left_leg=(0, 0),
                    right_leg=(0, 0),
                    left_arm=(0, False),
                    right_arm=(0, False),
                )
            )
        )
    return frames


def jump_frames():
    # crouch, launch, rise, apex, fall, land
    poses = [
        dict(bob=2, left_leg=(0, 2), right_leg=(0, 2), left_arm=(-1, False), right_arm=(-1, False)),
        dict(bob=-1, left_leg=(-1, 0), right_leg=(1, 0), left_arm=(0, True), right_arm=(0, True)),
        dict(bob=-2, left_leg=(0, 3), right_leg=(0, 3), left_arm=(0, True), right_arm=(0, True)),
        dict(bob=-2, left_leg=(-1, 2), right_leg=(1, 2), left_arm=(1, True), right_arm=(-1, True)),
        dict(bob=-1, left_leg=(1, 1), right_leg=(-1, 1), left_arm=(0, False), right_arm=(0, False)),
        dict(bob=1, left_leg=(0, 0), right_leg=(0, 0), left_arm=(0, False), right_arm=(0, False)),
    ]
    return [draw_frame(p) for p in poses]


def main():
    clips = {
        "idle": idle_frames(),
        "walk": stride_frames(6, amp=2, lift_amp=2, lean=0, arm_amp=2),
        "run": stride_frames(6, amp=4, lift_amp=3, lean=1, arm_amp=3),
        "jump": jump_frames(),
        "crouch": crouch_frames(),
    }

    atlas = Image.new("RGBA", (FW * COLS, FH * len(ROWS)), BG)
    for row, name in enumerate(ROWS):
        frames = clips[name]
        for col, frame in enumerate(frames):
            atlas.paste(frame, (col * FW, row * FH), frame)

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "character-atlas.png")
    atlas.save(out_path)
    print("saved", out_path, atlas.size, {k: len(v) for k, v in clips.items()})
    print("frame size", FW, FH)


if __name__ == "__main__":
    main()
