import React from 'react';
import { Card, CardContent, Typography } from '../../ui';

interface ConfigurationCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Reusable card wrapper with consistent styling for configuration sections
 */
export const ConfigurationCard: React.FC<ConfigurationCardProps> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <Card
      elevation={2}
      style={{
        marginBottom: 24,
        border: '1px solid var(--border)',
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
