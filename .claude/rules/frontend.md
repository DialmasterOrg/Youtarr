---
paths:
  - "client/src/**/*"
---

# Frontend standards (React/TypeScript)

Apply these when creating or substantially rewriting client code. Scope Discipline in the root file wins when they conflict.

## Layout of `client/src/`

- Any `fetch()` or axios call gets the database error overlay for free through `App.tsx`; its `fetch()` override is the one intentional `fetch`.
- Complex features pair `FeatureName.tsx` with a `FeatureName/` directory holding `components/`, `hooks/` and `__tests__/` (`Subscriptions.tsx` + `Subscriptions/`, `ChannelPage.tsx` + `ChannelPage/`, `PlaylistPage.tsx` + `PlaylistPage/`). Newer features put the main component at `FeatureName/index.tsx` (`SubscriptionImport/`, `VideosPage/`). Either layout is fine.
- `Configuration/` has no top-level component: it holds the settings sections, hooks and shared settings UI that `Settings/Settings.tsx` mounts.
- `components/ui/` holds theme-neutral primitives (Button, Card, Dialog, Select, Box, Typography, Chip and so on) built on Radix and styled with CSS variables plus Tailwind. Use these; MUI is not installed.
- `ui/AccordionContent` stays mounted when collapsed (tests can query it) but is `invisible`, so its controls leave the tab order and the accessibility tree.
- `components/layout/`: `AppShell.tsx` is the outer frame, `NavSidebar.tsx` and `NavHeader.tsx` own desktop and mobile nav, `navLayoutConstants.ts` the shared sizing, `layoutFallback.css` fallback variables for themes that skip layout overrides.
- `themes/` holds `playful`, `linear`, `flat`, the shared `layoutPolicy.ts` and the `ALL_THEMES` registry; a new theme adds an entry and implements the required token surface.
- `contexts/ThemeEngineContext.tsx` owns the active theme mode, resolves the layout policy for the current viewport, and injects the theme CSS variables onto the document root.

## Placement of new components

- Feature-local (one feature uses it): the feature directory. This is the default.
- Cross-feature (imported by 2+ feature directories today, not hypothetically): `components/shared/`. Promote later when a second feature actually imports it.
- Theme-neutral primitive with no business logic: `components/ui/`.

## TypeScript

- No `any`. `catch (err: unknown)` with narrowing; interfaces for props, API payloads and WebSocket messages; React's built-in event types. Existing `any` is legacy; do not add more.
- Feature-specific types live with the feature; shared types in `client/src/types/`. New config fields go through the `CONFIG_FIELDS` registry in `client/src/config/configSchema.ts`.

## Components and hooks

- Aim for fewer than 10 `useState` calls; past that, extract hooks for logic and child components for UI.
- Hooks own one concern each and return `{ data, loading, error, ...actions }`. Do not extract one-off state read in one place. Always return cleanup from `useEffect` for subscriptions, timers and listeners. Memoize deliberately, not trivially.
- React Context for cross-cutting concerns (auth token, WebSocket, theme); local `useState`/`useReducer` otherwise; custom events only for decoupled communication (`CONFIG_UPDATED_EVENT`).
- Settings where rules combine make the logic structural: rule cards, OR dividers, nested sub-conditions and a plain-language summary (`AutoRemovalSection.tsx`, `AutoRemovalRulesSummary.tsx`), because a flat field grid hid whether rules ANDed or ORed and risked deleting more than intended.

## Styling

- Tailwind utility classes via `className` for layout, spacing and typography; theme tokens via CSS variables (`var(--destructive)`, `text-foreground`, `text-muted-foreground`, `bg-card`), never hardcoded colors. `lib/cn.ts` combines class names.
- Icons come from the aliases in `lib/icons.ts` (`Trash2 as Delete`); some older files import `lucide-react` directly, which new code should not copy.
- Inline `style` only for computed values (a padding driven by `isMobile`, a length-dependent `maxHeight`). Responsive behavior through `hooks/useMediaQuery` (`useMediaQuery('(max-width: 767px)')` or `breakpoints.down('sm')`) or Tailwind's `md:`/`sm:` prefixes.

## API calls

- Axios, with `headers: { 'x-access-token': token }`; hooks receive `token` from the calling component. Type requests and responses. Handle specific status codes (403, 404, 503) rather than generic catch-alls.
- `hooks/useConfig.ts` and other older files use raw `fetch()`; do not copy them.
