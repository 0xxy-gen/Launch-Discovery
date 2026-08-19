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
| Main operating country | yes      | dropdown, ~160 countries                 |
| LinkedIn               | no       | validated as a linkedin.com URL if given |
| Country code           | yes      | dropdown, dial code per country          |
| Phone number           | yes      | local number, digits only                |

Sign in checks the email/password against registered accounts; the signed-in
view shows the account's role, organisation, country and phone.

## Theme

Palette comes from `mission-management/app/globals.css` (black ground, cyan
accent, zero border radius). Type and buttons follow aetherspace.tech: Inter
with `tracking-tighter` mixed-weight headlines, JetBrains Mono for uppercase
micro-labels, and solid black-on-colour button fills.

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
