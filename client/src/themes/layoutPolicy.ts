import type {
  ThemeBreakpoint,
  ThemeDefinition,
  ThemeLayoutPolicy,
  ThemeLayoutPolicyInput,
} from './types';

type CssVarName =
  | '--layout-shell-background'
  | '--layout-main-padding'
  | '--layout-main-margin-top'
  | '--layout-content-padding'
  | '--layout-content-max-width'
  | '--layout-content-margin-inline'
  | '--layout-content-frame-background'
  | '--layout-content-frame-border'
  | '--layout-content-frame-radius'
  | '--layout-content-frame-shadow'
  | '--layout-header-background'
  | '--layout-header-border'
  | '--layout-header-border-bottom'
  | '--layout-header-pattern'
  | '--layout-header-backdrop-filter'
  | '--layout-header-border-radius'
  | '--layout-header-title-inset'
  | '--layout-header-toggle-width'
  | '--layout-header-toggle-height'
  | '--layout-header-toggle-radius'
  | '--layout-header-toggle-color'
  | '--layout-header-menu-radius'
  | '--layout-header-menu-border'
  | '--layout-header-menu-background'
  | '--layout-header-menu-shadow';

export type ThemeLayoutCssVars = Record<CssVarName, string>;

const DESKTOP_FALLBACK_LAYOUT_POLICY: ThemeLayoutPolicy = {
  breakpoint: 'desktop',
  navPlacement: 'sidebar',
  headerFrameMode: 'inset',
  mobileHeaderInset: false,
  showHeaderToggleOnMobile: false,
  showDesktopNavItems: false,
  showStorageHeaderWidget: false,
  headerVersionPlacement: 'hidden',
  headerTitleInset: '0px',
  headerToggleMode: 'collapse',
  headerToggleWidth: '44px',
  headerToggleHeight: '44px',
  headerToggleRadius: '50%',
  headerToggleColor: 'var(--foreground)',
  headerUpdateIndicatorMode: 'playful',
  headerBackground: 'var(--card, #fffdf5)',
  headerBorder: 'var(--appbar-border)',
  headerBorderBottom: 'var(--appbar-border)',
  headerPattern: 'var(--appbar-pattern)',
  headerBackdropFilter: 'none',
  headerBorderRadius: 'var(--radius-ui)',
  headerMenuRadius: 'var(--radius-ui)',
  headerMenuBorder: '2px solid var(--border-strong)',
  headerMenuBackground: 'var(--card)',
  headerMenuShadow: 'none',
  shellBackground: 'linear-gradient(180deg, var(--card) 0%, var(--background) 55%, var(--background) 100%)',
  mainPadding: 'calc(80px + var(--shell-gap)) var(--shell-gap) var(--shell-gap) calc(var(--nav-width) + var(--shell-gap) * 2)',
  mainMarginTop: '0px',
  contentPadding: '24px 32px',
  contentMaxWidth: '1400px',
  contentMarginInline: 'auto',
  contentFrameBackground: 'transparent',
  contentFrameBorder: 'none',
  contentFrameRadius: '0px',
  contentFrameShadow: 'none',
};

const MOBILE_FALLBACK_LAYOUT_POLICY: ThemeLayoutPolicy = {
  ...DESKTOP_FALLBACK_LAYOUT_POLICY,
  breakpoint: 'mobile',
  mobileHeaderInset: true,
  showHeaderToggleOnMobile: true,
  headerVersionPlacement: 'mobile',
  headerToggleMode: 'menu',
  headerToggleRadius: 'var(--radius-ui)',
  mainPadding: 'calc(64px + var(--shell-gap) * 2) 4px var(--shell-gap)',
  contentPadding: '8px 4px',
};

const FALLBACK_LAYOUT_POLICIES: Record<ThemeBreakpoint, ThemeLayoutPolicy> = {
  mobile: MOBILE_FALLBACK_LAYOUT_POLICY,
  desktop: DESKTOP_FALLBACK_LAYOUT_POLICY,
};

function mergeLayoutPolicy(
  breakpoint: ThemeBreakpoint,
  themePolicy: ThemeLayoutPolicyInput | undefined
): ThemeLayoutPolicy {
  return {
    ...FALLBACK_LAYOUT_POLICIES[breakpoint],
    ...themePolicy,
    breakpoint,
  };
}

export function resolveThemeLayoutPolicy(
  theme: ThemeDefinition | undefined,
  breakpoint: ThemeBreakpoint
): ThemeLayoutPolicy {
  return mergeLayoutPolicy(breakpoint, theme?.layout?.[breakpoint]);
}

export function getThemeLayoutCssVars(policy: ThemeLayoutPolicy): ThemeLayoutCssVars {
  return {
    '--layout-shell-background': policy.shellBackground,
    '--layout-main-padding': policy.mainPadding,
    '--layout-main-margin-top': policy.mainMarginTop,
    '--layout-content-padding': policy.contentPadding,
    '--layout-content-max-width': policy.contentMaxWidth,
    '--layout-content-margin-inline': policy.contentMarginInline,
    '--layout-content-frame-background': policy.contentFrameBackground,
    '--layout-content-frame-border': policy.contentFrameBorder,
    '--layout-content-frame-radius': policy.contentFrameRadius,
    '--layout-content-frame-shadow': policy.contentFrameShadow,
    '--layout-header-background': policy.headerBackground,
    '--layout-header-border': policy.headerBorder,
    '--layout-header-border-bottom': policy.headerBorderBottom,
    '--layout-header-pattern': policy.headerPattern,
    '--layout-header-backdrop-filter': policy.headerBackdropFilter,
    '--layout-header-border-radius': policy.headerBorderRadius,
    '--layout-header-title-inset': policy.headerTitleInset,
    '--layout-header-toggle-width': policy.headerToggleWidth,
    '--layout-header-toggle-height': policy.headerToggleHeight,
    '--layout-header-toggle-radius': policy.headerToggleRadius,
    '--layout-header-toggle-color': policy.headerToggleColor,
    '--layout-header-menu-radius': policy.headerMenuRadius,
    '--layout-header-menu-border': policy.headerMenuBorder,
    '--layout-header-menu-background': policy.headerMenuBackground,
    '--layout-header-menu-shadow': policy.headerMenuShadow,
  };
}

export const FALLBACK_LAYOUT_POLICY = FALLBACK_LAYOUT_POLICIES;