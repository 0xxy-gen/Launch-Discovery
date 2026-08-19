"""Regenerate the launch visual in public/index.html.

The scene is drawn to one scale: the planet radius is 2400 SVG units for
6371 km, so one unit is 2.655 km and every altitude follows from that. The
ascent is a gravity turn — vertical off the pad, pitching over, reaching a
zero flight-path angle at insertion, so the trace meets the circular orbit
tangentially instead of crossing it.

Deliberately unlabelled: no mission-clock stamps, no telemetry readout. It is
an image, not a console.
"""
import math
import pathlib

R_E, MU = 6371.0, 398600.4418
R_px = 2400.0
PXKM = R_px / R_E
CX, CY = 400.0, 3220.0            # planet centre; limb apex lands at y = 820


def px(km):
    return km * PXKM


H_INS, S_INS = 400.0, 1700.0      # insertion altitude and downrange, km
P = 0.7355                        # profile exponent: MECO (s=90 km) at h≈72 km
PHI0 = -0.13584                   # launch site, radians from the limb apex


def h_of_s(s):
    u = max(s, 0.0) / S_INS
    return H_INS * math.sin(math.pi / 2 * u ** P)


def pos(s):
    phi = PHI0 + s / R_E
    r = R_px + px(h_of_s(s))
    return CX + r * math.sin(phi), CY - r * math.cos(phi)


def f(v):
    return f"{v:.1f}"


R_ORBIT = R_px + px(H_INS)
phi_end = PHI0 + S_INS / R_E

# denser sampling near the pad, where the curvature is highest
path = "M " + " L ".join(
    f"{f(x)} {f(y)}" for x, y in (pos(S_INS * (i / 200) ** 1.5) for i in range(201)))

seco = pos(S_INS)

# the orbit carrying on past insertion
cont = "M " + " L ".join(
    f"{f(CX + R_ORBIT * math.sin(phi_end + d))} {f(CY - R_ORBIT * math.cos(phi_end + d))}"
    for d in (i * 0.004 for i in range(1, 30)))

SVG = f"""    <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" role="presentation">
      <!-- To scale: planet radius {R_px:.0f} units = {R_E:.0f} km, so 1 unit = {1 / PXKM:.3f} km.
           Insertion is tangent to the orbit ({math.degrees(phi_end):.1f}° off horizontal) because a
           circular orbit is reached at a zero flight-path angle. -->
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#000000"/>
          <stop offset="55%"  stop-color="#02060a"/>
          <stop offset="82%"  stop-color="#04121a"/>
          <stop offset="100%" stop-color="#07242f"/>
        </linearGradient>
        <linearGradient id="trailFade" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%"   stop-color="#7fefff" stop-opacity=".12"/>
          <stop offset="45%"  stop-color="#7fefff" stop-opacity=".6"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity=".85"/>
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
        </g>

        <!-- atmosphere, to scale: dense layer 0-50 km, haze out to ~120 km -->
        <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{f(R_px + px(60))}" fill="none" stroke="#00E5FF"
                stroke-opacity=".10" stroke-width="{f(px(120))}" filter="url(#wide)"/>
        <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{f(R_px + px(25))}" fill="none" stroke="#4fe8ff"
                stroke-opacity=".22" stroke-width="{f(px(50))}" filter="url(#wide)"/>

        <!-- 400 km circular orbit -->
        <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{f(R_ORBIT)}" fill="none"
                stroke="#7fefff" stroke-opacity=".18" stroke-width="1"/>

        <!-- planet -->
        <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{R_px:.0f}" fill="#000204"/>
        <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{R_px:.0f}" fill="url(#terminator)"/>
        <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{R_px + 2:.0f}" fill="none" stroke="#00E5FF"
                stroke-opacity=".45" stroke-width="6" filter="url(#soft)"/>
        <circle cx="{CX:.0f}" cy="{CY:.0f}" r="{R_px:.0f}" fill="none" stroke="#c9fbff"
                stroke-opacity=".85" stroke-width="1.3"/>

        <!-- ascent -->
        <g class="ascent">
          <path d="{path}" fill="none" stroke="url(#trailFade)" stroke-width="4.5"
                stroke-linecap="round" filter="url(#soft)" opacity=".4"/>
          <path d="{path}" fill="none" stroke="url(#trailFade)" stroke-width="1.2" stroke-linecap="round"/>
          <path d="{cont}" fill="none" stroke="#7fefff" stroke-opacity=".28" stroke-width="1"
                stroke-linecap="round"/>
          <circle cx="{f(seco[0])}" cy="{f(seco[1])}" r="8" fill="#c9fbff" opacity=".16" filter="url(#soft)"/>
          <circle cx="{f(seco[0])}" cy="{f(seco[1])}" r="1.8" fill="#eafdff"/>
        </g>

        <rect width="800" height="1000" filter="url(#grain)" opacity=".05"/>
        <rect width="800" height="1000" fill="url(#vignette)"/>
      </g>
    </svg>"""

html = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'index.html'
s = html.read_text()
a = s.index('    <svg viewBox="0 0 800 1000"')
b = s.index('</svg>') + len('</svg>')
html.write_text(s[:a] + SVG + s[b:])
print(f"1 unit = {1 / PXKM:.3f} km | insertion tangent {math.degrees(phi_end):.2f}deg "
      f"| v {math.sqrt(MU / (R_E + H_INS)):.2f} km/s")
