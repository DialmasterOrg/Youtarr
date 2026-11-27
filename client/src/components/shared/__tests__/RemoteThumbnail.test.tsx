import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RemoteThumbnail from '../RemoteThumbnail';

describe('RemoteThumbnail', () => {
  test('shows the image with anything drawn over it', () => {
    render(
      <RemoteThumbnail src="https://i.ytimg.com/vi/abc/mqdefault.jpg">
        <span>4:10</span>
      </RemoteThumbnail>
    );

    expect(screen.getByRole('presentation')).toHaveAttribute('src', 'https://i.ytimg.com/vi/abc/mqdefault.jpg');
    expect(screen.getByText('4:10')).toBeInTheDocument();
  });

  test('leaves the placeholder box when there is no thumbnail', () => {
    render(<RemoteThumbnail src={null} />);

    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });
});
