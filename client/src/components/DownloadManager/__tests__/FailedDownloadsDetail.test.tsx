import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FailedDownloadsDetail from '../FailedDownloadsDetail';
import { MAX_VISIBLE_FAILED_VIDEOS } from '../FailedVideoLineList';
import { FailedVideo, DownloadDiagnosis } from '../../../types/Job';

describe('FailedDownloadsDetail', () => {
  const diagnoses: DownloadDiagnosis[] = [
    {
      key: 'http-403-cookies-enabled',
      title: 'YouTube blocked the download while using your cookies',
      message: 'Re-export fresh cookies from your browser.',
      count: 2,
    },
  ];

  const diagnosedVideo = (overrides: Partial<FailedVideo> = {}): FailedVideo => ({
    youtubeId: 'vid00000001',
    title: 'Broken Video',
    channel: 'StarTalk',
    error: 'HTTP Error 403: Forbidden',
    diagnosisKey: 'http-403-cookies-enabled',
    ...overrides,
  });

  test('renders the diagnosis advice once for a group of videos', () => {
    render(
      <FailedDownloadsDetail
        failedVideos={[
          diagnosedVideo(),
          diagnosedVideo({ youtubeId: 'vid00000002', title: 'Other Video' }),
        ]}
        diagnoses={diagnoses}
      />
    );

    expect(
      screen.getAllByText('Re-export fresh cookies from your browser.')
    ).toHaveLength(1);
    expect(screen.getByText(/Broken Video/)).toBeInTheDocument();
    expect(screen.getByText(/Other Video/)).toBeInTheDocument();
  });

  test('falls back to the raw error for undiagnosed failures', () => {
    render(
      <FailedDownloadsDetail
        failedVideos={[
          diagnosedVideo({ diagnosisKey: undefined, error: 'Postprocessing failed' }),
        ]}
      />
    );

    expect(screen.getByText('Postprocessing failed')).toBeInTheDocument();
  });

  test('caps long failure lists with an overflow count', () => {
    const videos = Array.from({ length: MAX_VISIBLE_FAILED_VIDEOS + 5 }, (_, i) =>
      diagnosedVideo({
        youtubeId: `vid${String(i).padStart(8, '0')}`,
        title: undefined,
        channel: undefined,
      })
    );

    render(<FailedDownloadsDetail failedVideos={videos} diagnoses={diagnoses} />);

    expect(screen.getAllByRole('link')).toHaveLength(MAX_VISIBLE_FAILED_VIDEOS);
    expect(screen.getByText('...and 5 more')).toBeInTheDocument();
  });

  test('renders nothing when there are no failed videos', () => {
    const { container } = render(<FailedDownloadsDetail failedVideos={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  test('shows a YouTube ID link for videos with no title', () => {
    render(
      <FailedDownloadsDetail
        failedVideos={[
          diagnosedVideo({ title: undefined, channel: undefined }),
        ]}
        diagnoses={diagnoses}
      />
    );

    expect(screen.getByRole('link', { name: 'vid00000001' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=vid00000001'
    );
  });

  test('does not render the legacy Unknown sentinel from old job records', () => {
    render(
      <FailedDownloadsDetail
        failedVideos={[
          diagnosedVideo({ title: 'Unknown', channel: 'Unknown' }),
        ]}
        diagnoses={diagnoses}
      />
    );

    expect(screen.queryByText(/Unknown by Unknown/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'vid00000001' })).toBeInTheDocument();
  });
});
