# messaging-gateway

## Purpose
Connects Hey Dovo to **Telnyx**, our single provider for messaging and voice: RCS (with automatic SMS/MMS fallback), WhatsApp, and phone calls (Telnyx Voice AI), all on one Hey Dovo number. Receives and sends; never decides what to say. Each Telnyx channel sits behind the common `ChannelAdapter` interface so another provider could be added later without touching other services.

## Owns (schema `messaging`)
- `channel_accounts` (provider, channel rcs|sms|whatsapp|voice, sender number / RCS agent id / WhatsApp number, messaging_profile_id, enabled)
- `inbound_messages` (id, provider_message_id UNIQUE, from_e164 NULLABLE, from_bsuid NULLABLE, channel, type text|button|list|location|media|flow, button_id, text_redacted, redaction_kinds, media_keys, received_at)
- `outbound_messages` (id, idempotency_key UNIQUE, to_e164, channel_requested, channel_delivered (rcs|sms|mms|whatsapp), text_redacted, status, provider_message_id, error, sent_at, delivered_at)
- `contact_channels` (phone_e164 NULLABLE, whatsapp_bsuid NULLABLE, last_inbound_channel, rcs_capable, whatsapp_window_expires_at = last inbound WhatsApp message + 24 h)
- `opt_outs` (phone_e164, keyword, at)

## Telnyx channels
- **RCS (default for chat)**: send through the Telnyx RCS API with `sms_fallback` / `mms_fallback` set, so phones or carriers without RCS automatically get SMS/MMS from our Telnyx number. Fallback is plain text only (no rich cards), so every rich message must also carry a complete plain-text version that includes the link. Use RCS suggested replies (YES / CHANGE / CANCEL) and "open URL" actions for PIN and payment links. Requires an approved RCS agent (brand verification with Google and carrier launch in Canada) [CONFIRM timeline and Canadian carrier coverage].
  - iPhone: iOS 18+ users get RCS only where their carrier supports business RCS; otherwise SMS. Test that links are tappable on iPhone in both RCS and SMS [CONFIRM].
- **SMS/MMS**: Canadian long code (or toll-free) on a Telnyx messaging profile; used as the RCS fallback and when a user texts us by SMS. Complete any Canadian sender registration Telnyx requires [CONFIRM].
- **WhatsApp** (see "WhatsApp details" below): WhatsApp Business Platform through Telnyx on the same number. SMS and voice keep working on that number.
- **Voice**: the same number receives calls; Telnyx Voice AI assistant answers as Dovo. Its tool webhooks hit `/voice/tools/*`, which forward to agent-orchestrator's voice-session RPC.
- **Number lookup**: RPC `lookupNumber(phoneE164)` wraps Telnyx Number Lookup and reports a recent SIM change or port. Called only by auth-security before a PIN reset [CONFIRM availability in Canada].
- Docs: https://developers.telnyx.com (Messaging, RCS, WhatsApp, Voice AI).

