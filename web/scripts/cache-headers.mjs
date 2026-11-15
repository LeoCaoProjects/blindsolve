import { readdir } from 'node:fs/promises';

export const immutablePolicy = 'public, max-age=31536000, immutable';
export const isHashedAsset = (name) => /-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|wasm)$/.test(name);

export async function addAssetCacheHeaders(headers, directory = 'dist/assets') {
  // Exact existing build outputs only: a wildcard also matches missing assets
  // and can accidentally cache a 404 (or HTML fallback) for a year.
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && isHashedAsset(entry.name))
    .map((entry) => entry.name).sort();
  const result = headers + files.map((name) => `\n/assets/${name}\n  Cache-Control: ${immutablePolicy}\n`).join('');
  const rules = result.split('\n').filter((line) => line && !/^\s|^#/.test(line));
  if (rules.length > 100) throw new Error('Cloudflare Pages _headers exceeds 100 rules; review asset cache rules before deploying.');
  return result;
}
