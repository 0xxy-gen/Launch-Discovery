// Attaches any logo files dropped into public/logos/ to their company.
//
// The app already lets a provider upload its own logo on the profile page —
// this is the same thing done in bulk, for a demo database where nobody has
// signed in to do it themselves. Nothing is bundled with the repo: the folder
// is gitignored, so whatever is attached is whatever you put there.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'logos');

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let files;
try {
  files = readdirSync(dir).filter(f => MIME[extname(f).toLowerCase()]);
} catch {
  console.log('No public/logos directory — nothing to attach.');
  process.exit(0);
}

if (!files.length) {
  console.log('No logo files in public/logos — providers keep their monograms.');
  process.exit(0);
}

// slug -> company, so a file can be named after the company as it is displayed
const companies = new Map(
  db.prepare("SELECT id, name FROM companies WHERE name != ''").all()
    .map(c => [slug(c.name), c]));

const set = db.prepare('UPDATE companies SET logo = ? WHERE id = ?');
let attached = 0;

for (const file of files) {
  const key = slug(basename(file, extname(file)));
  const company = companies.get(key);
  if (!company) {
    console.log(`  ? ${file.padEnd(34)} no company named "${key.replace(/-/g, ' ')}"`);
    continue;
  }

  const bytes = statSync(join(dir, file)).size;
  if (bytes > 400_000) {
    console.log(`  ! ${file.padEnd(34)} ${Math.round(bytes / 1024)} KB — too large, skipped`);
    continue;
  }

  const mime = MIME[extname(file).toLowerCase()];
  const data = `data:${mime};base64,${readFileSync(join(dir, file)).toString('base64')}`;
  set.run(data, company.id);
  attached += 1;
  console.log(`  + ${file.padEnd(34)} ${company.name} (${Math.round(bytes / 1024)} KB)`);
}

console.log(`\n${attached} logo${attached === 1 ? '' : 's'} attached.`);
if (attached) {
  console.log('These are other companies\' trademarks — get permission before showing them outside your team.');
}
