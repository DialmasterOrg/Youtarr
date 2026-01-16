import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

interface ConfigurationCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isInteractive?: boolean;
}

/**
 * Reusable card wrapper with consistent styling for configuration sections
 */
export const ConfigurationCard: React.FC<ConfigurationCardProps> = ({
  title,
  subtitle,
  children,
  isInteractive = false,
}) => {
  return (
    <Card
      /* toggle 'hover:animate-wiggle' here */
      className={isInteractive ? 'wiggle-card' : undefined}
      elevation={2}
      sx={{
        mb: 3,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {subtitle}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
};
