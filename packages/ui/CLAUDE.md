# packages/ui

## Purpose
The shared design system for all four web apps (website, secure-pages, vendor-portal, admin-portal): Meta's Astryx (React 19 + StyleX) themed with Hey Dovo brand tokens from our Figma, plus shared composed components.

## Steps
1. Import Figma tokens (colours, typography, spacing, radius, shadows) [CONFIRM: Figma link pending] → Astryx theme (light + dark).
2. Build composed components: AppShell, StatCard, DataTable, StatusBadge, Charts, FormField wrappers, Toasts, EmptyState, ErrorState, LanguageToggle.
3. Storybook (or Astryx docs tooling) for every component with EN/FR examples.

## Rules
- Prefer Astryx components; build custom only when none fits, and document why.
- WCAG 2.2 AA: contrast, focus states, keyboard, screen-reader labels, 44px touch targets.
- No app-specific business logic in this package.
- Visual regression + axe tests for every component.
