const EDGE_GAP_PX = 12;
const BOTTOM_GAP_PX = 16;

// How far a floating panel (menu, select list, tooltip) stays from each
// viewport edge: a fixed gap plus the app shell's header and phone bottom nav.
export function getOverlayInsets() {
  if (typeof window === 'undefined') {
    return { top: EDGE_GAP_PX, right: EDGE_GAP_PX, bottom: BOTTOM_GAP_PX, left: EDGE_GAP_PX };
  }

  const styles = window.getComputedStyle(document.documentElement);
  const topInset = Number.parseFloat(styles.getPropertyValue('--app-shell-overlay-top-offset-px')) || 0;
  const bottomInset = Number.parseFloat(styles.getPropertyValue('--mobile-nav-total-offset-px')) || 0;

  return {
    top: topInset + EDGE_GAP_PX,
    right: EDGE_GAP_PX,
    bottom: bottomInset + BOTTOM_GAP_PX,
    left: EDGE_GAP_PX,
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
