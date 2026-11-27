# Open items to confirm before or during the build

Search the repo for `[CONFIRM]` too. Resolve these before the related build step.

- Company legal name, address, privacy officer, support contacts.
- Launch city and launch region polygon.
- Supabase Canadian region availability for the project.
- Tax handling: GST/HST/PST/QST per province and marketplace-facilitator obligations (accountant). Include: whether the $2.50 service fee and the delivery fee are taxable and at what rate; who remits tax on items (vendor or platform); whether GST/HST applies to the commission charged to vendors.
- Wallet: FINTRAC money-services and provincial prepaid rules (lawyer); wallet limits.
- Stripe: Connect account type, Checkout minimum expiry, refund window for wallet closure.
- Telnyx RCS: agent approval (Google brand verification + Canadian carrier launch), timeline, which Canadian carriers support business RCS on iPhone, links tappable on iPhone.
- Telnyx SMS: Canadian number type (long code vs toll-free) and sender registration requirements.
- Telnyx WhatsApp: Meta business portfolio + business verification (raises the 250 limit), display name and business profile, Embedded Signup on our Telnyx number (voice verification), EN/FR UTILITY template approvals (list in messaging-gateway), current Meta/Telnyx per-message prices.
- Telnyx Voice AI: assistant tool webhooks, signature header names, number lookup for SIM-swap risk.
- Uber Direct approval and production access (our only courier at launch); its webhook signing method.
- Maps/geocoding provider (Google or Mapbox) and costs.
- OpenAI models for chat and embeddings (dimensions), AI Gateway budgets.
- Cloudflare Email Service sending limits; Cloudflare remote MCP packages.
- argon2id parameters within Workers CPU/memory limits (benchmark).
- Trade insurance minimum and required licences per province.
- Payout day and dispute buffer.
- Figma link for the design tokens.
- Policy numbers in brackets in the legal drafts (refund windows, notice periods).
- Delivery fee wording: the customer pays the fee quoted, and the platform absorbs increases and keeps decreases (legal check); how long an Uber Direct quote stays valid.
- Uber Direct billing cycle for reconciling delivery payables.
- Existing landing page: where it lives, and whether to import it into apps/website or design a new one.
- Website: what each provider needs to see on it for approval (RCS brand verification, WhatsApp business verification, Stripe, SMS sender registration); security.txt contact address; analytics consent under Law 25.
- French shortcut words RAMASSAGE (PICKUP), PLUS (MORE) and REPRENDRE (START) reviewed by a native speaker.
- Telnyx keywords: support for custom opt-in/opt-out words, and whether Telnyx or the carriers treat CANCEL, END or QUIT as opt-out words by default (CANCEL is our "cancel my order" shortcut).
- Hostnames for vendor-portal and admin-portal (each on its own hostname, not a path on heydovo.com).
- Telnyx webhook time limit (the secret-masking check must finish before the ack).
- SIM-change lookup: Telnyx Number Lookup availability in Canada, and the block length after a reported change (default 72 hours).
- RCS: whether the sender of an inbound RCS message is verified (decides whether RCS commands need a reply code).
- Delivery: the absorb cap per order (default $5.00), what happens when nobody decides on an over-cap order (default: book after 10 minutes), and whether to book the courier at acceptance instead of at ready (docs/ALGORITHMS.md §19).
- Blocks: the support identity check; whether a SIM-change block ends by itself after 72 hours; whether lifting a freeze needs two staff; review deadlines (docs/ALGORITHMS.md §18).
- Refunds: the amount from which a refund needs two approvals; chargeback account policy (docs/ALGORITHMS.md §20, §21).
- Vendors: default alert recipients (owner and managers); whether one person may be staff at two vendors; which roles may pause a store; French vendor words; whether substitutions should also work by text (docs/ALGORITHMS.md §17).
- Retention: security events 24 months, vendor documents 12 months after closing, financial records 7 years, legal holds (docs/ALGORITHMS.md §22).
- Voice: Telnyx-side recording and transcript retention controls. Photos: no OCR at launch (docs/ALGORITHMS.md §23).
- Operations: monitoring tool and on-call, recovery targets, Supabase plan with point-in-time recovery, production accounts (docs/LAUNCH.md).
- CRA reporting for digital platform operators: whether it applies, and what to collect from vendors (docs/LAUNCH.md).
- Terraform: whether the Cloudflare and Supabase providers support write-only secret arguments (docs/SECURITY.md).

## Security design items raised in review
Decided or designed on 2026-11-27 and written into the docs: the spending hold after a PIN reset; PIN approvals that the wallet redeems itself; reply codes by SMS only for commands that cost money or stop the store; no pickup code on the tracking page; staff approval proof on refunds; an allowed-caller table for auth-security; masking for captions, voice and Meta Muse arguments; Meta Muse linking with OTP and PIN, with links texted to the phone; no secrets in Terraform state; a reply filter that lets real addresses through.

Accepted by choice, to keep the conversation low-friction:
- On SMS the sender's phone number is the identity for chat, and it can be faked. The commands that cost money or stop a store need a reply code. Plain accept and decline, RESUME, address changes, disputes and reviews do not; they rely on the confirmation message, the dashboard and the step-up rule (steps 8, 16).
