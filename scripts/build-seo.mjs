import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { addAssetCacheHeaders } from './cache-headers.mjs';

const { title: appTitle } = JSON.parse(await readFile(new URL('../src/seo/site.json', import.meta.url), 'utf8'));
const pages = JSON.parse(await readFile(new URL('../src/seo/pages.json', import.meta.url), 'utf8'));
const template = await readFile('dist/index.html', 'utf8');
const preview = process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH !== 'main';
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const origin = 'https://blindsolve.com';
const nav = '<nav aria-label="Sections"><a href="/">Timer</a> · <a href="/pairs">Letter Pairs</a> · <a href="/flashcards">Flashcards</a> · <a href="/training">Training</a></nav>';
const schema = JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'BlindSolve', url: `${origin}/` },
  { '@type': 'WebApplication', '@id': `${origin}/#app`, name: 'BlindSolve', url: `${origin}/`, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript and a modern web browser', description: pages['/'].description }
] });
for (const [path, page] of Object.entries(pages)) {
  const url = origin + path;
  const head = `<title>${escape(appTitle)}</title>
    <meta name="description" content="${escape(page.description)}" />
    <meta name="robots" content="${preview || page.noindex ? 'noindex, follow' : 'index, follow'}" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" type="image/svg+xml" href="/favicon-3bld-padded-v2.svg" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-padded-v2-16.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-padded-v2-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-padded-v2.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BlindSolve" />
    <meta property="og:title" content="${escape(appTitle)}" />
    <meta property="og:description" content="${escape(page.description)}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escape(appTitle)}" />
    <meta name="twitter:description" content="${escape(page.description)}" />
    ${path === '/' ? `<script type="application/ld+json">${schema}</script>` : ''}`;
  let html = template.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, head);
  const content = `<main><h1>BlindSolve — ${escape(page.heading)}</h1><p>${escape(page.description)}</p>${nav}<p>Loading your practice workspace… JavaScript is required for interactive practice.</p></main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  const file = path === '/' ? 'dist/index.html' : `dist${path}.html`;
  await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  await writeFile(file, html);
}
const urls = Object.entries(pages).filter(([, page]) => !page.noindex).map(([path]) => `<url><loc>${origin}${path}</loc></url>`).join('\n');
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile('dist/404.html', '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, follow"><title>BlindSolve</title><link rel="icon" type="image/svg+xml" href="/favicon-3bld-padded-v2.svg"></head><body><main><h1>Page not found</h1><p>This address does not exist.</p><a href="/">Return to the BlindSolve timer</a></main></body></html>');
// Allow only the exact inert JSON-LD block; do not weaken the script policy for executable inline scripts.
const hash = createHash('sha256').update(schema).digest('base64');
let headers = (await readFile('dist/_headers', 'utf8')).replaceAll('\r\n', '\n');
headers = headers.replace("script-src 'self';", `script-src 'self' 'sha256-${hash}';`);
if (preview) headers += '  X-Robots-Tag: noindex, follow\n';
headers += '\nhttps://blindsolve.pages.dev/*\n  X-Robots-Tag: noindex, follow\n\nhttps://:branch.blindsolve.pages.dev/*\n  X-Robots-Tag: noindex, follow\n';
for (const [path, page] of Object.entries(pages)) if (page.noindex) headers += `\n${path}\n  X-Robots-Tag: noindex, follow\n`;
for (const path of ['/', '/index.html', ...Object.keys(pages).filter((path) => path !== '/').flatMap((path) => [path, `${path}.html`])]) {
  headers += `\n${path}\n  Cache-Control: public, max-age=0, must-revalidate\n`;
}
await writeFile('dist/_headers', await addAssetCacheHeaders(headers));
