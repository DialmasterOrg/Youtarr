import React from 'react';

export type ThemeMode = 'playful' | 'linear' | 'flat';
export type ThemeBreakpoint = 'mobile' | 'desktop';
export type HeaderFrameMode = 'flush' | 'inset';
export type NavPlacement = 'sidebar' | 'top';
export type HeaderToggleMode = 'menu' | 'collapse';
export type HeaderUpdateIndicatorMode = 'linear' | 'flat' | 'playful';
export type HeaderVersionPlacement = 'desktop' | 'mobile' | 'hidden';

export interface ThemeLayoutPolicy {
  breakpoint: ThemeBreakpoint;
  navPlacement: NavPlacement;
  headerFrameMode: HeaderFrameMode;
  mobileHeaderInset: boolean;
  showHeaderToggleOnMobile: boolean;
  showDesktopNavItems: boolean;
  showStorageHeaderWidget: boolean;
  headerVersionPlacement: HeaderVersionPlacement;
  headerTitleInset: string;
  headerToggleMode: HeaderToggleMode;
  headerToggleWidth: string;
  headerToggleHeight: string;
  headerToggleRadius: string;
  headerToggleColor: string;
  headerUpdateIndicatorMode: HeaderUpdateIndicatorMode;
  headerBackground: string;
  headerBorder: string;
  headerBorderBottom: string;
  headerPattern: string;
  headerBackdropFilter: string;
  headerBorderRadius: string;
  headerMenuRadius: string;
  headerMenuBorder: string;
  headerMenuBackground: string;
  headerMenuShadow: string;
  shellBackground: string;
  mainPadding: string;
  mainMarginTop: string;
  contentPadding: string;
  contentMaxWidth: string;
  contentMarginInline: string;
  contentFrameBackground: string;
  contentFrameBorder: string;
  contentFrameRadius: string;
  contentFrameShadow: string;
}

export type ThemeLayoutPolicyInput = Partial<ThemeLayoutPolicy>;

export interface ThemeLayoutContract {
  mobile: ThemeLayoutPolicyInput;
  desktop: ThemeLayoutPolicyInput;
}

export interface ThemeHeaderPreferences {
  showLogoDefault: boolean;
  showWordmarkDefault: boolean;
}

export interface ThemeHeaderBehavior {
  mobileHorizontalPadding: string;
  mobileInsetOffset: string;
}

export interface ThemeSidebarBehavior {
  compactHeightScrollFooter: boolean;
  zeroDesktopPanelPadding: boolean;
  navButtonGap: string;
  scrollerPaddingBottom: string;
  listPaddingBottom: string;
  itemPaddingBottom: string;
  hideStorageFooterOnMobile: boolean;
  mobileDrawerDocked: boolean;
  mobileDrawerBorderRadius: string;
  mobileDrawerMarginTop: string;
  mobileDrawerMarginBottom: string;
  mobileDrawerMaxHeight: string;
  mobileDrawerWidth: string;
  mobileDrawerTop: string;
  mobileDrawerLeft?: string;
  mobileDrawerRight?: string;
  mobileDrawerBottom: string;
}

export interface ThemeBackgroundDecorationElement {
  className?: string;
  style?: React.CSSProperties;
}

export interface ThemeBackgroundDecorations {
  elements: ThemeBackgroundDecorationElement[];
}

export const REQUIRED_THEME_TOKEN_KEYS = [
  'overlay-backdrop-background',
  'overlay-backdrop-background-strong',
  'overlay-backdrop-filter',
  'media-placeholder-background',
  'media-placeholder-border',
  'media-overlay-foreground',
  'media-overlay-background',
  'media-overlay-background-strong',
  'media-overlay-danger-background',
  'media-overlay-selection-background',
  'media-overlay-delete-selection-background',
  'media-overlay-delete-indicator-background',
  'media-overlay-ignore-button-background',
  'media-overlay-text-shadow',
  'auth-splash-background',
  'auth-surface-background',
  'auth-surface-border',
  'auth-surface-shadow',
  'auth-surface-backdrop-filter',
  'auth-surface-transform',
  'auth-surface-padding',
  'auth-title-font-weight',
  'auth-title-font-size',
  'auth-title-letter-spacing',
  'auth-title-text-shadow',
  'auth-subtitle-font-size',
  'auth-button-text-transform',
  'auth-button-letter-spacing',
  'linear-decor-blob-primary',
  'linear-decor-blob-secondary',
  'linear-decor-top-rail',
  'nav-item-border-hover',
  'header-nav-active-color',
  'header-nav-default-color',
  'header-subnav-active-color',
  'header-update-indicator-width',
  'header-update-indicator-height',
  'header-update-indicator-radius',
  'header-update-indicator-foreground',
  'header-update-indicator-background',
  'header-update-indicator-border',
  'header-update-indicator-shadow',
  'mobile-subnav-surface-background',
  'mobile-subnav-surface-border-top',
  'mobile-subnav-surface-radius',
  'mobile-subnav-surface-margin-bottom',
  'mobile-subnav-surface-padding-bottom',
  'mobile-subnav-item-border',
  'mobile-subnav-item-border-selected',
  'mobile-subnav-item-radius',
  'mobile-subnav-item-text-transform',
  'mobile-subnav-item-letter-spacing',
  'mobile-primary-nav-surface-background',
  'mobile-primary-nav-surface-border-top',
  'mobile-primary-nav-surface-radius',
  'mobile-primary-nav-surface-shadow',
  'mobile-primary-nav-active-color',
  'mobile-primary-nav-active-background',
  'mobile-primary-nav-label-font-size',
  'mobile-primary-nav-label-text-transform',
  'mobile-primary-nav-label-letter-spacing',
  'channel-meta-chip-background',
  'channel-meta-chip-foreground',
  'channel-meta-chip-border',
  'channel-meta-chip-shadow',
  'channel-meta-chip-icon',
] as const;

export type RequiredThemeTokenKey = (typeof REQUIRED_THEME_TOKEN_KEYS)[number];

export type ThemeTokens = Record<RequiredThemeTokenKey, string> & {
  [key: string]: string;
};

export const getMissingRequiredThemeTokens = (tokens: ThemeTokens) => {
  return REQUIRED_THEME_TOKEN_KEYS.filter((key) => !(key in tokens));
};

export interface ThemeDefinition {
  id: ThemeMode;
  name: string;
  description: string;
  layoutMode: 'sidebar' | 'top-nav';
  layout: ThemeLayoutContract;
  headerPreferences: ThemeHeaderPreferences;
  headerBehavior: ThemeHeaderBehavior;
  sidebarBehavior: ThemeSidebarBehavior;
  backgroundDecorations: ThemeBackgroundDecorations;
  tokens: {
    light: ThemeTokens;
    dark: ThemeTokens;
  };
  preview: React.ReactNode;
}
