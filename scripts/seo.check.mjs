import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

const preview = process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH !== 'main';
const pages = JSON.parse(await readFile('src/seo/pages.json', 'utf8'));
const sitemap = new JSDOM(await readFile('dist/sitemap.xml', 'utf8'), { contentType: 'application/xml' }).window.document;
const urls = [...sitemap.querySelectorAll('loc')].map((node) => node.textContent);
assert.deepEqual(urls, Object.entries(pages).filter(([, page]) => !page.noindex).map(([path]) => `https://blindsolve.com${path}`));
assert.match(await readFile('dist/robots.txt', 'utf8'), /Allow: \/\n\nSitemap: https:\/\/blindsolve.com\/sitemap.xml/);
const headers = await readFile('dist/_headers', 'utf8');
const titles = new Set();
for (const [path, page] of Object.entries(pages)) {
  const file = path === '/' ? 'dist/index.html' : `dist${path}.html`;
  const doc = new JSDOM(await readFile(file, 'utf8')).window.document;
  assert.equal(doc.title, page.title);
  assert.ok(!titles.has(doc.title)); titles.add(doc.title);
  assert.equal(doc.querySelector('link[rel=canonical]').href, `https://blindsolve.com${path}`);
  assert.equal(doc.querySelector('meta[name=description]').content, page.description);
  assert.equal(doc.querySelector('meta[name=robots]').content, preview || page.noindex ? 'noindex, follow' : 'index, follow');
  assert.equal(doc.querySelectorAll('h1').length, 1);
  assert.ok(doc.querySelector('main a[href="/"]'));
  assert.ok(!doc.body.textContent.includes('undefined'));
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(script.textContent);
    assert.equal(data['@graph'][0].name, 'BlindSolve');
    const hash = createHash('sha256').update(script.textContent).digest('base64');
    assert.ok(headers.includes(`'sha256-${hash}'`));
  }
}
assert.ok(headers.includes('https://blindsolve.pages.dev/*\n  X-Robots-Tag: noindex'));
assert.ok(headers.includes('https://:branch.blindsolve.pages.dev/*\n  X-Robots-Tag: noindex'));
assert.equal(headers.split('\n').filter((line) => line === '/*').length, 1, 'Repeated wildcard blocks can discard security headers');
assert.match(headers, /Content-Security-Policy:.*script-src 'self' 'sha256-/);
assert.match(headers, /X-Frame-Options: DENY/);
const globalBlock = headers.split('\n\n')[0];
assert.equal(globalBlock.includes('X-Robots-Tag: noindex'), preview);
const missing = new JSDOM(await readFile('dist/404.html', 'utf8')).window.document;
assert.equal(missing.querySelector('meta[name=robots]').content, 'noindex, follow');
console.log(`SEO output verified: ${titles.size} unique route heads, ${urls.length} sitemap URLs, JSON-LD/CSP, preview rules and 404.`);