## WhatsApp details
- **Setup** (one-time, ops): paid Telnyx account (trial accounts can't use WhatsApp) → Telnyx Portal → Messaging → WhatsApp → Embedded Signup with our Meta business portfolio → Meta creates the WhatsApp Business Account (WABA) → verify the Hey Dovo number by **voice call** (Meta may not deliver SMS codes to virtual numbers) → assign the number to our messaging profile whose webhook points to this service. Set the display name ("Hey Dovo") and complete the business profile before submitting templates.
- **Send**: `POST https://api.telnyx.com/v2/messages/whatsapp` with `from`, `to` (E.164 or BSUID) and `whatsapp_message` (`type`: text, template, image, document, location, interactive, reaction…). Use `biz_opaque_callback_data` to carry our outbound message id for webhook matching.
- **24-hour window**: text, media and interactive messages only within 24 h of the user's last WhatsApp message. Outside it, only Meta-approved templates. Enforce in code from `whatsapp_window_expires_at`; error 40008 = template not usable or window closed → fall back to RCS/SMS.
- **Interactive messages** (map from our generic message model):
  - `button` (max 3 quick replies) → YES / CHANGE / CANCEL on every summary. Button ids are deterministic payloads, e.g. `confirm:<summaryHash>`, `change:<draftRef>`, `cancel:<draftRef>`.
  - `cta_url` → "Approve with PIN", "Pay now", "Track order" link buttons.
  - `list` → choosing between vendors/plumbers (row id = vendor ref).
  - `location_request_message` → address step in onboarding (user shares a pin; still confirm the street address).
  - Flows: not used for PIN or payments (those stay on secure-pages).
- **Templates** (category UTILITY, EN `en` + FR `fr`, created via `POST /v2/whatsapp/message_templates`, Meta review 24–48 h, names can't be reused for 30 days): `order_confirmed`, `order_ready_pickup`, `order_out_for_delivery`, `order_delivered`, `order_cancelled_refund`, `refund_issued`, `booking_reminder`, `booking_on_the_way`, `final_quote_ready`, `pin_locked`, `wallet_low_balance`, `review_request`. Each has sample values. MARKETING templates only for users with CASL marketing consent. Approved template ids stored in config, keyed by template key + language.
- **Inbound webhooks** (messaging profile): `message.received` (text, button reply, list reply, location, media, flow reply); delivery: `message.sent`, `message.finalized` (check `to[].status`), `message.read`. Inbound media comes as a Telnyx-hosted `url` (fallback: `GET /v2/whatsapp/media/{number}/{id}`) → copy into R2, never keep provider URLs.
- **BSUID**: users who hide their number behind a WhatsApp username arrive with `from_user_id` (business-scoped user id) instead of a phone number. Publish `message.received` with `fromBsuid`; user-service links a BSUID to an account only after the user verifies their phone number with OTP on the setup page. Replies can be sent to the BSUID.
- **Limits**: new Meta business portfolios start at 250 business-initiated messaging limit and 2 registered numbers; complete Meta business verification before launch to raise them.
- **Pricing**: Meta charges per template message by category (authentication lowest, utility middle, marketing highest) plus Telnyx fees [CONFIRM current rates]. Keep order updates in UTILITY; send free-form replies inside the window whenever possible.

## Routing rule (outbound)
Reply on the channel the user last wrote from (`contact_channels.last_inbound_channel`). For proactive updates: WhatsApp if inside the 24 h window or an approved template fits → else RCS with SMS fallback. Record which channel actually delivered.

## Entry links (onboarding, marketing)
- RCS: Telnyx RCS deep links (`sms:` with the RCS agent address) pre-filled with a start message and source tag.
- SMS: `sms:<number>?body=…`. WhatsApp: `https://wa.me/<number>?text=…`.
- QR codes on posters and in vendor shops point to `heydovo.com/start?src=…`, which opens the best link for the device. `apps/website` owns that page (the apex redirects to `www.heydovo.com/start`).
- A start message carries its source tag in one fixed shape, `(ref <tag>)`, with the tag matching `^[a-z0-9_-]{1,40}$`. The gateway strips it before publishing `message.received`, records it for attribution, and drops anything that does not match. The tag never reaches the model.

## Inbound pipeline
Verify Telnyx webhook signature (Ed25519 signature + timestamp headers; reject stale timestamps) [CONFIRM header names] → rate limit per number (e.g. 30 msgs/min) → dedupe on provider_message_id → mask secrets in memory (docs/ALGORITHMS.md §15: cards by Luhn check; PIN/OTP candidates in one `auth.checkSecretExposure` call, 1 s in total, never retried) → store the redacted text and the redaction kinds → ack Telnyx → then handle STOP/START/HELP (and ARRÊT/AIDE/REPRENDRE), strip the source tag from a start message (see Entry links), update contact_channels and publish `message.received`. The raw webhook body is never written to a Queue, KV, Durable Object storage, logs or error reports; only the redacted message is. Keep the path up to the ack inside Telnyx's webhook time limit [CONFIRM limit].
Media (photos): download to R2 (private), pass keys, never raw URLs.
Keywords [CONFIRM]: that Telnyx supports custom opt-in/opt-out words (REPRENDRE, ARRÊT), and whether Telnyx or the carriers treat CANCEL, END or QUIT as opt-out words by default. CANCEL is our "cancel my order" shortcut and must reach the agent.

## Outbound
Consume `message.send` → idempotent on idempotency_key → apply routing rule → send via Telnyx → record → publish `message.delivered` / `message.failed`. Respect opt-outs for non-essential messages. Replies to a user's own message are always allowed.

## Events
Publishes: message.received, message.delivered, message.failed, messaging.opted_out, messaging.opted_in, security.secret_exposed.
Consumes: message.send.

## Must never
- Call OpenAI or contain conversation logic. Store, log or queue unredacted PINs, OTPs or cards (candidate digits go only to `auth.checkSecretExposure`, in memory). Expose Telnyx keys. Send WhatsApp free-form messages outside the 24 h window.

## Tests
Webhook signature (valid, forged, replayed/stale), dedupe, masking cases (digits that match the sender's PIN → redacted + RESET_REQUIRED; a typed OTP → redacted + cancelled; a bare house number and "buzzer code 4821" that match nothing → untouched; "my pin is 4821" that matches nothing → redacted, no reset; "yes 4821" while a PIN link is open; an open setup link or an unlinked BSUID → redacted with no comparison; a 4th candidate in one message; limit reached → redacted, no reset; the call failing or timing out; Luhn card; "2 bags" and refs like D4821 untouched; the raw body absent from queues, logs and error reports), source tag stripped from start messages, RCS send with SMS fallback (rich + plain text both complete), WhatsApp window and template rules, button/list/location parsing, BSUID inbound and reply, template fallback to RCS/SMS on 40008, channel routing, opt-outs, idempotent sends, media to R2, voice tool webhook → agent session.
