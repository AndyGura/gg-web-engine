import sys
from math import pi, atan2, hypot, floor, ceil

from PIL import Image
from numpy import clip, average


# get x,y,z coords from out image pixels coords
# i,j are pixel coords
# face is face number
# edge is edge length
def outImgToXYZ(i, j, face, edge):
    a = 2.0 * float(i) / edge
    b = 2.0 * float(j) / edge
    if face == 0:  # back
        (x, y, z) = (-1.0, 1.0 - a, 3.0 - b)
    elif face == 1:  # left
        (x, y, z) = (a - 3.0, -1.0, 3.0 - b)
    elif face == 2:  # front
        (x, y, z) = (1.0, a - 5.0, 3.0 - b)
    elif face == 3:  # right
        (x, y, z) = (7.0 - a, 1.0, 3.0 - b)
    elif face == 4:  # top
        (x, y, z) = (b - 1.0, a - 5.0, 1.0)
    elif face == 5:  # bottom
        (x, y, z) = (5.0 - b, a - 5.0, -1.0)
    return (x, y, z)


# convert using an inverse transformation
def convertBack(imgIn, imgOut):
    inSize = imgIn.size
    outSize = imgOut.size
    inPix = imgIn.load()
    outPix = imgOut.load()
    edge = int(inSize[0] / 4)  # the length of each edge in pixels
    for i in range(outSize[0]):
        face = int(i / edge)  # 0 - back, 1 - left 2 - front, 3 - right
        if face == 2:
            rng = range(0, edge * 3)
        else:
            rng = range(edge, edge * 2)

        for j in rng:
            if j < edge:
                face2 = 4  # top
            elif j >= 2 * edge:
                face2 = 5  # bottom
            else:
                face2 = face

            (x, y, z) = outImgToXYZ(i, j, face2, edge)
            theta = atan2(y, x)  # range -pi to pi
            r = hypot(x, y)
            phi = atan2(z, r)  # range -pi/2 to pi/2
            # source img coords
            uf = (2.0 * edge * (theta + pi) / pi)
            vf = (2.0 * edge * (pi / 2 - phi) / pi)
            # Use bilinear interpolation between the four surrounding pixels
            ui = floor(uf)  # coord of pixel to bottom left
            vi = floor(vf)
            u2 = ui + 1  # coords of pixel to top right
            v2 = vi + 1
            mu = uf - ui  # fraction of way across pixel
            nu = vf - vi
            # Pixel values of four corners
            A = inPix[ui % inSize[0], clip(vi, 0, inSize[1] - 1)]
            B = inPix[u2 % inSize[0], clip(vi, 0, inSize[1] - 1)]
            C = inPix[ui % inSize[0], clip(v2, 0, inSize[1] - 1)]
            D = inPix[u2 % inSize[0], clip(v2, 0, inSize[1] - 1)]
            # interpolate
            (r, g, b) = (
                A[0] * (1 - mu) * (1 - nu) + B[0] * (mu) * (1 - nu) + C[0] * (1 - mu) * nu + D[0] * mu * nu,
                A[1] * (1 - mu) * (1 - nu) + B[1] * (mu) * (1 - nu) + C[1] * (1 - mu) * nu + D[1] * mu * nu,
                A[2] * (1 - mu) * (1 - nu) + B[2] * (mu) * (1 - nu) + C[2] * (1 - mu) * nu + D[2] * mu * nu)

            outPix[i, j] = (int(round(r)), int(round(g)), int(round(b)))


files = sys.argv[1:]
for file_name in files:
    imgIn = Image.open(file_name)
    width, height = imgIn.size
    if width < height * 2:
        imgIn = imgIn.resize((height * 2, height), Image.ANTIALIAS)
    elif width > height * 2:
        imgIn = imgIn.resize((width, width / 2), Image.ANTIALIAS)
    imgOut = Image.new("RGB", (imgIn.size[0], int(imgIn.size[0] * 3 / 4)), "black")
    convertBack(imgIn, imgOut)
    # imgOut.save('cubemap.png')
    # split squares
    file_extension = ".png"

    name_map = [["", "", "pz", ""],
                ["ny", "nx", "py", "px"],
                ["", "", "nz", ""]]
    rotation = [[0, 0, 180, 0],
                [0, 90, 180, -90],
                [0, 0, 0, 0]]
    width, height = imgOut.size

    cube_size = width / 4

    filelist = []
    for row in range(3):
        for col in range(4):
            if name_map[row][col] != "":
                sx = cube_size * col
                sy = cube_size * row
                fn = file_name[:-4] + '_' + name_map[row][col] + file_extension
                filelist.append(fn)
                print("%s --> %s" % (str((sx, sy, sx + cube_size, sy + cube_size)), fn))
                img = imgOut.crop((sx, sy, sx + cube_size, sy + cube_size))
                if rotation[row][col]:
                    img = img.rotate(rotation[row][col])
                img.save(fn)
