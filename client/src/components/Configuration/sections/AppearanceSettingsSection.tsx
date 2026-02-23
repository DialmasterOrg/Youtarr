import React from 'react';
import {
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Switch,
  FormControlLabel,
  Typography,
} from '../../ui';
import { RadioGroupItem } from '../../ui/form';
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
  const { themeMode, setThemeMode, motionEnabled, setMotionEnabled, colorMode, setColorMode } = useThemeEngine();

  return (
    <ConfigurationCard title="Appearance" subtitle="Theme, visual style, and motion settings">
      <Grid container spacing={2} className="mt-1">
        {/* Dark Mode Toggle */}
        <Grid item xs={12}>
          <div className="flex items-center">
            <FormControlLabel
              control={
                <Switch
                  checked={colorMode === 'dark'}
                  onChange={(event) => setColorMode(event.target.checked ? 'dark' : 'light')}
                />
              }
              label="Dark Mode"
            />
            <InfoTooltip
              text="Toggle between light and dark color mode. Your preference is saved locally."
              onMobileClick={onMobileTooltipClick}
            />
          </div>
        </Grid>

        {/* Theme Animation Toggle */}
        <Grid item xs={12}>
          <div className="flex items-center">
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
          </div>
        </Grid>

        {/* Visual Style Selection */}
        <Grid item xs={12}>
          <div className="flex items-center gap-2">
            <Typography variant="h6" className="font-bold">
              Visual Style
            </Typography>
            <InfoTooltip
              text="Choose between the Playful Geometric, Neumorphic Soft UI, and Linear Modern visual systems."
              onMobileClick={onMobileTooltipClick}
            />
          </div>
        </Grid>

        {Object.values(ALL_THEMES).map((theme) => (
          <Grid item xs={12} md={3} key={theme.id}>
            <Card
              className="h-full flex flex-col"
              style={{
                borderRadius: theme.tokens.light['radius-ui'] || 'var(--radius-ui)',
                border: themeMode === theme.id ? '2px solid var(--primary)' : '2px solid var(--border-strong)',
                boxShadow: themeMode === theme.id ? 'var(--shadow-hard)' : 'var(--shadow-soft)',
                transition: 'all 300ms var(--transition-bouncy)',
              }}
            >
              <CardActionArea
                onClick={() => setThemeMode(theme.id)}
                aria-label={`Select ${theme.name} theme`}
                className="h-full flex flex-col"
              >
                <CardContent className="flex flex-col gap-3 flex-1 w-full">
                  <div className="flex items-center justify-between">
                    <Typography variant="subtitle1" className="font-bold">
                      {theme.name}
                    </Typography>
                    <RadioGroupItem value={theme.id} checked={themeMode === theme.id} onChange={() => setThemeMode(theme.id)} />
                  </div>
                  <div className="flex items-center w-full px-0 py-2" style={{ minHeight: 120 }}>
                    {theme.preview}
                  </div>
                  <Typography variant="body2" color="secondary" className="mt-auto">
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
