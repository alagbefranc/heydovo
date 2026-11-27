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
- Hostnames for vendor-portal and admin-portal (each on its own hostname, not a path on heydovo.com).
- Telnyx webhook time limit (the secret-masking check must finish before the ack).

## Security design items raised in review
These came out of the independent security review of this pack. They are weaknesses in the original design that have not been changed yet. Decide each one before the build step named.
- PIN reset needs only an OTP sent to the same phone, so the PIN does not protect against someone holding the phone or the SIM (step 6).
- `wallet.hold` carries no proof that the PIN was verified. Approval arrives as a `pin.verified` event, and nothing restricts which Worker may publish it (steps 6, 12, 13).
- The two-person refund rule lives only in admin-service; `wallet.refund` carries no evidence of the approvals (steps 12, 19).
- auth-security has no allowed-caller table of its own: any Worker that binds it can create secure links for any user, start a PIN reset or require re-verification (step 6).
- The sender's phone number is the identity for chat and for vendor text commands. SMS sender numbers can be spoofed, so a spoofed vendor staff number could pause a store or accept and decline orders (steps 8, 16).
- The 7-day `track` link shows the pickup code, so anyone holding that link can collect the order (steps 6, 14).
- Secret masking covers text messages only, not voice transcripts, MCP tool arguments or photo captions (steps 16, 21, 22).
- Meta Muse account linking uses phone OTP only, and PIN links are returned to the MCP client (step 22).
- Terraform-managed Hyperdrive configs and database roles put role passwords in Terraform state, against the infra rule (step 3).
- The agent's output filter blocks PIN/OTP-like strings, but an address with a 4–6 digit number has to be confirmed back to the user (step 16).
