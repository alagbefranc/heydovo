# Open items to confirm before or during the build

Search the repo for `[CONFIRM]` too. Resolve these before the related build step.

- Company legal name, address, privacy officer, support contacts.
- Launch city and launch region polygon.
- Supabase Canadian region availability for the project.
- Tax handling: GST/HST/PST/QST per province and marketplace-facilitator obligations (accountant).
- Wallet: FINTRAC money-services and provincial prepaid rules (lawyer); wallet limits.
- Stripe: Connect account type, Checkout minimum expiry, refund window for wallet closure.
- Telnyx RCS: agent approval (Google brand verification + Canadian carrier launch), timeline, which Canadian carriers support business RCS on iPhone, links tappable on iPhone.
- Telnyx SMS: Canadian number type (long code vs toll-free) and sender registration requirements.
- Telnyx WhatsApp: Meta business portfolio + business verification (raises the 250 limit), display name and business profile, Embedded Signup on our Telnyx number (voice verification), EN/FR UTILITY template approvals (list in messaging-gateway), current Meta/Telnyx per-message prices.
- Telnyx Voice AI: assistant tool webhooks, signature header names, number lookup for SIM-swap risk.
- DoorDash Drive production access (currently restricted) and Uber Direct approval; both webhook signing methods.
- Maps/geocoding provider (Google or Mapbox) and costs.
- OpenAI models for chat and embeddings (dimensions), AI Gateway budgets.
- Cloudflare Email Service sending limits; Cloudflare remote MCP packages.
- argon2id parameters within Workers CPU/memory limits (benchmark).
- Trade insurance minimum and required licences per province.
- Payout day and dispute buffer.
- Figma link for the design tokens.
- Policy numbers in brackets in the legal drafts (refund windows, notice periods).
