import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FailedDownloadsDetail from '../FailedDownloadsDetail';
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

  test('renders nothing when there are no failed videos', () => {
    const { container } = render(<FailedDownloadsDetail failedVideos={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
