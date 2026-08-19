# Launch Discovery — Access

Sign-in and registration for the Aether mission-management app: a themed
front end backed by a small Node API with real accounts and sessions.

## Run it

```
npm install
npm start          # http://localhost:3100   (npm run dev to watch)
npm run seed       # demo accounts and sample data
```

`npm run seed` is safe to re-run — it creates only what is missing. Pass
`-- --reset` to wipe the demo accounts and rebuild them.

| Account | Type | Has |
| --- | --- | --- |
| `satco@demo.aether` | Payload owner | 2 missions, leads a pool, **admin of SatCo Systems** |
| `eng@demo.aether` | Payload owner | **Member of the same company** — same missions, no admin rights |
| `cubes@demo.aether` | Payload owner | A 12U cubesat, in that pool |
| `orbital@demo.aether` | Payload owner | A 45° LEO payload — incompatible with the pool |
| `rocketco@demo.aether` | Launch provider | 3 launches, 2 published; browses Payloads |
| `broker@demo.aether` | Broker | Sees both sides |

Password for all of them: `aether-demo-2026`

One dependency (Express). SQLite comes from Node's built-in `node:sqlite`, and
password hashing from `node:crypto`, so there is nothing native to compile.
Requires Node 22.5+; developed on 24.

## API

| Method | Path                       | Purpose                                              |
| ------ | -------------------------- | ---------------------------------------------------- |
| GET    | `/api/options`             | Account types, countries, orbit/ride/form-factor lists |
| GET    | `/api/me`                  | Current account, or 401                              |
| POST   | `/api/register`            | Create an account, start a session                   |
| POST   | `/api/login`               | Start a session                                      |
| POST   | `/api/logout`              | End the current session                              |
| PUT    | `/api/profile`             | Organisation, role, country, contact details         |
| GET    | `/api/payloads`            | Published requirements from others — banded, supply side only |
| GET    | `/api/launches`            | Published launches, with which of your missions fit each |
| GET    | `/api/my-launches`         | Your own launches — supply side only                  |
| POST   | `/api/my-launches`         | List a launch                                         |
| PUT    | `/api/my-launches/:id`     | Update one                                            |
| POST   | `/api/my-launches/:id/status` | Publish or hide                                    |
| DELETE | `/api/my-launches/:id`     | Delete one                                            |
| POST   | `/api/missions/:id/duplicate` | Copy a satellite into the same constellation      |
| GET/POST/PUT/DELETE | `/api/constellations` | Group missions flown as one programme  |
| GET/POST/DELETE | `/api/waitlist`   | Aether Agents early access                            |
| GET    | `/api/people`              | Everyone in your company, plus pending invites        |
| POST   | `/api/people/invite`       | Invite a colleague — returns a single-use link        |
| POST   | `/api/join`                | Accept an invitation                                  |
| GET    | `/api/pools`               | Open pools, with which of your missions could join each |
| POST   | `/api/pools`               | Start a pool, seeded by one of your missions          |
| POST   | `/api/pools/:id/join`      | Join with a compatible mission                        |
| POST   | `/api/pools/:id/leave`     | Leave                                                 |
| GET    | `/api/missions`            | Your requirements, private figures and public view   |
| POST   | `/api/missions`            | Create one                                           |
| POST   | `/api/missions/preview`    | Band a draft without saving — drives the live preview |
| PUT    | `/api/missions/:id`        | Update one                                           |
| POST   | `/api/missions/:id/status` | Publish or hide                                      |
| DELETE | `/api/missions/:id`        | Delete one                                           |

Every mission route checks ownership: the id in the URL is never trusted on its
own, so another account gets a 404 rather than a peek.

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

## Companies and people

A company outlives whoever signed up. Missions, launches and pools belong to
the **company**, not to the person who typed them in, so a campaign does not
stall when one person is on leave or leaves entirely.

- Registering creates a person *and* the company they act for; the signer is
  its admin.
- Admins invite colleagues by email. No mail goes out from a local build, so
  the invite link is handed back to pass on. It is single-use, hashed at rest
  like a session, and expires in 14 days.
- Members can create, edit and publish everything the company owns. Only admins
  can edit the company itself, invite, or remove people.
- Removing a person does not touch the missions they created — those belong to
  the company.

Databases that predate this split are migrated in place on boot: every existing
account becomes the admin of a company of one, and its missions, launches and
pools are reassigned to that company.

## Signing up

