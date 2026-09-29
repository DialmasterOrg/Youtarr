import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PlaylistCountsInfo from '../PlaylistCountsInfo';
import { renderWithProviders } from '../../../test-utils';

const openInfo = async () => {
  renderWithProviders(<PlaylistCountsInfo />);
  await userEvent.click(screen.getByRole('button', { name: 'Playlist video count info' }));
};

test('keeps the explanation hidden until the button is clicked', () => {
  renderWithProviders(<PlaylistCountsInfo />);

  expect(screen.queryByText(/later deleted aren't counted/)).not.toBeInTheDocument();
});

test('explains that deleted downloads are not counted', async () => {
  await openInfo();

  expect(await screen.findByText(/later deleted aren't counted/)).toBeInTheDocument();
});

test('explains that private and members-only entries are left out of the total', async () => {
  await openInfo();

  expect(await screen.findByText(/private and members-only/)).toBeInTheDocument();
});

test('explains the 5,000 video tracking limit', async () => {
  await openInfo();

  expect(await screen.findByText(/first 5,000 videos of a playlist, in playlist order/)).toBeInTheDocument();
});
