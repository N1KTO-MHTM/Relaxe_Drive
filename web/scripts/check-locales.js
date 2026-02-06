/**
 * Check that ru, es, ka have the same keys as en.json (no missing translations).
 * Run from repo root: node web/scripts/check-locales.js
 * Or from web: npm run check-locales
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');
const enPath = path.join(localesDir, 'en.json');
const others = ['ru.json', 'es.json', 'ka.json'];

function flatten(obj, prefix = '') {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      keys.push(...flatten(val, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = new Set(flatten(en));
let hasMissing = false;

for (const file of others) {
  const filePath = path.join(localesDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Missing file: ${file}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const locKeys = new Set(flatten(data));
  const missing = [...enKeys].filter((k) => !locKeys.has(k));
  const extra = [...locKeys].filter((k) => !enKeys.has(k));
  const lang = file.replace('.json', '');
  if (missing.length > 0) {
    hasMissing = true;
    console.log(`\n${lang}.json — missing ${missing.length} key(s):`);
    missing.sort().forEach((k) => console.log(`  - ${k}`));
  }
  if (extra.length > 0) {
    console.log(`\n${lang}.json — extra keys (not in en): ${extra.length}`);
    extra.sort().slice(0, 10).forEach((k) => console.log(`  + ${k}`));
    if (extra.length > 10) console.log(`  ... and ${extra.length - 10} more`);
  }
}

if (!hasMissing) {
  console.log('\nOK: All locales have the same keys as en.json.');
} else {
  process.exit(1);
}