Which side of the market you are on, who you are, your role, an email and a
password. The name and role describe the *person* — the company is set up in
the step straight after, and can carry several people. Organisation, role and country are asked for on the profile at
the moment they are first needed — publishing a requirement, which carries the
owner's jurisdiction — and contact details stay optional until a match is
accepted. Asking for all of it up front costs signups and asks for identifying
detail before anyone has decided to trust you.

## Navigation

Object-named browse tabs plus one "mine" tab, the shape Qasa uses. Which tabs
exist depends on the account, because access does:

Four tabs for every account: **Launches · Payloads · Aether Pooling · My
Missions**. Only the last changes noun — a provider's own inventory is launches,
so it reads *My Launches* there.

The payloads directory is open to every signed-in account, and a company never
sees its own rows there. That is a deliberate loosening: owners reading each
other's banded requirements is how pools form — *somebody else is going to my
orbit* — and the banding is what makes it safe to show. It does mean a
competitor can see the shape of demand, which is the trade being made.

**Supply and demand are not symmetric, and the app should not pretend they are.**
A launch is a sales offering, so `Launches` names the provider, the vehicle and
the site openly and is visible to every signed-in account. A requirement is
competitive intelligence, so `Payloads` is banded and closed to the demand side.
Same marketplace, opposite disclosure.

## Launches

The supply-side object: a real flight with a vehicle, a site, a date and spare
mass. Providers list them under `My Launches` as draft or published; everyone
else browses them under `Launches`, filtered by orbit, window and spare
capacity.

Each card tells a payload owner whether anything of theirs actually fits —
using the same compatibility rules pooling uses, plus whether the payload's mass
is under the spare capacity. When nothing fits, the card says which constraint
each mission fails rather than staying silent.

`lib/compatibility.js` holds those rules once, shared by launches and pools: a
mission fits a target if the orbit type matches exactly, inclination is within
1.5°, altitude within 150 km and the window within 3 months.

## Aether Pooling

Owners going to the same orbit group up and approach a provider as one
manifest. It is the one place the anonymity model inverts, so it is opt-in and
scoped: everyone sees a pool's target, running total, member count and the
jurisdictions inside it, but **only members see who is in it** and their exact
figures. That disclosure is the trade for joining.

**Compatibility is physics, not preference.** Two payloads can only share a ride
if they want essentially the same orbit — a plane change costs more delta-v than
most missions carry. `lib/pools.js` enforces it on the API, not just in the UI:

| Constraint | Tolerance |
| --- | --- |
| Orbit type | must match exactly |
| Inclination | ±1.5° |
| Altitude | ±150 km |
| Window | ±3 months |

A pool's target comes from the mission that seeds it, so the creator is by
definition compatible with their own pool, and **a pool with one member is
simply a request** — it becomes real when someone compatible joins. That is the
cold start solved with one object rather than two.

When none of your missions fit, the card says which constraint each one fails
rather than grey-ing out a button.

Still missing, and deliberately: a **lead member** — someone eventually has to be
the counterparty on a launch contract. Every group-buy without a named lead
dead-ends at the moment it succeeds.

## Constellations

Satellites are rarely procured one at a time, so `My Missions` groups them.
A constellation is drawn as a **container** rather than a heading — the
satellites sit visibly inside it, collapsible, each keeping its own card, name,
status and published pseudonym. The group header carries the rollup (count,
total mass, altitude and inclination ranges, window span); each member carries
its own figures. That contrast is what says *this is a grouping, and these are
individually distinct records*.

`Duplicate` copies a satellite into the same constellation as a draft with the
name bumped — `Aurora-2` becomes `Aurora-3`, `Aurora` becomes `Aurora 2` — and
`Add satellite` on the group header does the same from the last member. Typing
the same form twenty-four times is not a workflow.

`Ungroup` deletes the grouping, never the satellites: the column is
`ON DELETE SET NULL`, so they return to the ungrouped list.

The grouping is private. A provider sees each requirement on its own, banded,
with no signal that several belong to one programme — the fact that you are
building a constellation is itself commercially sensitive.

## Missions

One record per satellite. A payload owner adds the satellites they need flown;
providers find them without learning who they are. `/missions` holds the whole
flow: the list, the editor, and a live "what providers see" panel beside the
form.

The word **requirement** is deliberately absent from the interface — it does not
say whether you are looking at one satellite or a whole programme. On screen it
is a *mission*, a constellation groups *satellites*, and `New mission` creates
exactly one satellite's record.

**Banding is the anonymity mechanism.** Exact values are fingerprints — "180 kg
to 550 km SSO in March 2027" names a specific company to anyone in the industry
and tells a provider exactly how to price it. `lib/banding.js` widens each
figure just far enough to stay searchable:

