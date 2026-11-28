import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoStatusChip from '../VideoStatusChip';
import { renderWithProviders } from '../../../test-utils';

describe('VideoStatusChip', () => {
  test('names the status', () => {
    renderWithProviders(<VideoStatusChip status="missing" />);

    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  test('uses the page wording for a video that has its file', () => {
    renderWithProviders(<VideoStatusChip status="downloaded" downloadedLabel="Available" />);

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.queryByText('Downloaded')).not.toBeInTheDocument();
  });

  test('leaves other statuses alone when the page has its own wording', () => {
    renderWithProviders(<VideoStatusChip status="ignored" downloadedLabel="Available" />);

    expect(screen.getByText('Ignored')).toBeInTheDocument();
  });
});
