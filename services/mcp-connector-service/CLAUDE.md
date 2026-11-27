# mcp-connector-service

## Purpose
Public remote MCP server (HTTPS) so Meta Muse users can use Hey Dovo. Same tools, guards, confirmation and PIN rules as chat.

## Tools (with annotations: readOnlyHint / destructiveHint)
search_products, search_services, get_delivery_quote, create_order_draft, confirm_order (returns a secure PIN or payment link; never charges), create_booking_draft, confirm_booking, track, get_balance, create_topup_link, cancel (shows refund first).

## Key logic
- Built on Cloudflare's remote MCP support (Agents SDK / workers-oauth-provider) [CONFIRM current packages].
- Account linking: OAuth 2.1 with PKCE; our login = phone OTP via auth-security-service; tokens scoped and revocable.
- Calls services through the same RPC clients and guard logic as agent-orchestrator (shared package, no duplication).
- Rate limits per linked account; audit logging.

## Muse submission checklist
Live public HTTPS endpoint, docs, auth method, connector name "Hey Dovo", company, website heydovo.com, example prompts written as users would type them, 512×512 icon (PNG/SVG), payments flag, contact. Submit at https://platform.muse.ai/ only after the full test suite passes.

## Must never
- Charge through MCP without the PIN/payment step. Return other users' data.

## Tests
MCP protocol conformance, OAuth flows (valid, expired, revoked), each tool's guard, rate limits, injection attempts via tool arguments.