| Private              | Public                |
| -------------------- | --------------------- |
| 180 kg               | 100–250 kg            |
| 550 km               | 500–600 km            |
| 97.6°                | 95–100°               |
| 2027-03              | Q1 2027               |
| Mission A, notes, org | *(never shown)*      |

Each requirement also gets a stable pseudonym (`LD-0DTY`) derived from its row
id, offset so it does not read as a countable sequence.

The preview panel is rendered from `POST /api/missions/preview` rather than
recomputed in the browser, so what the owner is shown cannot drift from what a
provider actually gets.

## Layout

Full-bleed split: the form sits in a narrow column in the left pane, and the
right pane holds the launch visual. Both panes are rounded and fill the window;
the form pane scrolls on its own when the register form runs long. Below 900px
the visual pane is hidden and the form goes full width.

## The visual

`tools/gen_visual.py` generates the SVG in the right-hand pane, and it is drawn
**to scale**: the planet radius is 2400 units for 6371 km, so one unit is
2.655 km, and every altitude follows from that.

- The 400 km orbit sits where it actually sits relative to the surface — it hugs
  the limb, because that is what low Earth orbit looks like.
- The ascent is a gravity turn: vertical off the pad, pitching over, reaching a
  zero flight-path angle at insertion, so the trace meets the orbit tangentially
  rather than crossing it.
It carries no labels, mission-clock stamps or telemetry readout on purpose: a
login screen displaying invented mission data reads as costume, not product.
The geometry is correct; the image just does not narrate itself.

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

## Account types

One account table, one login, with `account_type` on the user — not separate
launcher and operator logins. What differs between a launch provider and a
satellite operator is what they see *after* signing in, which is routing, not
authentication; splitting the login surface doubles the reset flows and support
load and produces the "wrong login page" failure.

Segmented by **intent, not identity**: a satellite manufacturer sometimes
procures the launch and sometimes does not, so "satellite operator" does not
reliably say which side of the market an account is on. "What brings you here"
does, and it maps straight onto what to show them.

| Slug              | On the form           | Shown on the account     |
| ----------------- | --------------------- | ------------------------ |
| `payload_owner`   | I need launch         | Payload owner            |
| `launch_provider` | I sell launch         | Launch service provider  |
| `broker`          | I broker launch       | Launch broker            |
| `supplier`        | I supply the mission  | Mission supplier         |

Brokers are kept separate from suppliers deliberately — an aggregator sitting
between buyer and provider has nothing in common with an insurer or a bus
manufacturer once matching exists. Finer detail (operator vs manufacturer vs
agency) belongs in the profile after signup, not in front of the button.

Types live in `lib/account-types.js`; adding one puts it in the radio group and
through validation. Slugs are what the database stores, so labels can be
reworded freely. A database created before this column existed gets it added in
place on the next start.

## Aether Agents

Not built. The tab carries a `Beta` chip and the page is a waitlist — it says
plainly that nothing runs yet, describes what an agent would watch for, and
collects one row per company. The note field is the useful part: it records
what people actually want an agent to do.

## Theming

Dark and light, toggled bottom-right on every page and remembered in
`localStorage`. With no stored choice it follows `prefers-color-scheme`, and
keeps following it until someone picks.

`theme.js` loads in `<head>` rather than at the end of `<body>` on purpose: the
stored choice has to be applied before first paint, or a light-mode user gets a
black flash on every navigation.

Only tokens change between themes — no rule is written twice. That required
tokenising the structural colours first (`--hair`, `--line`, `--line-strong`,
`--field-line`, `--track`, `--tint`, `--alt-bg`, `--arrow`, `--tick`), since a
hardcoded `rgba(255,255,255,…)` is invisible on white. The launch graphic stays
dark in both themes — it is a photograph of space, not a UI surface.

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
lib/account-types.js  account type slugs and labels
lib/missions.js    missions table and queries
lib/banding.js     what a provider is allowed to see
lib/mission-options.js  orbit, ride and form-factor lists
public/index.html  sign in and register
public/missions.html + missions.js   the requirements app
public/theme.css   shared tokens and form components
tools/gen_visual.py  regenerates the launch graphic
tools/seed.js      demo accounts and sample data
lib/pools.js       pools and membership
lib/launches.js    launches, capacity and the supply directory
lib/compatibility.js  the orbit rules shared by pools and launches
data/app.db        created on first run, gitignored
```
