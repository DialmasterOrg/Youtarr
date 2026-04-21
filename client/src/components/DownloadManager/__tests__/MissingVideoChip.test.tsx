import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MissingVideoChip from '../MissingVideoChip';

describe('MissingVideoChip', () => {
  test('renders with the default "Missing" label', () => {
    render(<MissingVideoChip />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  test('renders a custom label when provided', () => {
    render(<MissingVideoChip label="2 missing" />);
    expect(screen.getByText('2 missing')).toBeInTheDocument();
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  });

  test('shows the default tooltip message on hover', async () => {
    const user = userEvent.setup();
    render(<MissingVideoChip />);

    await user.hover(screen.getByText('Missing'));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(
      'Video file not found on disk. It may have been deleted or moved.'
    );
  });

  test('shows a custom tooltip message on hover when the tooltip prop is provided', async () => {
    const user = userEvent.setup();
    render(
      <MissingVideoChip label="2 missing" tooltip="2 of 5 video files not found on disk" />
    );

    await user.hover(screen.getByText('2 missing'));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('2 of 5 video files not found on disk');
  });
});
