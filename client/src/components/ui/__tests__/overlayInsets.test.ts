import { clamp, getOverlayInsets } from '../overlayInsets';

describe('getOverlayInsets', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--app-shell-overlay-top-offset-px');
    document.documentElement.style.removeProperty('--mobile-nav-total-offset-px');
  });

  test('keeps a fixed gap from every edge when the app shell reserves nothing', () => {
    expect(getOverlayInsets()).toEqual({ top: 12, right: 12, bottom: 16, left: 12 });
  });

  test("adds the app shell's header and bottom nav to the top and bottom gaps", () => {
    document.documentElement.style.setProperty('--app-shell-overlay-top-offset-px', '64');
    document.documentElement.style.setProperty('--mobile-nav-total-offset-px', '56');

    expect(getOverlayInsets()).toEqual({ top: 76, right: 12, bottom: 72, left: 12 });
  });
});

describe('clamp', () => {
  test('keeps a value inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(14, 0, 10)).toBe(10);
  });
});
