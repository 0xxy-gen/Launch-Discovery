# Launch Discovery — Access

A self-contained sign-in / registration page, themed to match the Aether
mission-management app (`~/mission-management`) and the type treatment on
aetherspace.tech.

## Run it

Open `index.html` in a browser, or serve it:

```
python3 -m http.server 8000 --directory ~/Launch-Discovery
```

then visit http://localhost:8000

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

Sign in checks the email/password against registered accounts; the signed-in
view shows the account's role, organisation, country and phone.

## Layout

Full-bleed split: the form sits in a narrow column in the left pane, and the
right pane holds a generated launch visual (inline SVG — layered atmosphere
over the limb, concentric orbit rings, a tiered starfield, and an ascent
trajectory with phase annotations ending at a payload). Grain and a vignette
keep it from reading as flat vector; the starfield drift and payload beacon
animate slowly and stop under `prefers-reduced-motion`. Both panes are rounded
and fill the window; the form pane scrolls on its own when the register form
runs long. Below 900px the visual pane is hidden and the form goes full width.

To use a photograph instead, replace the `<svg>` inside `.visual-pane` with
`<img src="your-photo.jpg" style="width:100%;height:100%;object-fit:cover">`.

## Theme

Palette comes from `mission-management/app/globals.css` (black ground, cyan
accent). Buttons follow aetherspace.tech: solid black-on-colour fills. Type is
Inter throughout — `tracking-tighter` mixed-weight headlines, sentence-case
field labels, and light letterspaced uppercase only for the small kickers and
section titles.

## Storage

Accounts are kept in this browser's `localStorage` under `ld.users`, and the
active session under `ld.session`. Passwords are SHA-256 hashed with the email
as a salt — that keeps plaintext out of storage, but it is **not** real
password security: there is no server, no rate limiting, and anyone with access
to the browser can read the store.

## Making it real

Replace the two branches in the `form` submit handler in `index.html` with
`fetch` calls to your backend:

- register → `POST /api/register` with the profile object
- sign in  → `POST /api/login` with `{ email, password }`

Hash passwords server-side with bcrypt/argon2, issue an httpOnly session
cookie, and drop the `localStorage` helpers.

## Country data

`COUNTRIES` in `index.html` is a single `name:dial:ISO` string — 163 entries.
Flags are derived from the ISO code at runtime (regional indicator pairs), so
adding a country means adding one comma-separated entry. Flag emoji render on
macOS, iOS and Android; Windows has no flag glyphs and shows the two letters
instead.
