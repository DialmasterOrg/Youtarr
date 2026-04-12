import React from 'react';
import { Box, Typography, Skeleton, Card, CardContent, Tooltip, Chip, useTheme, useMediaQuery } from '@mui/material';
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

function formatAddedDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function formatResolutionLabel(height: number | null): string | null {
  if (!height) return null;
  return `${height}p`;
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
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
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
    <Box sx={{ py: 0.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
          {sizeLabel}
        </Typography>
      </Box>
      <Tooltip title={displayPath} arrow placement="bottom-start" enterTouchDelay={0}>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            mt: 0.25,
          }}
        >
          {displayPath}
        </Typography>
      </Tooltip>
    </Box>
  );
}

function VideoTechnical({ video, metadata, loading }: VideoTechnicalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="rounded" height={120} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="rounded" height={120} />
        </Box>
      </Box>
    );
  }

  // Build technical details
  const technicalDetails: DetailRowProps[] = [];
  const availableResolutions = metadata?.availableResolutions ?? null;

  // Download resolution - only for downloaded videos
  if (video.isDownloaded && metadata?.height) {
    const downloadRes = formatDownloadedResolution(
      metadata.width,
      metadata.height,
      metadata.downloadedTier
    );
    if (downloadRes) {
      technicalDetails.push({ label: 'Downloaded', value: downloadRes });
    }
  }

  if (metadata?.fps !== null && metadata?.fps !== undefined) {
    technicalDetails.push({ label: 'FPS', value: `${metadata.fps}` });
  }
  if (metadata?.aspectRatio !== null && metadata?.aspectRatio !== undefined && typeof metadata.aspectRatio === 'number') {
    const orientation = getOrientationLabel(metadata.aspectRatio);
    technicalDetails.push({
      label: 'Aspect Ratio',
      value: `${metadata.aspectRatio.toFixed(2)} (${orientation})`,
    });
  }
  if (metadata?.language) {
    technicalDetails.push({ label: 'Language', value: metadata.language });
  }

  // Build file info
  const hasVideoFile = video.filePath !== null;
  const hasAudioFile = video.audioFilePath !== null;
  const relatedFiles = metadata?.relatedFiles ?? null;
  const addedDate = formatAddedDate(video.addedAt);
  const hasFileInfo = hasVideoFile || hasAudioFile || relatedFiles || addedDate;

  const hasTechnical = technicalDetails.length > 0 || availableResolutions;

  // Return null if nothing to show
  if (!hasTechnical && !hasFileInfo) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
      {hasTechnical && (
        <Card
          variant="outlined"
          sx={{
            flex: 1,
            ...(isMobile && {
              border: 'none',
              borderTop: 1,
              borderColor: 'divider',
              borderRadius: 0,
            }),
          }}
        >
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1 }}>
              Technical
            </Typography>
            <Box
              sx={{
                '& > div:nth-of-type(even)': {
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  mx: -0.5,
                  px: 0.5,
                },
              }}
            >
              {technicalDetails.map((detail) => (
                <DetailRow key={detail.label} label={detail.label} value={detail.value} />
              ))}
            </Box>
            {availableResolutions && (
              <Box sx={{ py: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  Available Resolutions
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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
                        sx={{ fontSize: '0.75rem', height: 24 }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {hasFileInfo && (
        <Card
          variant="outlined"
          sx={{
            flex: 1,
            ...(isMobile && {
              border: 'none',
              borderTop: 1,
              borderColor: 'divider',
              borderRadius: 0,
            }),
          }}
        >
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1 }}>
              Files
            </Typography>
            <Box
              sx={{
                '& > div:nth-of-type(even)': {
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  mx: -0.5,
                  px: 0.5,
                },
              }}
            >
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
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default VideoTechnical;
