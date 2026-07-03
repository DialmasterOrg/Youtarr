import { groupFailuresByDiagnosis } from '../failureGrouping';
import { FailedVideo, DownloadDiagnosis } from '../../../types/Job';

describe('groupFailuresByDiagnosis', () => {
  const diagnoses: DownloadDiagnosis[] = [
    {
      key: 'http-403-cookies-enabled',
      title: 'YouTube blocked the download while using your cookies',
      message: 'Re-export fresh cookies from your browser.',
      count: 2,
    },
  ];

  const video = (overrides: Partial<FailedVideo> = {}): FailedVideo => ({
    youtubeId: 'vid00000001',
    title: 'Broken Video',
    error: 'HTTP Error 403: Forbidden',
    diagnosisKey: 'http-403-cookies-enabled',
    ...overrides,
  });

  test('groups diagnosed videos under the diagnosis key with title and message', () => {
    const groups = groupFailuresByDiagnosis(
      [video(), video({ youtubeId: 'vid00000002' })],
      diagnoses
    );

    expect(groups.size).toBe(1);
    const group = groups.get('http-403-cookies-enabled');
    expect(group?.heading).toBe('YouTube blocked the download while using your cookies');
    expect(group?.message).toBe('Re-export fresh cookies from your browser.');
    expect(group?.videos).toHaveLength(2);
  });

  test('groups undiagnosed videos by raw error with no heading or message', () => {
    const groups = groupFailuresByDiagnosis(
      [video({ diagnosisKey: undefined, error: 'Postprocessing failed' })],
      diagnoses
    );

    const group = groups.get('Postprocessing failed');
    expect(group?.heading).toBeUndefined();
    expect(group?.message).toBeUndefined();
    expect(group?.videos).toHaveLength(1);
  });

  test('keeps diagnosed and undiagnosed failures in separate groups', () => {
    const groups = groupFailuresByDiagnosis(
      [video(), video({ youtubeId: 'vid00000002', diagnosisKey: undefined, error: 'Network timeout' })],
      diagnoses
    );

    expect([...groups.keys()].sort()).toEqual(['Network timeout', 'http-403-cookies-enabled']);
  });

  test('treats a diagnosisKey with no matching diagnosis entry as undiagnosed', () => {
    const groups = groupFailuresByDiagnosis([video({ diagnosisKey: 'unknown-key' })], diagnoses);

    const group = groups.get('HTTP Error 403: Forbidden');
    expect(group?.heading).toBeUndefined();
    expect(group?.videos).toHaveLength(1);
  });
});
