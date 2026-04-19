import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppearanceSettingsSection } from '../AppearanceSettingsSection';

type Engine = {
  themeMode: 'linear' | 'playful' | 'flat';
  setThemeMode: jest.Mock;
  motionEnabled: boolean;
  setMotionEnabled: jest.Mock;
  colorMode: 'light' | 'dark';
  setColorMode: jest.Mock;
  showHeaderLogo: boolean;
  setShowHeaderLogo: jest.Mock;
  showHeaderWordmark: boolean;
  setShowHeaderWordmark: jest.Mock;
  showSectionIcons: boolean;
  setShowSectionIcons: jest.Mock;
};

const defaultEngine: Engine = {
  themeMode: 'linear',
  setThemeMode: jest.fn(),
  motionEnabled: false,
  setMotionEnabled: jest.fn(),
  colorMode: 'light',
  setColorMode: jest.fn(),
  showHeaderLogo: true,
  setShowHeaderLogo: jest.fn(),
  showHeaderWordmark: true,
  setShowHeaderWordmark: jest.fn(),
  showSectionIcons: true,
  setShowSectionIcons: jest.fn(),
};

const mockUseThemeEngine = jest.fn<Engine, []>(() => defaultEngine);

jest.mock('../../../../contexts/ThemeEngineContext', () => ({
  useThemeEngine: () => mockUseThemeEngine(),
}));

jest.mock('../../common/InfoTooltip', () => ({
  InfoTooltip: () => null,
}));

jest.mock('../../../../lib/icons', () => ({
  __esModule: true,
  Info: () => null,
}));

describe('AppearanceSettingsSection', () => {
  beforeEach(() => {
    Object.values(defaultEngine).forEach((v) => {
      if (typeof v === 'function' && (v as jest.Mock).mockReset) (v as jest.Mock).mockReset();
    });
    mockUseThemeEngine.mockReturnValue(defaultEngine);
  });

  test('renders Dark Mode, Motion, and Visual Style sections', () => {
    render(<AppearanceSettingsSection />);
    expect(screen.getByLabelText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable Theme Animations & Motion')).toBeInTheDocument();
    expect(screen.getByText('Visual Style')).toBeInTheDocument();
  });

  test('renders one card per registered theme', () => {
    render(<AppearanceSettingsSection />);
    // ALL_THEMES includes playful, linear, flat
    const themeCards = screen.getAllByLabelText(/Select .* theme/i);
    expect(themeCards).toHaveLength(3);
  });

  test('toggling Dark Mode calls setColorMode with the new mode', () => {
    render(<AppearanceSettingsSection />);
    fireEvent.click(screen.getByLabelText('Dark Mode'));
    expect(defaultEngine.setColorMode).toHaveBeenCalledWith('dark');
  });

  test('toggling Dark Mode off when already dark calls setColorMode with "light"', () => {
    mockUseThemeEngine.mockReturnValue({ ...defaultEngine, colorMode: 'dark' });
    render(<AppearanceSettingsSection />);
    fireEvent.click(screen.getByLabelText('Dark Mode'));
    expect(defaultEngine.setColorMode).toHaveBeenCalledWith('light');
  });

  test('toggling Motion calls setMotionEnabled with new state', () => {
    render(<AppearanceSettingsSection />);
    fireEvent.click(screen.getByLabelText('Enable Theme Animations & Motion'));
    expect(defaultEngine.setMotionEnabled).toHaveBeenCalledWith(true);
  });

  test('clicking a theme card calls setThemeMode with that theme id', () => {
    render(<AppearanceSettingsSection />);
    // Click the playful card via its accessible label
    fireEvent.click(screen.getByLabelText(/Select Playful.* theme/i));
    expect(defaultEngine.setThemeMode).toHaveBeenCalledWith('playful');
  });

  test('renders header settings only inside the active theme card', () => {
    render(<AppearanceSettingsSection />);
    // Active theme is "linear" by default; header settings panel appears once
    expect(screen.getAllByText('Header Settings')).toHaveLength(1);
    expect(screen.getByLabelText('Logo')).toBeInTheDocument();
    expect(screen.getByLabelText('Text Image')).toBeInTheDocument();
    expect(screen.getByLabelText('Section Icons')).toBeInTheDocument();
  });

  test('toggling Logo switch on the active theme calls setShowHeaderLogo', () => {
    render(<AppearanceSettingsSection />);
    fireEvent.click(screen.getByLabelText('Logo'));
    expect(defaultEngine.setShowHeaderLogo).toHaveBeenCalledWith(false);
  });

  test('toggling Text Image switch calls setShowHeaderWordmark', () => {
    render(<AppearanceSettingsSection />);
    fireEvent.click(screen.getByLabelText('Text Image'));
    expect(defaultEngine.setShowHeaderWordmark).toHaveBeenCalledWith(false);
  });

  test('toggling Section Icons switch calls setShowSectionIcons', () => {
    render(<AppearanceSettingsSection />);
    fireEvent.click(screen.getByLabelText('Section Icons'));
    expect(defaultEngine.setShowSectionIcons).toHaveBeenCalledWith(false);
  });
});
