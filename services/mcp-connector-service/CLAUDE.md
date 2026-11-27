# mcp-connector-service

## Purpose
Public remote MCP server (HTTPS) so Meta Muse users can use Hey Dovo. Same tools, guards, confirmation and PIN rules as chat.

## Tools (with annotations: readOnlyHint / destructiveHint)
search_products, search_services, get_delivery_quote, create_order_draft, confirm_order (texts the PIN or payment link to the owner's own phone and returns only a status; never charges and never returns a link), create_booking_draft, confirm_booking, track, get_balance, create_topup_link, cancel (shows refund first).

## Key logic
- Built on Cloudflare's remote MCP support (Agents SDK / workers-oauth-provider) [CONFIRM current packages].
- Account linking: OAuth 2.1 with PKCE. Our login is phone OTP and then the wallet PIN, both on our secure page (docs/ALGORITHMS.md §24). Tokens are scoped (`read`, `order`), short-lived, rotating and revocable.
- Calls services through the same RPC clients and guard logic as agent-orchestrator (shared package, no duplication).
- Rate limits per linked account; audit logging.

## Muse submission checklist
Live public HTTPS endpoint, docs, auth method, connector name "Hey Dovo", company, website heydovo.com, example prompts written as users would type them, 512×512 icon (PNG/SVG), payments flag, contact. Submit at https://platform.muse.ai/ only after the full test suite passes.

## Must never
- Charge through MCP without the PIN/payment step. Return other users' data.

## Tests
MCP protocol conformance, OAuth flows (valid, expired, revoked), each tool's guard, rate limits, injection attempts via tool arguments.

## Added scope (designed 2026-11-27)
Read docs/ALGORITHMS.md §23 and §24 as well.
- Linking: phone OTP then the wallet PIN on our secure page (`muse_link`), refused under any block, the owner told by text and email with "This wasn't me", and a 24-hour $50 cap for a newly linked client.
- Links never leave by this door: `confirm_order`, `confirm_booking` and `create_topup_link` have Dovo text the link to the owner's phone and return only a status. Consent is the approval on the secure page.
- `cancel`: a full refund can be confirmed in Muse; anything that costs the customer money is confirmed through a texted link.
- Every string argument of every tool call goes through the shared `masking` module before it is logged or passed on.
- Scopes `read` and `order`, short-lived tokens, rotating refresh tokens, revoked after 90 days unused, `listClients` / `unlinkClient`, and `UNLINK` by text.
- Erasure: revoke and delete linked clients at once (docs/ALGORITHMS.md §22).
- Added tests: no tool response ever contains a `heydovo.com/l/` link; linking under each block; the new-client cap; masking of arguments; scope enforcement; unlink and expiry.
