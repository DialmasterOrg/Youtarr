import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AutoDownloadTabToggles from '../AutoDownloadTabToggles';
import { AutoDownloadToggleNotice } from '../../hooks/useAutoDownloadTabToggle';
import { renderWithProviders } from '../../../../test-utils';

interface RenderOptions {
  globalAutoDownloadOff?: boolean;
  isMobile?: boolean;
  saving?: boolean;
  notice?: AutoDownloadToggleNotice | null;
}

function renderToggles({
  globalAutoDownloadOff = false,
  isMobile = false,
  saving = false,
  notice = null,
}: RenderOptions = {}) {
  const handlers = {
    onToggle: jest.fn(),
    onUndo: jest.fn(),
    onDismissNotice: jest.fn(),
  };
  renderWithProviders(
    <AutoDownloadTabToggles
      availableTabs="videos,shorts,streams"
      enabledTabs="video"
      isMobile={isMobile}
      globalAutoDownloadOff={globalAutoDownloadOff}
      saving={saving}
      notice={notice}
      {...handlers}
    />
  );
  return handlers;
}

const successNotice: AutoDownloadToggleNotice = {
  message: 'Auto-download on for Shorts',
  severity: 'success',
  undoValue: 'video',
};

describe('AutoDownloadTabToggles', () => {
  test('asks to turn a tab on when its chip is clicked', async () => {
    const { onToggle } = renderToggles();

    await userEvent.click(screen.getByRole('button', { name: 'Auto-download Shorts' }));

    expect(onToggle).toHaveBeenCalledWith('shorts', true);
  });

  test('disables the toggles while a save is running', () => {
    renderToggles({ saving: true });

    expect(screen.getByRole('button', { name: 'Auto-download Live' })).toBeDisabled();
  });

  test('shows the notice message', () => {
    renderToggles({ notice: successNotice });

    expect(screen.getByText('Auto-download on for Shorts')).toBeInTheDocument();
  });

  test('undo calls back when clicked', async () => {
    const { onUndo } = renderToggles({ notice: successNotice });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(onUndo).toHaveBeenCalled();
  });

  test('disables undo while a save is running', () => {
    renderToggles({ notice: successNotice, saving: true });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('offers no undo for a notice without one', () => {
    renderToggles({ notice: { message: "Couldn't update auto-download for Shorts", severity: 'error' } });

    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  test('closing the notice dismisses it', async () => {
    const { onDismissNotice } = renderToggles({ notice: successNotice });

    await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);

    expect(onDismissNotice).toHaveBeenCalled();
  });

  test('links to the global setting when automatic downloads are off', () => {
    renderToggles({ globalAutoDownloadOff: true });

    expect(screen.getByRole('link', { name: /Automatic downloads are off/ })).toHaveAttribute('href', '/settings/core');
  });

  test('shows the global setting hint as plain text on mobile', () => {
    renderToggles({ globalAutoDownloadOff: true, isMobile: true });

    expect(screen.getByText('Automatic downloads are off in Settings')).toBeInTheDocument();
  });

  test('does not link the global setting hint on mobile', () => {
    renderToggles({ globalAutoDownloadOff: true, isMobile: true });

    expect(screen.queryByRole('link', { name: /Automatic downloads are off/ })).not.toBeInTheDocument();
  });

  test('hides the global setting hint when automatic downloads are on', () => {
    renderToggles();

    expect(screen.queryByRole('link', { name: /Automatic downloads are off/ })).not.toBeInTheDocument();
  });
});
