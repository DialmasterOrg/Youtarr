import React from 'react';
import { Box, Typography, Skeleton, Tooltip, Chip, Accordion, AccordionSummary, AccordionDetails } from '../../../ui';
import { formatDate } from '../../../../utils/formatters';
import { VideoModalData, VideoExtendedMetadata } from '../types';

interface VideoTechnicalProps {
  video: VideoModalData;
  metadata: VideoExtendedMetadata | null;
  loading: boolean;
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * 1024 * 1024;

const INTERNAL_PATH_PREFIX = '/usr/src/app/data/';

function formatFileSize(bytes: number): string {
  if (bytes >= BYTES_PER_GB) {
    return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
  }
  if (bytes >= BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  }
  if (bytes >= BYTES_PER_KB) {
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function stripInternalPath(filePath: string): string {
  if (filePath.startsWith(INTERNAL_PATH_PREFIX)) {
    return filePath.slice(INTERNAL_PATH_PREFIX.length);
  }
  return filePath;
}

function getOrientationLabel(ratio: number): string {
  if (ratio > 1) return 'Landscape';
  if (ratio < 1) return 'Portrait';
  return 'Square';
}

function formatDownloadedResolution(
  width: number | null,
  height: number | null,
  tier: number | null
): string | null {
  if (!height) return null;
  const base = width ? `${width}x${height}` : `${height}p`;
  // Show the tier label when it differs from the actual height (non-16:9 videos).
  // For 16:9 videos the tier matches the height, so appending it would be redundant.
  if (tier && tier !== height) {
    return `${base} (${tier}p)`;
  }
  return base;
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingTop: 4, paddingBottom: 4 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

interface FileRowProps {
  label: string;
  filePath: string;
  fileSize: number | null;
}

function FileRow({ label, filePath, fileSize }: FileRowProps) {
  const displayPath = stripInternalPath(filePath);
  const sizeLabel = fileSize ? formatFileSize(fileSize) : 'Unknown size';

  return (
    <Box style={{ paddingTop: 6, paddingBottom: 6 }}>
      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, marginLeft: 1, flexShrink: 0 }}>
          {sizeLabel}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{
          display: 'block',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          maxWidth: '100%',
          marginTop: 0.25,
        }}
      >
        {displayPath}
      </Typography>
    </Box>
  );
}

function VideoTechnical({ video, metadata, loading }: VideoTechnicalProps) {
  // Build metadata-dependent technical details (YouTube ID always shown first)
  const metaTechDetails: DetailRowProps[] = [];
  const availableResolutions = metadata?.availableResolutions ?? null;

  if (!loading) {
    if (video.isDownloaded && metadata?.height) {
      const downloadRes = formatDownloadedResolution(
        metadata.width,
        metadata.height,
        metadata.downloadedTier
      );
      if (downloadRes) {
        metaTechDetails.push({ label: 'Downloaded', value: downloadRes });
      }
    }
    if (metadata?.fps != null) {
      metaTechDetails.push({ label: 'FPS', value: `${metadata.fps}` });
    }
    if (metadata?.aspectRatio != null && typeof metadata.aspectRatio === 'number') {
      const orientation = getOrientationLabel(metadata.aspectRatio);
      metaTechDetails.push({
        label: 'Aspect Ratio',
        value: `${metadata.aspectRatio.toFixed(2)} (${orientation})`,
      });
    }
    if (metadata?.language) {
      metaTechDetails.push({ label: 'Language', value: metadata.language });
    }
  }

  // File info — most fields come from video props (always available)
  const hasVideoFile = video.filePath !== null;
  const hasAudioFile = video.audioFilePath !== null;
  const relatedFiles = !loading ? (metadata?.relatedFiles ?? null) : null;
  const addedDate = formatDate(video.addedAt);
  const showFileDetails = video.isDownloaded || video.status === 'missing';

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--video-modal-section-gap, 12px)' }}>
      {/* Video Details — always rendered; YouTube ID never requires metadata */}
      <Accordion defaultExpanded style={{ width: '100%' }}>
        <AccordionSummary>Video Details</AccordionSummary>
        <AccordionDetails>
          <Box>
            <DetailRow label="Video ID" value={video.youtubeId} />
            {loading ? (
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
                <Skeleton variant="rounded" height={20} />
                <Skeleton variant="rounded" height={20} />
              </Box>
            ) : (
              <>
                {metaTechDetails.map((detail) => (
                  <DetailRow key={detail.label} label={detail.label} value={detail.value} />
                ))}
              </>
            )}
            {!loading && availableResolutions && (
              <Box style={{ paddingTop: 4, paddingBottom: 4 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  Available Resolutions
                </Typography>
                <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {availableResolutions.map((h) => {
                    // Match by tier when available (handles non-16:9 videos correctly),
                    // fall back to raw height for backward-compatible info.json files.
                    const downloadedMarker = metadata?.downloadedTier ?? metadata?.height ?? null;
                    const isDownloaded = video.isDownloaded && downloadedMarker === h;
                    return (
                      <Chip
                        key={h}
                        label={`${h}p`}
                        size="small"
                        color={isDownloaded ? 'primary' : 'default'}
                        variant={isDownloaded ? 'filled' : 'outlined'}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {showFileDetails && (
        <Accordion defaultExpanded style={{ width: '100%' }}>
          <AccordionSummary>File Details</AccordionSummary>
          <AccordionDetails>
            <Box>
              {hasVideoFile && (
                <FileRow
                  label="Video"
                  filePath={video.filePath!}
                  fileSize={video.fileSize}
                />
              )}
              {hasAudioFile && (
                <FileRow
                  label="Audio"
                  filePath={video.audioFilePath!}
                  fileSize={video.audioFileSize}
                />
              )}
              {relatedFiles && relatedFiles.map((file) => (
                <FileRow
                  key={file.fileName}
                  label={file.type}
                  filePath={file.fileName}
                  fileSize={file.fileSize}
                />
              ))}
              {addedDate && (
                <DetailRow label="Added" value={addedDate} />
              )}
              {!hasVideoFile && !hasAudioFile && !relatedFiles && !addedDate && (
                <Typography variant="body2" color="text.secondary">
                  No file details available
                </Typography>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

export default VideoTechnical;
