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
});
