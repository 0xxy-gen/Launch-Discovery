import math, pathlib

R_E, MU = 6371.0, 398600.4418
R_px = 2400.0
PXKM = R_px / R_E
CX, CY = 400.0, 3220.0            # limb apex at y = 820
def px(km): return km * PXKM

H_INS, S_INS = 400.0, 1400.0
P    = 0.7878                     # tuned so MECO (s=90 km) sits at h≈72 km
PHI0 = -0.11274                   # launch site -> x ≈ 130

def h_of_s(s):
    u = max(s, 0.0) / S_INS
    return H_INS * math.sin(math.pi / 2 * u ** P)

def phi_of_s(s): return PHI0 + s / R_E

def pos(s):
    phi, h = phi_of_s(s), h_of_s(s)
    r = R_px + px(h)
    return CX + r * math.sin(phi), CY - r * math.cos(phi)

def f(v): return f"{v:.1f}"

# orbit numbers
a = R_E + H_INS
v_orb = math.sqrt(MU / a)
T_orb = 2 * math.pi * math.sqrt(a ** 3 / MU) / 60

R_KARMAN = R_px + px(100)
R_ORBIT  = R_px + px(H_INS)

# ascent path, sampled densely near the pad where curvature is highest
samples = [S_INS * (i / 200) ** 1.5 for i in range(201)]
pts = [pos(s) for s in samples]
path = "M " + " L ".join(f"{f(x)} {f(y)}" for x, y in pts)

lift = pos(0.0)
meco = pos(90.0)
maxq = pos(14.0)
seco = pos(S_INS)
phi_end = phi_of_s(S_INS)
tan_deg = math.degrees(phi_end)
tx, ty = math.cos(phi_end), math.sin(phi_end)          # prograde unit tangent

# velocity arrow at insertion
VLEN = 46
vx, vy = seco[0] + tx * VLEN, seco[1] + ty * VLEN

# dashed continuation of the orbit past insertion
cont = "M " + " L ".join(
    f"{f(CX + R_ORBIT*math.sin(phi_end + d))} {f(CY - R_ORBIT*math.cos(phi_end + d))}"
    for d in [i * 0.004 for i in range(1, 26)])

# scale bar: 500 km
BAR = px(500)
bx, by = 140.0, 560.0

