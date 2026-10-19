# BlindSolve discovery audit — 19 October 2026

## Observed before changes

Production was `origin/main` b6cded8; the normal checkout was clean on `dev` with unrelated timing work ahead of main. SEO work starts from production in the isolated `seo/google-discovery` worktree. No timing branches or servers were used.

| Area | Live evidence and consequence |
| --- | --- |
| HTTP, HTTPS, hosts | HTTPS home returns 200 with HSTS. HTTP apex redirects 301 to HTTPS apex. HTTPS www redirects 301 to apex. HTTP www timed out on the first audit; that observation alone does not establish a DNS defect. |
| Title, description | Every route receives the same `BlindSolve` title and short 3BLD description. The title does not explain the product. |
| Canonical, social, icons | No canonical, Open Graph, Twitter, favicon declaration or manifest. No manifest is needed for the current non-installable app. |
| Robots | No robots meta or X-Robots-Tag on production. `/robots.txt` returns 200 **text/html containing the app**, not robots directives. No evidence of production being blocked by noindex. |
| Sitemap | `/sitemap.xml` returns 200 **text/html containing the app**, not XML. No usable sitemap or route discovery. |
| Raw HTML | Empty root. No headings, text or navigation until JavaScript loads. |
| Rendered home | Timer, scramble and session controls, but no heading or visible brand/product explanation. Primary navigation is buttons rather than crawlable anchors. Existing main/nav landmarks are present. |
| Routes and duplicates | `/pairs` and `/pairs/` both return 200 with the same generic HTML. Invented routes return 200 and redirect in JavaScript to the timer: soft-404 behavior. |
| Preview hosts | `blindsolve.pages.dev` returns 200 with no noindex header. `dev.blindsolve.pages.dev` already returns X-Robots-Tag: noindex from Cloudflare. |
| Authentication | Timer, letter pairs, flashcards and training are available as a guest. Authentication is optional. User mnemonics/history are private local or account state and are not suitable sitemap content. |
| Performance | Meaningful initial content depends entirely on JS. The configured build has a large initial application bundle (about 1.1 MB uncompressed with Supabase configured), plus separately loaded cube-search modules/WASM. No field Core Web Vitals data is available in this session; no Lighthouse or ranking score is claimed. Existing font subsetting and fingerprinted assets remain in place. |
| Security | Existing CSP restricts inline scripts. Preserve it; authorize only the exact generated JSON-LD hash. |

## Search evidence

The public search tool was queried for: `BlindSolve`, `BlindSolve cube`, `BlindSolve 3BLD`, `blind solve`, `blindfolded cube timer`, `3bld trainer`, `3x3 blindfold trainer`, `blindfolded rubik's cube trainer`, `M2 trainer`, `3BLD memo trainer`, and `site:blindsolve.com`. No blindsolve.com result was returned. Results included other cube tools, forum posts, astronomy plate-solving tools and (for M2) cycling trainers. These results do not establish precise Google ranks.

Direct Google browser query `site:blindsolve.com` returned **“did not match any documents.”** This is evidence of weak/no visible search presence, not a substitute for Search Console index coverage or URL Inspection.

Search Console opened its public signed-out introduction with “Start now” leading to Google sign-in. Property ownership, coverage, manual actions and URL Inspection are unavailable. No sitemap submission or indexing request has been performed, and no verification token can be invented.

## Changes and rationale

- Shared route registry supplies unique static and client-navigation titles, descriptions and production canonicals. Query strings and personal session data never enter metadata.
- Build-time HTML shells cover every existing app route; public shells have useful text and real navigation before JavaScript. This is not full application SSR or a reconstruction of user state.
- One getting-started page has the same complete source content in raw HTML and React. It describes actual settings, letter pairs, flashcards, drills and timer use. It explicitly distinguishes memo reconstruction from observed physical turns.
- Compact home H1 identifies BlindSolve and 3×3 blindfolded cube practice; Guide links to the helpful page. Primary navigation uses links and preserves the existing navigation guard and modified-click behavior.
- Generated XML sitemap includes exactly `/`, `/pairs`, `/flashcards`, `/training`, `/about`; no fabricated lastmod timestamps. robots.txt permits public crawling and assets and advertises the production sitemap for Google and Bing.
- Settings, setup, sign-in and admin feedback receive noindex. These paths are not security boundaries; authentication remains unchanged.
- Explicit extensionless HTML route files preserve direct app navigation when the top-level 404 disables Cloudflare's implicit SPA catch-all. `/memo` redirects permanently to `/training`; trailing slashes on known routes redirect to their canonical form. Unknown paths receive a real static 404 on Cloudflare.
- www redirect is declared in Pages configuration as well as the existing live redirect. No DNS changes were made.
- Root pages.dev and branch pages.dev hosts get X-Robots-Tag: noindex. Cloudflare non-main builds also receive noindex HTML/headers. Client metadata keeps nonproduction hosts noindex without breaking previews. Production main remains index/follow.
- WebSite and WebApplication JSON-LD truthfully describe the app, without invented ratings, offers, company information or breadcrumbs. JSON syntax and the matching CSP hash are checked in built-output validation. This does not promise a Google rich result.
- Added a small SVG favicon. Social titles/descriptions use summary metadata; no imaginary account handle or social image is claimed.
- Build output provides useful initial HTML without waiting for the application bundle. No domain logic, auth, sync, schema or dependency changes. Further bundle splitting should be a separately measured change; no unmeasured Core Web Vitals improvement is claimed.

## Validation and deployment record

`npm test`: 35 files / 187 tests passed outside the Windows sandbox. The initial sandbox run failed before executing tests because temporary-cache file renames were denied; rerunning resolved it. ESLint, TypeScript/build and `npm run test:seo` passed. The SEO check verifies all nine route heads, unique titles, canonical URLs, robots directives, the five sitemap entries, static H1/navigation, JSON-LD/CSP consistency, preview headers and the 404 document.

Desktop (1440×900) and mobile (390×844) production-build browser inspections show a compact label and unchanged timer workspace with no horizontal overflow. Browser regressions cover existing timing, reconstruction, guarded navigation, training, account UI and automated accessibility. A dev-server run's production-worker assertion is not meaningful because it requires hashed production assets; run that assertion against the built preview.

CI, pull request, final production checks and any remaining infrastructure issues are recorded in the final delivery report. Google Search Console work remains pending authentication. IndexNow was not added: sitemap discovery is standard and requires no extra credentials or infrastructure; Cloudflare account-level crawler hints cannot be inspected through this repository.

## Interpretation

The site was reachable and not explicitly blocked, but discovery endpoints, raw HTML context, links, canonicalization and route metadata were deficient. Fixing those improves technical indexability. It does not prove why Google has not indexed a particular URL or establish backlink authority as the principal limitation. Crawl/index coverage and real search performance need Search Console. Crawling and ranking can take days or weeks; useful community references and genuine links may help discovery, but no ranking position is guaranteed.

Reference behavior checked against [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Cloudflare headers](https://developers.cloudflare.com/pages/configuration/headers/), [redirects](https://developers.cloudflare.com/pages/configuration/redirects/) and [static page/404 handling](https://developers.cloudflare.com/pages/configuration/serving-pages/).
