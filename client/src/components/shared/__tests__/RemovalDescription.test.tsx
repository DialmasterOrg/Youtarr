import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RemovalDescription from '../RemovalDescription';
import { formatDate } from '../../../utils/formatters';

const AT = '2026-10-19T12:00:00.000Z';

describe('RemovalDescription', () => {
  test('sets a missing file\'s path apart from the explanation', () => {
    render(<RemovalDescription row={{ removed: true, removed_reason: 'not_found', filePath: '/mnt/nas/Channel/video.mp4' }} />);

    expect(screen.getByRole('code')).toHaveTextContent(/^\/mnt\/nas\/Channel\/video\.mp4$/);
  });

  test('shows the path as the user knows it, without the container prefix', () => {
    render(<RemovalDescription row={{ removed: true, removed_reason: 'not_found', filePath: '/usr/src/app/data/Channel/v.mp4' }} />);

    expect(screen.getByText('Channel/v.mp4')).toBeInTheDocument();
  });

  test('reads as one sentence around the path, with when it was checked', () => {
    const { container } = render(
      <RemovalDescription row={{ removed: true, removed_reason: 'not_found', removed_at: AT, filePath: '/d/v.mp4' }} />
    );

    expect(container).toHaveTextContent(
      `Youtarr expected a file at: /d/v.mp4 and could not find it (checked ${formatDate(AT)}). If the drive is mounted and the file is really gone, mark it as deleted.`
    );
  });

  test('describes a missing file with no stored path in plain text', () => {
    const { container } = render(<RemovalDescription row={{ removed: true, removed_reason: 'not_found' }} />);

    expect(container).toHaveTextContent(
      'Youtarr expected a file and could not find it. If the drive is mounted and the file is really gone, mark it as deleted.'
    );
    expect(screen.queryByRole('code')).not.toBeInTheDocument();
  });

  test('explains a deleted video without showing its path', () => {
    const { container } = render(
      <RemovalDescription row={{ removed: true, removed_reason: 'user_deleted', removed_at: AT, filePath: '/d/v.mp4' }} />
    );

    expect(container).toHaveTextContent(`Deleted in Youtarr on ${formatDate(AT)}. It can be downloaded again.`);
    expect(screen.queryByText('/d/v.mp4')).not.toBeInTheDocument();
  });
});
