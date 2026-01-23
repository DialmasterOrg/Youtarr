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
              text="Choose between the Playful Geometric and Neumorphic Soft UI visual systems."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              border: '2px solid var(--border-strong)',
              boxShadow: themeMode === 'playful' ? 'var(--shadow-hard)' : 'var(--shadow-soft)',
              transition: 'all 300ms var(--transition-bouncy)',
            }}
          >
            <CardActionArea
              onClick={() => setThemeMode('playful')}
              aria-label="Select Playful Geometric theme"
              sx={{ height: '100%' }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Playful Geometric
                  </Typography>
                  <Radio checked={themeMode === 'playful'} />
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: '#fffdf5',
                    border: '2px solid #1e293b',
                    boxShadow: '4px 4px 0px 0px #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: '#f472b6' }} />
                  <Box sx={{ width: 32, height: 8, borderRadius: 999, bgcolor: '#fbbf24' }} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Warm cream surface, punchy shadows, and playful motion accents.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              border: '2px solid var(--border-strong)',
              boxShadow: themeMode === 'neumorphic' ? 'var(--shadow-hard)' : 'var(--shadow-soft)',
              transition: 'all 300ms var(--transition-bouncy)',
            }}
          >
            <CardActionArea
              onClick={() => setThemeMode('neumorphic')}
              aria-label="Select Neumorphic Soft UI theme"
              sx={{ height: '100%' }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Neumorphic Soft UI
                  </Typography>
                  <Radio checked={themeMode === 'neumorphic'} />
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: '#e0e5ec',
                    boxShadow:
                      '9px 9px 16px rgba(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box
                    className="neumo-float"
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '999px',
                      boxShadow:
                        'inset 6px 6px 10px rgba(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)',
                    }}
                  />
                  <Box
                    className="neumo-rotate"
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '999px',
                      boxShadow:
                        '9px 9px 16px rgba(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)',
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Cool grey clay, dual shadows, and soft ambient depth.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </ConfigurationCard>
  );
};

export default AppearanceSettingsSection;
