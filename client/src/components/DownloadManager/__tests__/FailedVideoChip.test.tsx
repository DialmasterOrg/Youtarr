import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import FailedVideoChip from '../FailedVideoChip';

describe('FailedVideoChip', () => {
  test('renders the failed count as its label', () => {
    render(<FailedVideoChip count={2} />);
    expect(screen.getByText('2 failed')).toBeInTheDocument();
  });

  test('uses singular label for one failure', () => {
    render(<FailedVideoChip count={1} />);
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });

  test('shows diagnosis titles in the tooltip on hover', async () => {
    const user = userEvent.setup();
    render(
      <FailedVideoChip
        count={2}
        diagnosisTitles={['YouTube blocked the download while using your cookies']}
      />
    );

    await user.hover(screen.getByText('2 failed'));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(
      'YouTube blocked the download while using your cookies'
    );
  });

  test('falls back to a generic tooltip when no diagnoses exist', async () => {
    const user = userEvent.setup();
    render(<FailedVideoChip count={3} />);

    await user.hover(screen.getByText('3 failed'));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('3 downloads failed');
  });
});
