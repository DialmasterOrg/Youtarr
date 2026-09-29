import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import InfoPopoverButton from '../InfoPopoverButton';
import { renderWithProviders } from '../../../test-utils';

test('keeps the explanation hidden until the button is clicked', () => {
  renderWithProviders(<InfoPopoverButton ariaLabel="Some info">Explanation text</InfoPopoverButton>);

  expect(screen.queryByText('Explanation text')).not.toBeInTheDocument();
});

test('shows the explanation when the button is clicked', async () => {
  renderWithProviders(<InfoPopoverButton ariaLabel="Some info">Explanation text</InfoPopoverButton>);

  await userEvent.click(screen.getByRole('button', { name: 'Some info' }));

  expect(await screen.findByText('Explanation text')).toBeInTheDocument();
});

test('tints the icon with the given color', () => {
  renderWithProviders(<InfoPopoverButton ariaLabel="Some info" color="var(--warning)">Text</InfoPopoverButton>);

  expect(screen.getByRole('button', { name: 'Some info' })).toHaveStyle({ color: 'var(--warning)' });
});
