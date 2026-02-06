/**
 * Add missing locale keys from en.json to ru, es, ka (using English value as placeholder).
 * Run: node scripts/fill-missing-locales.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');
const enPath = path.join(localesDir, 'en.json');
const others = ['ru.json', 'es.json', 'ka.json'];

function getAtPath(obj, pathKeys) {
  let cur = obj;
  for (const k of pathKeys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

function setAtPath(obj, pathKeys, value) {
  let cur = obj;
  for (let i = 0; i < pathKeys.length - 1; i++) {
    const k = pathKeys[i];
    if (!(k in cur) || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[pathKeys[pathKeys.length - 1]] = value;
}

function flatten(obj, prefix = '') {
  const out = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      out.push(...flatten(val, fullKey));
    } else {
      out.push(fullKey);
    }
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = new Set(flatten(en));

for (const file of others) {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const locKeys = new Set(flatten(data));
  const missing = [...enKeys].filter((k) => !locKeys.has(k));
  if (missing.length === 0) {
    console.log(`${file}: no missing keys`);
    continue;
  }
  for (const fullKey of missing) {
    const pathKeys = fullKey.split('.');
    const value = getAtPath(en, pathKeys);
    if (value !== undefined) setAtPath(data, pathKeys, value);
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${file}: added ${missing.length} missing key(s)`);
}
