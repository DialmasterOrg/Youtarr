import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { YtdlpChannelApplyDialog } from '../YtdlpChannelApplyDialog';
import { renderWithProviders } from '../../../../../test-utils';

describe('YtdlpChannelApplyDialog', () => {
  test('renders nothing when closed', () => {
    renderWithProviders(
      <YtdlpChannelApplyDialog targetChannel={null} onApply={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('describes the nightly switch', () => {
    renderWithProviders(
      <YtdlpChannelApplyDialog targetChannel="nightly" onApply={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByText(/latest nightly build/i)).toBeInTheDocument();
  });

  test('describes the stable switch as a downgrade', () => {
    renderWithProviders(
      <YtdlpChannelApplyDialog targetChannel="stable" onApply={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByText(/downgrades from the nightly build/i)).toBeInTheDocument();
  });

  test('Update now applies and closes', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const onClose = jest.fn();
    renderWithProviders(
      <YtdlpChannelApplyDialog targetChannel="nightly" onApply={onApply} onClose={onClose} />
    );

    await user.click(screen.getByRole('button', { name: /update now/i }));

    expect(onApply).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('Later closes without applying', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const onClose = jest.fn();
    renderWithProviders(
      <YtdlpChannelApplyDialog targetChannel="nightly" onApply={onApply} onClose={onClose} />
    );

    await user.click(screen.getByRole('button', { name: /later/i }));

    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
