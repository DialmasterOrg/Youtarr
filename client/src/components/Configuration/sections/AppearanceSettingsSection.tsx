import React from 'react';
import { Box, Grid, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel } from '@mui/material';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { useThemeEngine } from '../../../contexts/ThemeEngineContext';

export const AppearanceSettingsSection: React.FC = () => {
  const { themeMode, setThemeMode, motionEnabled, setMotionEnabled } = useThemeEngine();

  return (
    <ConfigurationCard title="Appearance" subtitle="Theme and motion settings">
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Theme Mode</InputLabel>
            <Select
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value as any)}
              label="Theme Mode"
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={motionEnabled}
                  onChange={(event) => setMotionEnabled(event.target.checked)}
                />
              }
              label="Enable Theme Animations"
            />
          </Box>
        </Grid>
      </Grid>
    </ConfigurationCard>
  );
};

  export default AppearanceSettingsSection;
