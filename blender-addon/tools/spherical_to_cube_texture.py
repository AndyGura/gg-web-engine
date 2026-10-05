import os
import sys

import numpy as np
from PIL import Image

# The faces are cut out of a horizontal-cross layout of the cube, 4 faces wide and 3 high. Each
# entry is (file suffix, column, row, counter-clockwise turn in degrees). The turn gives the
# orientation the engine's `loadCubeTexture` expects: side faces upright (top edge towards +Z), top
# edge of `pz` towards +Y and of `nz` towards -Y. The sides are already upright in the cross.
FACES = [
    ("ny", 0, 1, 0),
    ("nx", 1, 1, 0),
    ("py", 2, 1, 0),
    ("px", 3, 1, 0),
    ("pz", 2, 0, 180),
    ("nz", 2, 2, 180),
]


# direction each pixel of a cross face looks in; `a`/`b` are the pixel's cross coordinates in
# units of half an edge
def face_directions(col, row, a, b):
    one = np.ones_like(a)
    if row == 0:  # top
        return b - 1.0, a - 5.0, one
    if row == 2:  # bottom
        return 5.0 - b, a - 5.0, -one
    if col == 0:  # back
        return -one, 1.0 - a, 3.0 - b
    if col == 1:  # left
        return a - 3.0, -one, 3.0 - b
    if col == 2:  # front
        return one, a - 5.0, 3.0 - b
    return 7.0 - a, one, 3.0 - b  # right


# renders one cube face from the equirectangular image `src` (height x width x 3, float)
def render_face(src, edge, col, row):
    height, width = src.shape[:2]
    i, j = np.meshgrid(
        np.arange(col * edge, (col + 1) * edge, dtype=np.float64),
        np.arange(row * edge, (row + 1) * edge, dtype=np.float64),
    )
    x, y, z = face_directions(col, row, 2.0 * i / edge, 2.0 * j / edge)
    theta = np.arctan2(y, x)  # range -pi to pi
    phi = np.arctan2(z, np.hypot(x, y))  # range -pi/2 to pi/2
    # source image coords
    uf = 2.0 * edge * (theta + np.pi) / np.pi
    vf = 2.0 * edge * (np.pi / 2 - phi) / np.pi
    # bilinear interpolation between the four surrounding pixels
    ui = np.floor(uf).astype(np.int64)
    vi = np.floor(vf).astype(np.int64)
    mu = (uf - ui)[..., None]
    nu = (vf - vi)[..., None]
    u1 = ui % width
    u2 = (ui + 1) % width
    v1 = np.clip(vi, 0, height - 1)
    v2 = np.clip(vi + 1, 0, height - 1)
    out = (
        src[v1, u1] * (1 - mu) * (1 - nu)
        + src[v1, u2] * mu * (1 - nu)
        + src[v2, u1] * (1 - mu) * nu
        + src[v2, u2] * mu * nu
    )
    return Image.fromarray(np.rint(out).astype(np.uint8), "RGB")


for file_name in sys.argv[1:]:
    img_in = Image.open(file_name).convert("RGB")
    width, height = img_in.size
    if width < height * 2:
        img_in = img_in.resize((height * 2, height), Image.Resampling.LANCZOS)
    elif width > height * 2:
        img_in = img_in.resize((width, width // 2), Image.Resampling.LANCZOS)
    src = np.asarray(img_in, dtype=np.float64)
    edge = img_in.size[0] // 4  # the length of each cube edge in pixels

    base_name = os.path.splitext(file_name)[0]
    for name, col, row, rotation in FACES:
        fn = "%s_%s.png" % (base_name, name)
        print("%s face %dx%d --> %s" % (name, edge, edge, fn))
        img = render_face(src, edge, col, row)
        if rotation:
            img = img.rotate(rotation)
        img.save(fn)
