import React from 'react';
import { Alert, Typography } from '../../../ui';
import { ConfigState } from '../../types';

const formatAgeThreshold = (threshold: string): string => {
  const days = parseInt(threshold, 10);
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  return `${threshold} days`;
};

const formatDays = (value: string): string => `${value} day${value === '1' ? '' : 's'}`;

interface AutoRemovalRulesSummaryProps {
  config: ConfigState;
}

export const AutoRemovalRulesSummary: React.FC<AutoRemovalRulesSummaryProps> = ({ config }) => {
  const rules: React.ReactNode[] = [];

  if (config.autoRemovalVideoAgeThreshold) {
    rules.push(
      <>It&apos;s older than <strong>{formatAgeThreshold(config.autoRemovalVideoAgeThreshold)}</strong></>
    );
  }

  if (config.autoRemovalWatchedEnabled) {
    rules.push(
      <>
        It&apos;s been watched
        {config.autoRemovalWatchedMinDaysSinceWatched && (
          <>, its last watch was at least <strong>{formatDays(config.autoRemovalWatchedMinDaysSinceWatched)}</strong> ago</>
        )}
        {config.autoRemovalWatchedMinVideoAgeDays && (
          <>, and it was downloaded at least <strong>{formatDays(config.autoRemovalWatchedMinVideoAgeDays)}</strong> ago</>
        )}
      </>
    );
  }

  if (config.autoRemovalFreeSpaceThreshold) {
    rules.push(
      <>Free space is below <strong>{config.autoRemovalFreeSpaceThreshold}</strong> (the oldest videos are deleted first until space is freed)</>
    );
  }

  if (rules.length === 0) {
    return null;
  }

  return (
    <Alert severity="success" className="mt-2">
      <Typography variant="body2" className="font-medium mb-2">
        Every night at 2:00 AM, a video is deleted if it matches {rules.length > 1 ? 'any of these rules' : 'this rule'}:
      </Typography>
      {rules.map((rule, index) => (
        <Typography key={`rule-${index}`} variant="body2">
          • {rule}{index < rules.length - 1 ? ', or' : ''}
        </Typography>
      ))}
      <Typography variant="body2" className="mt-2">
        Always kept: <strong>Protected</strong> videos
        {config.autoRemovalKeepRecentCount > 0 && (
          <>, and the <strong>{config.autoRemovalKeepRecentCount}</strong> newest downloads</>
        )}.
      </Typography>
    </Alert>
  );
};
