import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FailedVideoLineList, { MAX_VISIBLE_FAILED_VIDEOS } from '../FailedVideoLineList';
import { FailedVideo } from '../../../types/Job';

describe('FailedVideoLineList', () => {
  const makeVideos = (count: number): FailedVideo[] =>
    Array.from({ length: count }, (_, i) => ({
      youtubeId: `vid${String(i).padStart(8, '0')}`,
      error: 'HTTP Error 403: Forbidden',
    }));

  test('renders one line per video when under the cap', () => {
    render(<FailedVideoLineList videos={makeVideos(3)} />);

    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  test('caps rendering and shows an overflow count', () => {
    render(<FailedVideoLineList videos={makeVideos(MAX_VISIBLE_FAILED_VIDEOS + 5)} />);

    expect(screen.getAllByRole('link')).toHaveLength(MAX_VISIBLE_FAILED_VIDEOS);
    expect(screen.getByText('...and 5 more')).toBeInTheDocument();
  });

  test('renders duplicate video ids without React key warnings', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dup: FailedVideo = { youtubeId: 'same1234567', error: 'err' };

    render(<FailedVideoLineList videos={[dup, { ...dup }]} />);

    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
