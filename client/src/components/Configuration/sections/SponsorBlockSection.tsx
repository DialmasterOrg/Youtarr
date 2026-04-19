import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  TextField,
  Grid,
  Alert,
  AlertTitle,
  Typography,
} from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState, SponsorBlockCategories } from '../types';

interface SponsorBlockSectionProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

const CATEGORY_OPTIONS = [
  { key: 'sponsor', label: 'Sponsor', description: 'Paid promotions, product placements' },
  { key: 'intro', label: 'Intro', description: 'Opening sequences, title cards' },
  { key: 'outro', label: 'Outro', description: 'End cards, credits' },
  { key: 'selfpromo', label: 'Self-Promotion', description: 'Channel merch, Patreon, other videos' },
  { key: 'preview', label: 'Preview/Recap', description: '"Coming up" or "Previously on" segments' },
  { key: 'filler', label: 'Filler', description: 'Tangential content, dead space' },
  { key: 'interaction', label: 'Interaction', description: '"Like and subscribe" reminders' },
  { key: 'music_offtopic', label: 'Music Off-Topic', description: 'Non-music content in music videos' },
];

export const SponsorBlockSection: React.FC<SponsorBlockSectionProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  const handleCategoryChange = (key: keyof SponsorBlockCategories, checked: boolean) => {
    onConfigChange({
      sponsorblockCategories: {
        ...config.sponsorblockCategories,
        [key]: checked,
      },
    });
  };

  return (
    <ConfigurationAccordion
      title="SponsorBlock Integration"
      statusBanner={{
        enabled: config.sponsorblockEnabled,
        label: 'Enable SponsorBlock',
        onToggle: (enabled) => onConfigChange({ sponsorblockEnabled: enabled }),
        onText: 'Enabled',
        offText: 'Disabled',
      }}
      defaultExpanded={false}
    >
      <Alert severity="info" style={{ marginBottom: 16 }}>
        <AlertTitle>What is SponsorBlock?</AlertTitle>
        <Typography variant="body2">
          SponsorBlock is a crowdsourced database that identifies segments in YouTube videos like sponsors, intros, outros, and self-promotions.
          When enabled, Youtarr can automatically remove or mark these segments during download.
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        {config.sponsorblockEnabled && (
          <>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Action for Segments</InputLabel>
                <Select
                  value={config.sponsorblockAction}
                  onChange={(e) => onConfigChange({ sponsorblockAction: e.target.value as 'remove' | 'mark' })}
                  label="Action for Segments"
                >
                  <MenuItem value="remove">Remove segments from video</MenuItem>
                  <MenuItem value="mark">Mark segments as chapters</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" style={{ marginTop: 4, display: 'block' }}>
                Remove: Cuts out segments entirely. Mark: Creates chapter markers for easy skipping.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Custom API URL (Optional)"
                name="sponsorblockApiUrl"
                value={config.sponsorblockApiUrl}
                onChange={(e) => onConfigChange({ sponsorblockApiUrl: e.target.value })}
                placeholder="https://sponsor.ajay.app"
                helperText="Leave empty to use the default SponsorBlock API"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom style={{ marginTop: 8, marginBottom: 8 }}>
                Segment Categories to {config.sponsorblockAction === 'remove' ? 'Remove' : 'Mark'}:
              </Typography>

              <Grid container spacing={1}>
                {CATEGORY_OPTIONS.map(({ key, label, description }) => (
                  <Grid item xs={12} sm={6} key={key}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          inputProps={{ 'data-testid': `category-${key}-checkbox` } as React.InputHTMLAttributes<HTMLInputElement>}
                          checked={config.sponsorblockCategories[key as keyof SponsorBlockCategories]}
                          onChange={(e) => handleCategoryChange(key as keyof SponsorBlockCategories, e.target.checked)}
                        />
                      }
                      label={
                        <div>
                          <Typography variant="body2">{label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {description}
                          </Typography>
                        </div>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </>
        )}
      </Grid>
    </ConfigurationAccordion>
  );
};
