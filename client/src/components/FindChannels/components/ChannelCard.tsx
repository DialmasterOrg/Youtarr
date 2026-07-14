import React from 'react';
import { Avatar, Box, Card, CardActionArea, Chip, Typography } from '../../ui';
import { ChannelSearchResult } from '../types';

interface ChannelCardProps {
  result: ChannelSearchResult;
  onClick: () => void;
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return count.toLocaleString();
}

export default function ChannelCard({ result, onClick }: ChannelCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardActionArea
        onClick={onClick}
        aria-label={result.subscribed ? `View ${result.name}` : `Add ${result.name}`}
      >
        <Box className="p-3 flex flex-col items-center gap-1.5 text-center">
          <Avatar
            src={result.thumbnailUrl || undefined}
            alt={result.name}
            className="h-20 w-20"
            imgProps={{ loading: 'lazy' }}
          />
          <Typography variant="body2" className="font-semibold line-clamp-1">
            {result.name}
          </Typography>
          {result.handle && (
            <Typography variant="caption" className="text-muted-foreground line-clamp-1">
              {result.handle}
            </Typography>
          )}
          <Box className="flex items-center gap-2 flex-wrap justify-center">
            {result.subscriberCount !== null && (
              <Typography variant="caption" className="text-muted-foreground">
                {formatCount(result.subscriberCount)} subscribers
              </Typography>
            )}
            {result.videoCount !== null && (
              <Typography variant="caption" className="text-muted-foreground">
                {formatCount(result.videoCount)} videos
              </Typography>
            )}
          </Box>
          {result.subscribed && <Chip label="Subscribed" size="small" color="success" />}
        </Box>
      </CardActionArea>
    </Card>
  );
}
