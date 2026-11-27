# apps/website

## Purpose
The public Hey Dovo website at `www.heydovo.com`: the landing page, the `/start` entry link used by QR codes and ads, the legal pages and `security.txt`. Mostly static, mobile-first, fast, English/French. Next.js on Cloudflare Workers, Astryx components themed via `packages/ui`.

It is built early (docs/BUILD_PLAN.md step 4) because provider approvals usually ask for a live website with privacy and terms pages: RCS brand verification, WhatsApp business verification, Stripe and SMS sender registration [CONFIRM what each provider needs].

## Routes
- `/` landing page: what Hey Dovo is, how it works (text or call one number), what you can order or book, where we serve, a "text us" call to action that uses the same links as `/start`, and a link for vendors to the vendor portal sign-up. If a landing page already exists, bring it in here instead of designing a new one [CONFIRM where the current landing page lives].
- `/start?src=…&ch=…` opens the best chat link for the device (docs: services/messaging-gateway/CLAUDE.md, "Entry links"): RCS deep link or `sms:` on phones, `https://wa.me/<number>` for WhatsApp, and on desktop a page showing the number and a QR code. `ch` is a fixed choice (`rcs`, `sms` or `wa`); anything else falls back to device detection. The pre-filled start message carries the tag in one fixed shape, `(ref <src>)`, which messaging-gateway strips and records.
- `/terms`, `/privacy`, `/refunds`, `/vendor-terms` (EN/FR) from the approved legal drafts [CONFIRM: drafts and the bracketed policy numbers]. Each page shows its version and effective date; the version matches what user-service records in `consents`.
- `/.well-known/security.txt` (RFC 9116: Contact, Expires, Preferred-Languages, Policy) for responsible disclosure [CONFIRM contact address].
- `robots.txt`, `sitemap.xml`, and French pages under `/fr/…` with `hreflang` tags.

## Hostnames (the PIN pages keep their own origin)
- This app is served only from `www.heydovo.com`.
- On the apex `heydovo.com`, the only HTML comes from `apps/secure-pages` under `/l/*`. Every other apex path that is not an API route is a redirect to the same path on `www` (a Cloudflare redirect rule in `infra/`, no Worker code), so `heydovo.com/start?src=…` on a poster and `heydovo.com/.well-known/security.txt` still work.
- Why: a browser treats `www.heydovo.com` and `heydovo.com` as different origins. Scripts, analytics, storage and service workers on this site then cannot touch the PIN and payment pages.
- Never define routes under `/l/` or `/api/`. Never register a service worker or send a `Service-Worker-Allowed` header. Never set a cookie scoped to `.heydovo.com`.

## Components
Reuse BrandHeader, LanguageToggle and base components from `packages/ui`, plus Hero, HowItWorks, ServiceAreaNote, VendorCallout, StartButtons (device-aware), QrCard, LegalPage, Footer.

## Rules
- No forms, no logins, no calls to api-gateway at launch. Nothing here reads or writes customer data.
- `/start` only ever builds links to our own number, RCS agent and WhatsApp number from config. `src` is a short tag matched against `^[a-z0-9_-]{1,40}$`; anything else is dropped. Never redirect to a URL taken from the query string.
- Count `/start` opens by `src` and device type in Analytics Engine. No personal data, no cookies.
- Analytics: cookieless Cloudflare Web Analytics only, installed as the manual snippet in this app. Automatic injection stays off for the zone, so the beacon can never appear on `/l/*`. No advertising pixels or third-party trackers without recorded consent [CONFIRM with privacy review: Law 25].
- Security headers: CSP without inline scripts (self and the Cloudflare Web Analytics script only), HSTS, Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options DENY.
- Works well on a cheap Android phone on 4G: static rendering, small images through Cloudflare Images.
- Copy states that Dovo is an AI assistant and never shows vendor or customer phone numbers.
- For design references use the Refero MCP server (root CLAUDE.md, "MCP servers"); brand tokens come from Figma via `packages/ui`.

## Tests
Playwright for every page on mobile + desktop (WebKit, Chromium, Firefox), EN/FR, axe AA. `/start` device matrix (iPhone, Android, desktop) and `src` handling (valid, too long, script injection, external URL). `security.txt` present and not expired. Legal page versions match the consent versions. CSP violations = test failure. No service worker is registered and no cookie is set. The apex redirects every path except `/l/*` and API routes to `www`. Lighthouse performance budget on the landing page.
