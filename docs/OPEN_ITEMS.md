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
- Delivery fee when the booked courier fee is lower than the fee shown: return the difference to the user, or keep the fee shown.
- Uber Direct billing cycle for reconciling delivery payables.
- Existing landing page: where it lives, and whether to import it into apps/website or design a new one.
- Website: what each provider needs to see on it for approval (RCS brand verification, WhatsApp business verification, Stripe, SMS sender registration); security.txt contact address; analytics consent under Law 25.
- French shortcut words RAMASSAGE (PICKUP), PLUS (MORE) and REPRENDRE (START) reviewed by a native speaker.
- Telnyx keywords: support for custom opt-in/opt-out words, and whether Telnyx or the carriers treat CANCEL, END or QUIT as opt-out words by default (CANCEL is our "cancel my order" shortcut).
