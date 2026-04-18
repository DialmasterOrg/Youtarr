import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ThemeEngineProvider, useThemeEngine } from '../ThemeEngineContext';
import { getThemeById } from '../../themes';

function ThemeEngineProbe() {
  const { themeMode, showHeaderLogo, showHeaderWordmark, showSectionIcons } = useThemeEngine();

  return (
    <div data-testid="theme-engine-probe">
      {themeMode}|{String(showHeaderLogo)}|{String(showHeaderWordmark)}|{String(showSectionIcons)}
    </div>
  );
}

function ThemeEngineControls() {
  const { setThemeMode, setShowSectionIcons } = useThemeEngine();

  return (
    <>
      <button type="button" onClick={() => setShowSectionIcons(false)}>
        Hide section icons
      </button>
      <button type="button" onClick={() => setShowSectionIcons(true)}>
        Show section icons
      </button>
      <button type="button" onClick={() => setThemeMode('playful')}>
        Switch to playful
      </button>
    </>
  );
}

describe('ThemeEngineProvider defaults', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults fresh installs to Dark Modern with the logo and wordmark enabled', () => {
    render(
      <ThemeEngineProvider>
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );

    expect(screen.getByTestId('theme-engine-probe')).toHaveTextContent('linear|true|true|true');
  });

  it('keeps stored theme-scoped header preferences for returning users', () => {
    localStorage.setItem('uiThemeMode', 'playful');
    localStorage.setItem('uiHeaderLogoVisible:playful', 'false');
    localStorage.setItem('uiHeaderWordmarkVisible:playful', 'true');
    localStorage.setItem('uiSectionIconsVisible:playful', 'false');

    render(
      <ThemeEngineProvider>
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );

    expect(screen.getByTestId('theme-engine-probe')).toHaveTextContent('playful|false|true|false');
  });

  it('persists section icon preference updates to the active theme scope', async () => {
    const user = userEvent.setup();

    render(
      <ThemeEngineProvider>
        <ThemeEngineControls />
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Hide section icons' }));

    await waitFor(() => {
      expect(screen.getByTestId('theme-engine-probe')).toHaveTextContent('linear|true|true|false');
    });

    expect(localStorage.getItem('uiSectionIconsVisible:linear')).toBe('false');
  });

  it('loads the selected theme\'s stored section icon preference when the theme changes', async () => {
    const user = userEvent.setup();
    localStorage.setItem('uiSectionIconsVisible:playful', 'false');

    render(
      <ThemeEngineProvider>
        <ThemeEngineControls />
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Switch to playful' }));

    await waitFor(() => {
      expect(screen.getByTestId('theme-engine-probe')).toHaveTextContent('playful|false|true|false');
    });
  });

  it('declares the expected header defaults for each theme', () => {
    expect(getThemeById('playful').headerPreferences).toEqual({
      showLogoDefault: false,
      showWordmarkDefault: true,
    });
    expect(getThemeById('linear').headerPreferences).toEqual({
      showLogoDefault: true,
      showWordmarkDefault: true,
    });
    expect(getThemeById('flat').headerPreferences).toEqual({
      showLogoDefault: true,
      showWordmarkDefault: true,
    });
  });

  it('returns fallback values when useThemeEngine is called outside a provider', () => {
    function FallbackProbe() {
      const { themeMode, motionEnabled, showHeaderLogo, colorMode } = useThemeEngine();
      return (
        <div data-testid="fallback-probe">
          {themeMode}|{String(motionEnabled)}|{String(showHeaderLogo)}|{colorMode}
        </div>
      );
    }
    render(<FallbackProbe />);
    expect(screen.getByTestId('fallback-probe')).toHaveTextContent('linear|false|true|light');
  });

  it('falls back to default theme mode when stored value is not a valid ThemeMode', () => {
    localStorage.setItem('uiThemeMode', 'not-a-real-theme');
    render(
      <ThemeEngineProvider>
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );
    expect(screen.getByTestId('theme-engine-probe')).toHaveTextContent(/^linear\|/);
  });

  it('reads colorMode from localStorage and applies the dark class to the body', () => {
    localStorage.setItem('uiColorMode', 'dark');
    render(
      <ThemeEngineProvider>
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );
    expect(document.body.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('treats any non-"dark" stored color mode as light', () => {
    localStorage.setItem('uiColorMode', 'banana');
    render(
      <ThemeEngineProvider>
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('persists motionEnabled changes and writes a body data attribute', async () => {
    const user = userEvent.setup();

    function MotionControls() {
      const { motionEnabled, setMotionEnabled } = useThemeEngine();
      return (
        <>
          <span data-testid="motion-state">{String(motionEnabled)}</span>
          <button type="button" onClick={() => setMotionEnabled(true)}>
            Enable motion
          </button>
        </>
      );
    }

    render(
      <ThemeEngineProvider>
        <MotionControls />
      </ThemeEngineProvider>
    );

    expect(screen.getByTestId('motion-state')).toHaveTextContent('false');
    expect(document.body.dataset.motion).toBe('off');

    await user.click(screen.getByRole('button', { name: 'Enable motion' }));

    await waitFor(() => {
      expect(screen.getByTestId('motion-state')).toHaveTextContent('true');
    });
    expect(document.body.dataset.motion).toBe('on');
    expect(localStorage.getItem('uiMotionEnabled')).toBe('true');
  });

  it('reads stored motionEnabled value on initial render', () => {
    localStorage.setItem('uiMotionEnabled', 'true');
    function MotionProbe() {
      const { motionEnabled } = useThemeEngine();
      return <span data-testid="m">{String(motionEnabled)}</span>;
    }
    render(
      <ThemeEngineProvider>
        <MotionProbe />
      </ThemeEngineProvider>
    );
    expect(screen.getByTestId('m')).toHaveTextContent('true');
  });

  it('falls back to legacy (non-scoped) preference key when scoped key is missing', () => {
    // No scoped key for linear, but legacy key exists with "false"
    localStorage.setItem('uiHeaderLogoVisible', 'false');
    render(
      <ThemeEngineProvider>
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );
    // First field is themeMode, second is showHeaderLogo
    expect(screen.getByTestId('theme-engine-probe')).toHaveTextContent('linear|false|true|true');
  });

  it('writes themeMode and colorMode to localStorage on initial render', () => {
    render(
      <ThemeEngineProvider>
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );
    expect(localStorage.getItem('uiThemeMode')).toBe('linear');
    expect(localStorage.getItem('uiColorMode')).toBe('light');
  });
});
