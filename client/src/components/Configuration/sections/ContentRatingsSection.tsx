import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState } from '../types';
import RatingBadge from '../../shared/RatingBadge';

interface ContentRatingsSectionProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

const MPAA_RATINGS = [
  { code: 'G', label: 'G', description: 'General Audiences' },
  { code: 'PG', label: 'PG', description: 'Parental Guidance' },
  { code: 'PG-13', label: 'PG-13', description: 'Parents Strongly Cautioned' },
  { code: 'R', label: 'R', description: 'Restricted' },
  { code: 'NC-17', label: 'NC-17', description: 'No Children Under 17' },
];

const TV_RATINGS = [
  { code: 'TV-Y', label: 'TV-Y', description: 'Young Children Only' },
  { code: 'TV-Y7', label: 'TV-Y7', description: 'Children 7 and Older' },
  { code: 'TV-G', label: 'TV-G', description: 'General Audiences' },
  { code: 'TV-PG', label: 'TV-PG', description: 'Parental Guidance' },
  { code: 'TV-14', label: 'TV-14', description: '14 and Older' },
  { code: 'TV-MA', label: 'TV-MA', description: 'Mature Audiences Only' },
];

export const ContentRatingsSection: React.FC<ContentRatingsSectionProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  return (
    <ConfigurationAccordion
      title="Content Ratings"
      chipLabel="Configured"
      chipColor="info"
      defaultExpanded={false}
    >
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Content Rating System</AlertTitle>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Youtarr supports both MPAA (movies) and TV rating systems. These ratings can be:
        </Typography>
        <ul style={{ marginTop: 8, marginBottom: 0 }}>
          <li><strong>Inherited:</strong> Videos use their parsed YouTube content ratings (default)</li>
          <li><strong>Channel Override:</strong> All videos from a channel use the configured rating</li>
          <li><strong>Custom Badge:</strong> Ratings appear as color-coded badges on video lists</li>
        </ul>
      </Alert>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Rating Systems
        </Typography>
        
        <Grid container spacing={3}>
          {/* MPAA Ratings */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                MPAA Ratings (Movies)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Rating</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Age Group</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {MPAA_RATINGS.map((rating) => (
                      <TableRow key={rating.code} hover>
                        <TableCell>
                          <RatingBadge rating={rating.code} size="small" />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {rating.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {rating.description}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* TV Ratings */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                TV Ratings (Television)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Rating</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Age Group</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {TV_RATINGS.map((rating) => (
                      <TableRow key={rating.code} hover>
                        <TableCell>
                          <RatingBadge rating={rating.code} size="small" />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {rating.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {rating.description}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Alert severity="success" sx={{ mt: 2 }}>
        <AlertTitle>How It Works</AlertTitle>
        <Typography variant="body2" component="div" sx={{ mt: 1 }}>
          <strong>1. Per-Channel Configuration:</strong> Set a default rating for each channel in the channel settings or channel page
        </Typography>
        <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
          <strong>2. Inheritance:</strong> When no channel-level rating is set, videos use their parsed YouTube ratings
        </Typography>
        <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
          <strong>3. Display:</strong> Rating badges appear on the Videos page and can be used for content filtering
        </Typography>
      </Alert>
    </ConfigurationAccordion>
  );
};
