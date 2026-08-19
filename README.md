# Launch Discovery — Access

Sign-in and registration for the Aether mission-management app: a themed
front end backed by a small Node API with real accounts and sessions.

## Run it

```
npm install
npm start          # http://localhost:3100   (npm run dev to watch)
```

One dependency (Express). SQLite comes from Node's built-in `node:sqlite`, and
password hashing from `node:crypto`, so there is nothing native to compile.
Requires Node 22.5+; developed on 24.

## API

| Method | Path             | Purpose                                                    |
| ------ | ---------------- | ---------------------------------------------------------- |
| GET    | `/api/countries` | Country list with flags and dial codes (cached a day)      |
| GET    | `/api/me`        | Current account, or 401                                    |
| POST   | `/api/register`  | Create an account, start a session                         |
| POST   | `/api/login`     | Start a session                                            |
| POST   | `/api/logout`    | End the current session                                    |

Validation errors come back as `{ fields: { email: "…", phone: "…" } }`, keyed
by the same ids the form inputs use, so the client paints them inline without
any mapping.

## Security

- **Passwords** are hashed with scrypt (N=16384, r=8, p=1, 16-byte salt) and
  compared with `timingSafeEqual`. The hash never leaves the database.
- **Sessions** are 256-bit random tokens delivered as `httpOnly`, `SameSite=Lax`
  cookies, so page scripts cannot read them. Only the SHA-256 *hash* of a token
  is stored, so a database leak does not hand over live sessions.
  Set `NODE_ENV=production` to add the `Secure` flag.
- **Login failures** are generic and constant-time: when no account matches, the
  request still hashes against a dummy, so a wrong email costs the same as a
  wrong password and neither can be probed for.
- **Rate limiting** is per IP and path — 10 login and 20 register attempts per
  15 minutes. In-memory, so it needs a shared store if this ever runs on more
  than one instance.
- **CSRF**: mutating routes require `Content-Type: application/json`, which a
  cross-site form post cannot set, on top of `SameSite=Lax`.
- Country and dial code are validated against the shared list, so a hand-rolled
  request cannot store a value the dropdowns would never produce.

## Registration form

| Field                  | Required | Notes                                    |
| ---------------------- | -------- | ---------------------------------------- |
| Email address          | yes      | format-checked, must be unique           |
| Password / Confirm     | yes      | 8-character minimum, must match          |
| Organisation           | yes      |                                          |
| Role                   | yes      |                                          |
| Main operating country | yes      | dropdown, 163 countries with flags       |
| LinkedIn               | no       | validated as a linkedin.com URL if given |
| Country code           | yes      | dropdown, flag + dial code per country   |
| Phone number           | yes      | local number, digits only                |

## Layout

Full-bleed split: the form sits in a narrow column in the left pane, and the
right pane holds the launch visual. Both panes are rounded and fill the window;
the form pane scrolls on its own when the register form runs long. Below 900px
the visual pane is hidden and the form goes full width.

## The visual

`tools/gen_visual.py` generates the SVG in the right-hand pane, and it is drawn
**to scale**: the planet radius is 2400 units for 6371 km, so one unit is
2.655 km, and every altitude follows from that.

- The Kármán line (100 km) and the 400 km mission orbit sit where they actually
  sit relative to the surface — orbit hugs the limb, because that is what low
  Earth orbit looks like.
- The ascent is a gravity turn: vertical off the pad, pitching over, reaching a
  zero flight-path angle at insertion, so the trace meets the orbit tangentially
  rather than crossing it. MECO is placed at its real altitude, below the
  Kármán line.
- The readout numbers are computed, not invented: 7.67 km/s and 92.4 min follow
  from `v = √(μ/a)` and `T = 2π√(a³/μ)` at a = 6771 km.
- A scale bar states the scale, since a viewer has no other way to check it.

Re-run `python3 tools/gen_visual.py` after editing the geometry — it rewrites
the `<svg>` block in `public/index.html` in place.

To use a photograph instead, replace the `<svg>` inside `.visual-pane` with
`<img src="your-photo.jpg" style="width:100%;height:100%;object-fit:cover">`.

## Theme

Palette comes from `mission-management/app/globals.css` (black ground, cyan
accent). Buttons follow aetherspace.tech: solid black-on-colour fills. Type is
Inter throughout — `tracking-tighter` mixed-weight headlines, sentence-case
field labels, and light letterspaced uppercase only for the small kickers and
section titles.

## Country data

`lib/countries.js` is a single `name:dial:ISO` string — 163 entries, shared by
the client selects and server-side validation. Flags are derived from the ISO
code at runtime (regional indicator pairs), so adding a country means adding one
comma-separated entry. Flag emoji render on macOS, iOS and Android; Windows has
no flag glyphs and shows the two letters instead.

## Layout of the repo

```
server.js          Express app: routes, cookies, rate limiting
lib/db.js          SQLite schema and queries
lib/auth.js        scrypt hashing, session tokens
lib/validate.js    server-side field validation
lib/countries.js   shared country/dial/ISO data
public/index.html  the page (self-contained apart from the API)
tools/gen_visual.py  regenerates the launch graphic
data/app.db        created on first run, gitignored
```
