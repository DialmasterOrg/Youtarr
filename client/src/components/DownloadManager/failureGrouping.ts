import { FailedVideo, DownloadDiagnosis } from '../../types/Job';

export interface FailureGroup {
  heading?: string;
  message?: string;
  videos: FailedVideo[];
}

// Keyed by diagnosis key when the backend identified a known failure
// signature, otherwise by raw error message. Either way the Map key is
// stable and unique per group, so it doubles as a React key.
export function groupFailuresByDiagnosis(
  failedVideos: FailedVideo[],
  diagnoses: DownloadDiagnosis[] = []
): Map<string, FailureGroup> {
  const groups = new Map<string, FailureGroup>();
  failedVideos.forEach((video) => {
    const diagnosis = video.diagnosisKey
      ? diagnoses.find((d) => d.key === video.diagnosisKey)
      : undefined;
    const groupKey = diagnosis ? diagnosis.key : video.error;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.videos.push(video);
    } else {
      groups.set(groupKey, {
        heading: diagnosis?.title,
        message: diagnosis?.message,
        videos: [video],
      });
    }
  });
  return groups;
}
