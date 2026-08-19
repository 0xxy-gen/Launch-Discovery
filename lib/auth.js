import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// scrypt parameters. N is the work factor; raising it slows both hashing and
// any offline attack on a stolen database.
const N = 16384, r = 8, p = 1, KEY_LEN = 64, SALT_LEN = 16;

export async function hashPassword(password) {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password, salt, KEY_LEN, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [scheme, n, rr, pp, saltB64, keyB64] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(password, salt, expected.length, {
    N: Number(n), r: Number(rr), p: Number(pp),
  });
  return timingSafeEqual(actual, expected);
}

// Session tokens are stored hashed, so a database leak does not hand over
// live sessions the way a leak of raw tokens would.
export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
