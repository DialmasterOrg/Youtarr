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

export interface ThemeTokens {
  [key: string]: string;
}

export interface ThemeDefinition {
  id: ThemeMode;
  name: string;
  description: string;
  layoutMode: 'sidebar' | 'top-nav';
  layout: ThemeLayoutContract;
  tokens: {
    light: ThemeTokens;
    dark: ThemeTokens;
  };
  preview: React.ReactNode;
}
