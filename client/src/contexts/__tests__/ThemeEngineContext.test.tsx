import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeEngineProvider, useThemeEngine } from '../ThemeEngineContext';
import { getThemeById } from '../../themes';

function ThemeEngineProbe() {
  const { themeMode, showHeaderLogo, showHeaderWordmark } = useThemeEngine();

  return (
    <div data-testid="theme-engine-probe">
      {themeMode}|{String(showHeaderLogo)}|{String(showHeaderWordmark)}
    </div>
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

    expect(screen.getByTestId('theme-engine-probe')).toHaveTextContent('linear|true|true');
  });

  it('keeps stored theme-scoped header preferences for returning users', () => {
    localStorage.setItem('uiThemeMode', 'playful');
    localStorage.setItem('uiHeaderLogoVisible:playful', 'false');
    localStorage.setItem('uiHeaderWordmarkVisible:playful', 'true');

    render(
      <ThemeEngineProvider>
        <ThemeEngineProbe />
      </ThemeEngineProvider>
    );

    expect(screen.getByTestId('theme-engine-probe')).toHaveTextContent('playful|false|true');
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