SVG = f"""      <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" role="presentation">
      <!-- Scale: planet radius {R_px:.0f} units = {R_E:.0f} km, so 1 unit = {1/PXKM:.3f} km.
           Every altitude, the Kármán line, the orbit radius and the ascent
           profile are drawn at that one scale. Insertion is tangent to the
           orbit ({tan_deg:.1f}° off horizontal) because a circular orbit is reached
           with a zero flight-path angle. -->
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#000000"/>
            <stop offset="55%"  stop-color="#02060a"/>
            <stop offset="82%"  stop-color="#04121a"/>
            <stop offset="100%" stop-color="#07242f"/>
          </linearGradient>
          <linearGradient id="trailFade" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%"   stop-color="#7fefff" stop-opacity=".2"/>
            <stop offset="45%"  stop-color="#7fefff" stop-opacity=".8"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity=".95"/>
          </linearGradient>
          <linearGradient id="terminator" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%"   stop-color="#000000" stop-opacity=".9"/>
            <stop offset="50%"  stop-color="#00121a" stop-opacity=".4"/>
            <stop offset="100%" stop-color="#00394a" stop-opacity=".6"/>
          </linearGradient>
          <radialGradient id="vignette" cx="50%" cy="44%" r="76%">
            <stop offset="52%"  stop-color="#000000" stop-opacity="0"/>
            <stop offset="100%" stop-color="#000000" stop-opacity=".6"/>
          </radialGradient>
          <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>
          <filter id="wide" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="20"/></filter>
          <filter id="grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <marker id="tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#c9fbff" fill-opacity=".9"/>
          </marker>
          <clipPath id="frame"><rect width="800" height="1000"/></clipPath>
        </defs>

        <g clip-path="url(#frame)">
          <rect width="800" height="1000" fill="url(#sky)"/>

          <!-- starfield: three tiers, densest toward the horizon -->
          <g class="drift">
            <g fill="#ffffff" opacity=".38">
              <circle cx="62"  cy="88"  r=".7"/><circle cx="158" cy="212" r=".7"/><circle cx="331" cy="180" r=".7"/>
              <circle cx="408" cy="52"  r=".7"/><circle cx="572" cy="78"  r=".7"/><circle cx="736" cy="104" r=".7"/>
              <circle cx="205" cy="352" r=".7"/><circle cx="389" cy="392" r=".7"/><circle cx="559" cy="404" r=".7"/>
              <circle cx="742" cy="418" r=".7"/><circle cx="52"  cy="452" r=".7"/><circle cx="264" cy="486" r=".7"/>
              <circle cx="447" cy="498" r=".7"/><circle cx="629" cy="512" r=".7"/><circle cx="118" cy="546" r=".7"/>
              <circle cx="228" cy="592" r=".7"/><circle cx="352" cy="562" r=".7"/><circle cx="486" cy="604" r=".7"/>
              <circle cx="604" cy="578" r=".7"/><circle cx="708" cy="622" r=".7"/><circle cx="86"  cy="638" r=".7"/>
              <circle cx="292" cy="668" r=".7"/><circle cx="418" cy="694" r=".7"/><circle cx="540" cy="656" r=".7"/>
              <circle cx="662" cy="702" r=".7"/><circle cx="762" cy="668" r=".7"/><circle cx="146" cy="716" r=".7"/>
              <circle cx="248" cy="748" r=".7"/><circle cx="372" cy="726" r=".7"/><circle cx="498" cy="762" r=".7"/>
            </g>
            <g fill="#ffffff" opacity=".62">
              <circle cx="243" cy="64"  r="1.1"/><circle cx="486" cy="146" r="1.1"/><circle cx="96"  cy="286" r="1.1"/>
              <circle cx="298" cy="298" r="1.1"/><circle cx="471" cy="318" r="1.1"/><circle cx="648" cy="330" r="1.1"/>
              <circle cx="146" cy="524" r="1.1"/><circle cx="538" cy="576" r="1.1"/><circle cx="718" cy="588" r="1.1"/>
              <circle cx="186" cy="654" r="1.1"/><circle cx="330" cy="612" r="1.1"/><circle cx="576" cy="690" r="1.1"/>
            </g>
            <g fill="#ffffff" opacity=".92">
              <circle cx="655" cy="196" r="1.7"/><circle cx="112" cy="372" r="1.6"/><circle cx="392" cy="240" r="1.5"/>
              <circle cx="266" cy="520" r="1.6"/><circle cx="596" cy="470" r="1.5"/><circle cx="472" cy="672" r="1.4"/>
            </g>
            <g stroke="#ffffff" stroke-width=".8" stroke-linecap="round" opacity=".5">
              <path d="M655 186v20M645 196h20"/><path d="M266 512v16M258 520h16"/><path d="M392 232v16M384 240h16"/>
            </g>
          </g>

          <!-- atmosphere, drawn to scale: dense layer 0-50 km, haze out to ~120 km -->
          <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{f(R_px + px(60))}" fill="none" stroke="#00E5FF"
                  stroke-opacity=".10" stroke-width="{f(px(120))}" filter="url(#wide)"/>
          <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{f(R_px + px(25))}" fill="none" stroke="#4fe8ff"
                  stroke-opacity=".22" stroke-width="{f(px(50))}" filter="url(#wide)"/>

          <!-- mission orbit, 400 km circular -->
          <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{f(R_ORBIT)}" fill="none"
                  stroke="#7fefff" stroke-opacity=".38" stroke-width="1"/>
          <!-- Karman line, 100 km -->
          <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{f(R_KARMAN)}" fill="none"
                  stroke="#ffffff" stroke-opacity=".18" stroke-width=".8" stroke-dasharray="3 6"/>

          <!-- planet -->
          <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{R_px:.0f}" fill="#000204"/>
          <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{R_px:.0f}" fill="url(#terminator)"/>
          <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{R_px + 2:.0f}" fill="none" stroke="#00E5FF"
                  stroke-opacity=".45" stroke-width="6" filter="url(#soft)"/>
          <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{R_px:.0f}" fill="none" stroke="#c9fbff"
                  stroke-opacity=".85" stroke-width="1.3"/>

          <!-- ascent: gravity turn, vertical off the pad, flight-path angle -> 0 at insertion -->
          <g class="ascent">
            <path d="{path}" fill="none" stroke="url(#trailFade)" stroke-width="5"
                  stroke-linecap="round" filter="url(#soft)" opacity=".5"/>
            <path d="{path}" fill="none" stroke="url(#trailFade)" stroke-width="1.5" stroke-linecap="round"/>
            <path d="{cont}" fill="none" stroke="#7fefff" stroke-opacity=".45" stroke-width="1.1"
                  stroke-dasharray="2 6" stroke-linecap="round"/>

            <g fill="#02080b" stroke="#9ff3ff" stroke-width="1.1">
              <circle cx="{f(lift[0])}" cy="{f(lift[1])}" r="3.2"/>
              <circle cx="{f(maxq[0])}" cy="{f(maxq[1])}" r="2.4"/>
              <circle cx="{f(meco[0])}" cy="{f(meco[1])}" r="2.8"/>
              <circle cx="{f(seco[0])}" cy="{f(seco[1])}" r="3.2"/>
            </g>

            <!-- velocity at insertion: tangent to the orbit, prograde -->
            <path d="M {f(seco[0])} {f(seco[1])} L {f(vx)} {f(vy)}" stroke="#c9fbff" stroke-opacity=".9"
                  stroke-width="1.3" marker-end="url(#tip)"/>
          </g>

          <!-- payload, aligned with the local horizontal -->
          <g transform="translate({f(seco[0])} {f(seco[1])}) rotate({tan_deg:.2f})">
            <g fill="#040d11" stroke="#8fe9f7" stroke-width="1.1" stroke-opacity=".85">
              <rect x="-31" y="-3.5" width="20" height="7" rx="1"/>
              <rect x="11"  y="-3.5" width="20" height="7" rx="1"/>
              <rect x="-8"  y="-6"   width="16" height="12" rx="1.5" fill="#071820"/>
            </g>
            <g stroke="#8fe9f7" stroke-opacity=".35" stroke-width=".7">
              <path d="M-25 -3.5v7M-18 -3.5v7M18 -3.5v7M25 -3.5v7"/>
            </g>
            <path d="M-11 0h-3M11 0h3" stroke="#8fe9f7" stroke-opacity=".8" stroke-width="1.1"/>
            <circle class="beacon" cx="0" cy="-9" r="2" fill="#c9fbff"/>
          </g>

          <!-- annotations -->
          <g font-family="Inter, sans-serif" font-size="11.5" font-weight="500" letter-spacing="1.5"
             fill="#ffffff" fill-opacity=".5" stroke="#000407" stroke-width="3.2" stroke-opacity=".65"
             paint-order="stroke fill">
            <text x="{f(lift[0] - 8)}" y="{f(lift[1] + 26)}">T+00:00 &#183; LIFT-OFF</text>
            <text x="{f(meco[0] + 24)}" y="{f(meco[1] - 18)}">T+02:38 &#183; MECO</text>
            <text x="{f(seco[0] - 14)}" y="{f(seco[1] - 34)}" text-anchor="end">T+08:44 &#183; SECO</text>
          </g>

          <g font-family="Inter, sans-serif" font-size="10.5" font-weight="500" letter-spacing="1.4"
             fill="#ffffff" fill-opacity=".32" stroke="#000407" stroke-width="3" stroke-opacity=".6"
             paint-order="stroke fill">
            <text x="770" y="{f(CY - math.sqrt(R_KARMAN**2 - 370**2) - 9)}" text-anchor="end">K&#193;RM&#193;N LINE &#183; 100 KM</text>
            <text x="26"  y="{f(CY - math.sqrt(R_ORBIT**2 - 374**2) - 17)}">MISSION ORBIT &#183; 400 KM</text>
          </g>

          <!-- readout -->
          <g font-family="Inter, sans-serif" letter-spacing="1.6" fill="#c9fbff">
            <text x="140" y="212" font-size="11.5" font-weight="600" fill-opacity=".75">400 KM CIRCULAR</text>
            <g font-size="11" font-weight="400" fill="#ffffff" fill-opacity=".34">
              <text x="140" y="238">VELOCITY &#183; {v_orb:.2f} KM/S</text>
              <text x="140" y="260">PERIOD &#183; {T_orb:.1f} MIN</text>
              <text x="140" y="282">INCLINATION &#183; 97.0&#176; SSO</text>
            </g>
          </g>

          <!-- scale bar, same units as everything else -->
          <g stroke="#ffffff" stroke-opacity=".3" stroke-width="1">
            <path d="M{f(bx)} {f(by)}h{f(BAR)}"/>
            <path d="M{f(bx)} {f(by - 4)}v8M{f(bx + BAR)} {f(by - 4)}v8M{f(bx + BAR/2)} {f(by - 2)}v4"/>
          </g>
          <text x="{f(bx)}" y="{f(by - 12)}" font-family="Inter, sans-serif" font-size="10.5"
                font-weight="500" letter-spacing="1.4" fill="#ffffff" fill-opacity=".34">500 KM &#183; TO SCALE</text>

          <rect width="800" height="1000" filter="url(#grain)" opacity=".05"/>
          <rect width="800" height="1000" fill="url(#vignette)"/>
        </g>
      </svg>"""

html = pathlib.Path('/Users/gennangqy/Launch-Discovery/public/index.html')
s = html.read_text()
a = s.index('    <svg viewBox="0 0 800 1000"')
b = s.index('</svg>') + len('</svg>')
html.write_text(s[:a] + SVG + s[b:])
print(f"insertion tangent {tan_deg:.2f} deg | v {v_orb:.2f} km/s | T {T_orb:.1f} min")
print(f"lift-off {lift} | MECO {meco} | SECO {seco}")
