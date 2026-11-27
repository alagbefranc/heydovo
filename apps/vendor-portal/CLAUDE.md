# apps/vendor-portal

## Purpose
Mobile-first web portal (installable PWA) for stores and trades. Next.js on Workers + Astryx themed from our Figma (`packages/ui`). Supabase Auth with mandatory 2FA. All data through api-gateway.

## Pages
Sign-up & verification (business details, documents with expiry, bank via Stripe Connect onboarding), Dashboard, Orders/Jobs inbox (live), Order/Job detail, Catalogue (products, bulk upload), Services & quotes, Availability (hours, closures, pause switch, calendar + Google/Outlook sync), Service area/delivery radius map, Fulfilment settings (pickup/delivery/self-delivery, hold time), Earnings & payouts (statements, tax summaries), Reviews (reply), Disputes, Insights, Team (roles, locations), Notification settings, Security (2FA, sessions, activity log), Help.

## Components
AppShell, StatCard, OrderInboxList, OrderCard (accept/decline countdown), StatusTimeline, CourierTracker, PickupCodeEntry, SubstitutionDialog, ProductTable, ProductForm, ImageUploader, BulkUpload (row errors), ServiceForm, QuoteComposer (with customer photos), CalendarScheduler, HoursEditor, ServiceAreaMap, DocumentUploader, PayoutTable, StatementDownload, ReviewList + ReplyBox, DisputeThread, Charts, TeamTable + RoleSelect, NotificationSettings, TwoFactorSetup, EmptyState, Toasts.

## Rules
- Live inbox via Supabase Realtime (Broadcast sent by the service on a vendor-scoped private channel, never table subscriptions; docs/SECURITY.md, Platform) or SSE from api-gateway [CONFIRM choice]; sound + Web Push on new orders.
- Role-based UI (owner, manager, staff); hide what a role can't do, and the API still enforces it.
- Customer data shown: first name, items, delivery address only when needed; never phone numbers.
- Works well on a cheap Android phone on 4G.
- The portal and text commands are two views of the same orders: an action taken by text shows here at once, and the other way round (docs/ALGORITHMS.md §14).

## Tests
Playwright per page (mobile + desktop, EN/FR, axe AA), role matrix, realtime arrival, accept timeout UI, bulk upload errors, document upload limits, 2FA enforcement.

## Added scope (designed 2026-11-27)
- Phone: add and verify the mobile used for text commands (Security page). Team page shows which staff have a verified phone.
- Notification settings: the on-duty list per location (docs/ALGORITHMS.md §17).
- Order and job timelines show who did each step and how ("Accepted by Ama · by text · 3:42 pm"). The activity log lists text commands. If text commands are paused for a number, the Security page says so and until when.
- A short "Running orders by text" help page: the commands, when a code is needed, and that text and the dashboard are the same orders.
- Earnings uses `wallet.getVendorStatement` (owner only). Seller tax details form if the accountant confirms it is needed (docs/LAUNCH.md).
- Added tests: an action taken by text appears in the open dashboard without a reload; two people acting at once; phone verification; statements hidden from non-owners.
- Design: docs/design/VENDOR_PORTAL.md (screens, behaviour, provisional tokens and the patterns borrowed). Build to it; ask before departing from it.
