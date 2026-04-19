import { CSSProperties } from 'react';

export const AUTH_VIEWPORT_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--auth-splash-background)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

export const AUTH_CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: 600,
  padding: '0 16px',
  boxSizing: 'border-box',
};

export const AUTH_SURFACE_STYLE: CSSProperties = {
  padding: 'var(--auth-surface-padding)',
  borderRadius: 'var(--radius-ui)',
  border: 'var(--auth-surface-border)',
  boxShadow: 'var(--auth-surface-shadow)',
  backgroundColor: 'var(--auth-surface-background)',
  backdropFilter: 'var(--auth-surface-backdrop-filter)',
  transform: 'var(--auth-surface-transform)',
};

export const AUTH_TITLE_STYLE: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 'var(--auth-title-font-weight)' as CSSProperties['fontWeight'],
  fontSize: 'var(--auth-title-font-size)',
  marginBottom: 8,
  letterSpacing: 'var(--auth-title-letter-spacing)',
  textShadow: 'var(--auth-title-text-shadow)',
};

export const AUTH_SUBTITLE_STYLE: CSSProperties = {
  fontWeight: 500,
  fontSize: 'var(--auth-subtitle-font-size)',
  fontFamily: 'var(--font-body)',
};

export const AUTH_PRIMARY_BUTTON_STYLE: CSSProperties = {
  marginTop: 24,
  paddingTop: 12,
  paddingBottom: 12,
  fontWeight: 700,
  fontSize: '1.1rem',
  borderRadius: 'var(--radius-ui)',
  textTransform: 'var(--auth-button-text-transform)' as CSSProperties['textTransform'],
  letterSpacing: 'var(--auth-button-letter-spacing)',
};

export const AUTH_FOOTER_STYLE: CSSProperties = {
  display: 'block',
  textAlign: 'center',
  marginTop: 24,
  fontFamily: 'var(--font-body)',
};