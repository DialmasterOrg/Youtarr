import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Switch,
  FormControlLabel,
  Radio,
  Typography,
} from '@mui/material';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { InfoTooltip } from '../common/InfoTooltip';
import { useThemeEngine } from '../../../contexts/ThemeEngineContext';
import { ALL_THEMES } from '../../../themes';

interface AppearanceSettingsSectionProps {
  onMobileTooltipClick?: (text: string) => void;
}

export const AppearanceSettingsSection: React.FC<AppearanceSettingsSectionProps> = ({
  onMobileTooltipClick,
}) => {
  const { themeMode, setThemeMode, motionEnabled, setMotionEnabled } = useThemeEngine();

  return (
    <ConfigurationCard title="Appearance" subtitle="Theme, visual style, and motion settings">
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {/* Theme Animation Toggle */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={motionEnabled}
                  onChange={(event) => setMotionEnabled(event.target.checked)}
                />
              }
              label="Enable Theme Animations & Motion"
            />
            <InfoTooltip
              text="Enable smooth transitions, floating animations, and motion accents throughout the interface."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        {/* Visual Style Selection */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Visual Style
            </Typography>
            <InfoTooltip
              text="Choose between the Playful Geometric, Neumorphic Soft UI, Linear Modern, and Bold Flat visual systems."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        {Object.values(ALL_THEMES).map((theme) => (
          <Grid item xs={12} md={3} key={theme.id}>
            <Card
              sx={{
                height: '100%',
                borderRadius: theme.tokens.light['radius-ui'] || 'var(--radius-ui)',
                border: themeMode === theme.id ? '2px solid var(--primary)' : '2px solid var(--border-strong)',
                boxShadow: themeMode === theme.id ? 'var(--shadow-hard)' : 'var(--shadow-soft)',
                transition: 'all 300ms var(--transition-bouncy)',
              }}
            >
              <CardActionArea
                onClick={() => setThemeMode(theme.id)}
                aria-label={`Select ${theme.name} theme`}
                sx={{ height: '100%' }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {theme.name}
                    </Typography>
                    <Radio checked={themeMode === theme.id} />
                  </Box>
                  <Box>
                    {theme.preview}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {theme.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </ConfigurationCard>
  );
};

export default AppearanceSettingsSection;
