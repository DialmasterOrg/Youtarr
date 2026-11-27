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
- `ui/Menu` and `ui/Popover` portal to `document.body`: a transformed ancestor (a Card's hover lift) would otherwise become the containing block for their fixed positioning. Neither is used inside a modal Dialog, which disables pointer events outside its content.
- `ui/AccordionContent` stays mounted when collapsed (tests can query it) but is `invisible`, so its controls leave the tab order and the accessibility tree.
- `components/layout/`: `AppShell.tsx` is the outer frame, `NavSidebar.tsx` and `NavHeader.tsx` own desktop and mobile nav, `navLayoutConstants.ts` the shared sizing, `layoutFallback.css` fallback variables for themes that skip layout overrides.
- `layout/HeaderTrim.tsx` renders inside `NavHeader` on the dates `HeaderTrim/useHeaderTrim.ts` picks, so anything rendering the header is date-dependent; `NavHeader.test.tsx` mocks the hook. `?trim=<id>` forces one, any other value forces none.
- `themes/` holds `playful`, `linear`, `flat`, the shared `layoutPolicy.ts` and the `ALL_THEMES` registry; a new theme adds an entry and implements the required token surface.
- `contexts/ThemeEngineContext.tsx` owns the active theme mode, resolves the layout policy for the current viewport, and injects the theme CSS variables onto the document root.

## Placement of new components

- Feature-local (one feature uses it): the feature directory. This is the default.
- Cross-feature (imported by 2+ feature directories today, not hypothetically): `components/shared/`. Promote later when a second feature actually imports it.
- Theme-neutral primitive with no business logic: `components/ui/`.

## TypeScript

- No `any`. `catch (err: unknown)` with narrowing; interfaces for props, API payloads and WebSocket messages; React's built-in event types. Existing `any` is legacy; do not add more.
- Feature-specific types live with the feature. API and domain shapes used across features live in `client/src/types/`; a type that only describes one util module's inputs or outputs stays beside it. New config fields go through the `CONFIG_FIELDS` registry in `client/src/config/configSchema.ts`.

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
- Log a failed axios request through `utils/requestError.describeRequestError`, never the error itself: an axios error carries its request, including the `x-access-token` header.
- Show a failed request's text through `utils/requestError.serverErrorMessage(err, fallback)`: the server's `{ error }` or the fallback, never axios's own message. Fifteen local copies had drifted apart; hooks that map status codes keep their own mapping.
- Two-button confirmations use `shared/ConfirmDialog` with a `tone`: `danger` and `warning` fill and focus Cancel and outline the action, `default` fills the action. Hand-written dialogs had drifted into opposite conventions for destructive actions.
- Info icons are `shared/InfoTooltip` everywhere: the app tooltip on hover, focus and tap. Settings once showed the text in a bottom bar on phones, through a callback threaded into every section; do not bring that back.
- Queue videos through `hooks/useTriggerDownloads` and show the `message` of a failed result: the server's reason (downloads paused, a refused setting) or the one fallback. Each page's own failure string had hidden that reason.
- Video row pieces live in `components/shared/`: `VideoThumbnail` (library), `RemoteThumbnail`, `thumbnailOverlays` (removed banner, duration badge), `VideoStatusChip`, `MediaTypeChip`, `VideoModal/videoDataToModalData`. Durations are `utils.formatDuration` ("1h5m") everywhere. Do not rebuild these per page.
- YouTube links come from `utils/youtubeUrls`, byte sizes from `formatters.formatBytes`, and the `overrideSettings` request type from `types/downloadOverrideSettings`; do not rebuild them locally.
