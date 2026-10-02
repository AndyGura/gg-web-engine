# Generates banner.svg (the README banner) next to this file. Rasterize it afterwards with:
#   rsvg-convert -w 2560 banner.svg -o banner.png
import os

W, H = 1280, 420
S = 62            # cube edge
OX, OY = 250, 215 # iso origin
C = 0.866

def proj(i, j, k):
    return (OX + (i - j) * C * S, OY + (i + j) * 0.5 * S - k * S)

def pts(l):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in l)

def cube(i, j, k, top, left, right, stroke, sw=2, extra=''):
    # corners of the unit cube at grid (i,j,k)
    p = lambda a, b, c: proj(i + a, j + b, k + c)
    t = [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)]
    l = [p(0, 1, 1), p(1, 1, 1), p(1, 1, 0), p(0, 1, 0)]
    r = [p(1, 0, 1), p(1, 1, 1), p(1, 1, 0), p(1, 0, 0)]
    a = f'stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"'
    return (f'<g {extra}><polygon points="{pts(t)}" fill="{top}" {a}/>'
            f'<polygon points="{pts(l)}" fill="{left}" {a}/>'
            f'<polygon points="{pts(r)}" fill="{right}" {a}/></g>')

out = []
out.append(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="GG Web Engine - modular 2D/3D game engine for the web">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0a0f1f"/><stop offset="1" stop-color="#111535"/>
  </linearGradient>
  <radialGradient id="glowA" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#22d3ee" stop-opacity="0.38"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowB" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#8b5cf6" stop-opacity="0.30"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#8b5cf6"/>
  </linearGradient>
  <linearGradient id="accTop" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#a5f3fc"/><stop offset="1" stop-color="#67e8f9"/>
  </linearGradient>
  <linearGradient id="accLeft" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#0e7490"/>
  </linearGradient>
  <linearGradient id="accRight" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#4c1d95"/>
  </linearGradient>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/>
  </pattern>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.75" stop-color="#fff" stop-opacity="0.25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <mask id="gridMask"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask>
  <clipPath id="round"><rect width="{W}" height="{H}" rx="28"/></clipPath>
  <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<g clip-path="url(#round)">
<rect width="{W}" height="{H}" fill="url(#bg)"/>
<rect width="{W}" height="{H}" fill="url(#grid)" mask="url(#gridMask)"/>
<ellipse cx="250" cy="200" rx="330" ry="270" fill="url(#glowA)"/>
<ellipse cx="1120" cy="420" rx="420" ry="260" fill="url(#glowB)"/>
''')

# ground shadow
gx, gy = proj(1, 1, 0)
out.append(f'<ellipse cx="{gx:.0f}" cy="{gy+52:.0f}" rx="150" ry="22" fill="#22d3ee" opacity="0.28" filter="url(#blur)"/>')

# base cluster: 2x2x2 without the top-front cube (1,1,1)
base = [(i, j, k) for k in (0, 1) for i in (0, 1) for j in (0, 1) if (i, j, k) != (1, 1, 1)]
base.sort(key=lambda c: (c[2], c[0] + c[1]))
for (i, j, k) in base:
    out.append(cube(i, j, k, '#e2e8f0', '#94a3b8', '#64748b', '#0a0f1f', 2.5))

# the pluggable module, hovering above its slot
fx, fy = proj(1.5, 1.5, 2.0)
out.append(f'<ellipse cx="{proj(1.5,1.5,1.0)[0]:.0f}" cy="{proj(1.5,1.5,1.0)[1]:.0f}" rx="46" ry="24" fill="#22d3ee" opacity="0.55" filter="url(#blur)"/>')
for d in (0.25, 0.5, 0.75):
    x, y = proj(1.5, 1.5, 1.0 + d * 0.62)
    out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{30-d*12:.0f}" ry="{15-d*6:.0f}" fill="none" stroke="#67e8f9" stroke-opacity="{0.75-d*0.6:.2f}" stroke-width="2"/>')
out.append(cube(1, 1, 1.62, 'url(#accTop)', 'url(#accLeft)', 'url(#accRight)', '#ecfeff', 2.5))

# peer-to-peer nodes orbiting the mark
nodes = [(70, 92), (440, 78), (462, 318), (52, 300)]
links = [(0, 1), (1, 2), (2, 3), (3, 0), (0, 2)]
for a, b in links:
    (x1, y1), (x2, y2) = nodes[a], nodes[b]
    out.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="url(#accent)" stroke-opacity="0.28" stroke-width="1.5" stroke-dasharray="3 7" stroke-linecap="round"/>')
# redraw is not needed: links sit behind via low opacity; nodes on top
for x, y in nodes:
    out.append(f'<circle cx="{x}" cy="{y}" r="11" fill="#22d3ee" opacity="0.18"/><circle cx="{x}" cy="{y}" r="5" fill="#a5f3fc"/>')

# wordmark
F = "font-family=\"'Inter','Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif\""
TX = 560
out.append(f'<text x="{TX}" y="178" {F} font-size="92" font-weight="800" letter-spacing="-2.5"><tspan fill="url(#accent)">GG</tspan><tspan fill="#f8fafc" dx="22">Web Engine</tspan></text>')
out.append(f'<text x="{TX+3}" y="232" {F} font-size="29" font-weight="500" fill="#cbd5e1">Modular 2D/3D game engine for the web</text>')
chips = [('Pluggable rendering', 214), ('Pluggable physics', 190), ('P2P multiplayer', 172)]
x = TX + 3
for label, w in chips:
    out.append(f'<rect x="{x}" y="270" width="{w}" height="42" rx="21" fill="#ffffff" fill-opacity="0.06" stroke="url(#accent)" stroke-opacity="0.65" stroke-width="1.5"/>')
    out.append(f'<text x="{x + w/2}" y="297" text-anchor="middle" {F} font-size="18" font-weight="600" fill="#e2e8f0">{label}</text>')
    x += w + 14
out.append('</g></svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'banner.svg'), 'w').write('\n'.join(out) + '\n')
