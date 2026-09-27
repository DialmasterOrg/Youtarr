import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DownloadPercentInfo from '../DownloadPercentInfo';
import { renderWithProviders } from '../../../../test-utils';

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Download percentage info' }));
};

test('explains the highlighted auto-download tabs', async () => {
  renderWithProviders(<DownloadPercentInfo />);
  await open();

  expect(await screen.findByText(/Highlighted tabs download automatically/)).toBeInTheDocument();
});

test('explains that only public videos are counted', async () => {
  renderWithProviders(<DownloadPercentInfo />);
  await open();

  expect(await screen.findByText(/Public videos only/)).toBeInTheDocument();
});
