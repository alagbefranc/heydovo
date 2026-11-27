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
