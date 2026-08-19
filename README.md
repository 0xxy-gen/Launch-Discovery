# Launch Discovery

A self-contained email registration / sign-in page.

## Run it

Open `index.html` in a browser, or serve it:

```
python3 -m http.server 8000
```

then visit http://localhost:8000

## What it does

- **Register** tab: email + password + confirm, with inline validation
  (valid email format, 8-character minimum, passwords must match,
  duplicate emails rejected).
- **Sign in** tab: checks the email/password against registered accounts.
- Signed-in state shows the account and a sign-out button.
- Light and dark themes follow the OS setting.

## Storage

Accounts are kept in this browser's `localStorage` under `ld.users`, and the
active session under `ld.session`. Passwords are SHA-256 hashed with the email
as a salt — that keeps plaintext out of storage, but it is **not** real
password security: there is no server, no rate limiting, and anyone with access
to the browser can read the store.

## Making it real

Replace the two branches in the `form` submit handler in `index.html` with
`fetch` calls to your backend:

- register → `POST /api/register` with `{ email, password }`
- sign in  → `POST /api/login` with `{ email, password }`

Hash passwords server-side with bcrypt/argon2, issue an httpOnly session
cookie, and drop the `localStorage` helpers.
