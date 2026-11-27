# apps/secure-pages

## Purpose
The short web pages customers open from chat links. Mobile-first, fast, branded, accessible, English/French. Next.js on Cloudflare Workers, Astryx components themed via `packages/ui`.

## Routes
`/l/[token]` resolves the link (auth-security `resolveLink`) and renders by purpose:
- **Setup** (onboarding): OTP → accept Terms + Privacy (links to legal pages) → marketing choice (unticked) → create PIN (twice) → optional email → done → return to chat.
- **PIN approve**: order summary + amount → PinPad → Next → success → return to chat; wrong PIN shows attempts left; locked shows reset path.
- **PIN reset**: OTP → new PIN twice.
- **Top-up**: amount chips ($25/$50/$100/custom) → Stripe Checkout.
- **Pay link**: summary → Stripe Checkout (card, Apple Pay, Google Pay).
- **Track**: read-only order status timeline, courier ETA, pickup code for pickup orders.
- **Privacy request**: access/correct/delete/portability form.
- Legal pages (`/terms`, `/privacy`, `/refunds`, `/vendor-terms`, EN/FR) live in `apps/website` at `www.heydovo.com`. Link to them; do not copy them here.

## Components
BrandHeader, OrderSummaryCard, AmountDisplay, PinPad, OtpInput, ConsentCheckbox, ProgressSteps, AddressConfirm, StatusTimeline, PickupCodeCard, SuccessReturnToChat, ErrorState, ExpiredLinkState, LockedState, LanguageToggle.

## Rules
- This app owns `heydovo.com/l/*` and is the only thing that serves HTML on the apex host; the public website is on `www.heydovo.com`, a separate browser origin. Keep pages and assets under `/l/` (for example Next.js `basePath: '/l'`).
- No cookies and no web storage: the link token is the only credential. Responses send `Cache-Control: no-store, no-transform`. The CSP is set by this Worker, never by a hostname-wide rule. Never register a service worker.
- Token only in the path; never put PII in URLs or analytics. Referrer-Policy no-referrer.
- PinPad: `type="password"` + `inputmode="numeric"`, no autofill/autocomplete, no keystroke logging, masked, 44px+ touch targets, screen-reader labels.
- Turnstile on every POST. Strict CSP (self, Stripe, Turnstile only). No third-party analytics scripts.
- Return-to-chat deep links back to the channel recorded on the link: RCS/SMS (`sms:` with our number or the RCS agent deep link) or WhatsApp (`https://wa.me/<number>`).
- All calls through api-gateway.

## Tests
Playwright for every route on mobile + desktop (WebKit, Chromium, Firefox), EN/FR, axe AA, expired/used/tampered tokens, PIN errors/lockout, Stripe test-mode flows, CSP violations = test failure.
