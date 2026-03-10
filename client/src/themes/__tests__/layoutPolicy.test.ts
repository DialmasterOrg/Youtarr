import { getThemeById, resolveThemeLayoutPolicy } from '..';

const THEME_MODES = ['playful', 'linear', 'flat'] as const;
const BREAKPOINTS = ['mobile', 'desktop'] as const;

describe('theme layout policy contracts', () => {
  test.each(THEME_MODES.flatMap((themeMode) => BREAKPOINTS.map((breakpoint) => [themeMode, breakpoint] as const))) (
    'resolves a complete %s %s layout policy',
    (themeMode, breakpoint) => {
      const policy = resolveThemeLayoutPolicy(getThemeById(themeMode), breakpoint);

      expect(policy.breakpoint).toBe(breakpoint);
      expect(policy.navPlacement).toMatch(/sidebar|top/);
      expect(policy.headerFrameMode).toMatch(/flush|inset/);
      expect(policy.contentPadding).toBeTruthy();
      expect(policy.mainPadding).toBeTruthy();
      expect(policy.headerBackground).toBeTruthy();
      expect(policy.headerMenuBorder).toBeTruthy();
      expect(policy.headerUpdateIndicatorMode).toMatch(/linear|flat|playful/);
      expect(policy.contentFrameBorder).toBeDefined();
      expect(policy.contentFrameShadow).toBeDefined();
    }
  );

  it('keeps playful framed and sidebar-based across breakpoints', () => {
    expect(resolveThemeLayoutPolicy(getThemeById('playful'), 'desktop')).toMatchObject({
      navPlacement: 'sidebar',
      headerFrameMode: 'inset',
      contentFrameBorder: '2px solid var(--foreground)',
    });

    expect(resolveThemeLayoutPolicy(getThemeById('playful'), 'mobile')).toMatchObject({
      navPlacement: 'sidebar',
      showHeaderToggleOnMobile: false,
      contentPadding: '12px 6px',
    });
  });

  it('keeps flat and linear top-nav variants flush and desktop-nav enabled', () => {
    for (const themeMode of ['flat', 'linear'] as const) {
      expect(resolveThemeLayoutPolicy(getThemeById(themeMode), 'desktop')).toMatchObject({
        navPlacement: 'top',
        headerFrameMode: 'flush',
        showDesktopNavItems: true,
      });
    }
  });
});