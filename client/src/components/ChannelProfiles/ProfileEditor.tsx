import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Paper,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Help as HelpIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import FilterBuilder from './FilterBuilder';
import NamingTemplateEditor from './NamingTemplateEditor';
import FolderBrowser from './FolderBrowser';
import { ChannelProfile, ProfileFilter } from '../../types/ChannelProfile';

interface ProfileEditorProps {
  open: boolean;
  profile: ChannelProfile | null;
  onClose: () => void;
  onSave: (profile: Partial<ChannelProfile>) => void;
  token: string;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  open,
  profile,
  onClose,
  onSave,
  token,
}) => {
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [formData, setFormData] = useState<Partial<ChannelProfile>>({
    profile_name: '',
    series_name: '',
    is_default: false,
    destination_path: '',
    naming_template: '{series} - s{season:02d}e{episode:03d} - {title}',
    season_number: 1,
    episode_counter: 1,
    generate_nfo: false,
    enabled: true,
    filters: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setFormData({
        ...profile,
        filters: profile.filters || [],
      });
    } else {
      setFormData({
        profile_name: '',
        series_name: '',
        is_default: false,
        destination_path: '',
        naming_template: '{series} - s{season:02d}e{episode:03d} - {title}',
        season_number: 1,
        episode_counter: 1,
        generate_nfo: false,
        enabled: true,
        filters: [],
      });
    }
    setErrors({});
  }, [profile, open]);

  const handleInputChange = (field: keyof ChannelProfile, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleFiltersChange = (filters: ProfileFilter[]) => {
    handleInputChange('filters', filters);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.profile_name?.trim()) {
      newErrors.profile_name = 'Profile name is required';
    }

    if (!formData.naming_template?.trim()) {
      newErrors.naming_template = 'Naming template is required';
    }

    if (!formData.is_default && (!formData.filters || formData.filters.length === 0)) {
      newErrors.filters = 'Non-default profiles must have at least one filter';
    }

    if (formData.season_number !== undefined && formData.season_number < 0) {
      newErrors.season_number = 'Season number must be 0 or greater';
    }

    if (formData.episode_counter !== undefined && formData.episode_counter < 1) {
      newErrors.episode_counter = 'Episode counter must be 1 or greater';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    onSave(formData);
  };

  const templateVariables = [
    { var: '{series}', desc: 'Series name (uses series_name or falls back to profile_name)' },
    { var: '{season}', desc: 'Season number' },
    { var: '{season:02d}', desc: 'Season number (padded to 2 digits)' },
    { var: '{episode}', desc: 'Episode number' },
    { var: '{episode:03d}', desc: 'Episode number (padded to 3 digits)' },
    { var: '{title}', desc: 'Original video title' },
    { var: '{clean_title}', desc: 'Title with filter match removed' },
    { var: '{year}', desc: 'Upload year' },
    { var: '{month}', desc: 'Upload month' },
    { var: '{day}', desc: 'Upload day' },
    { var: '{channel}', desc: 'Channel name' },
    { var: '{id}', desc: 'YouTube video ID' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {profile ? 'Edit Profile' : 'Create Profile'}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Basic Settings */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Basic Settings
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Profile Name"
                value={formData.profile_name || ''}
                onChange={(e) => handleInputChange('profile_name', e.target.value)}
                error={!!errors.profile_name}
                helperText={errors.profile_name || 'Name for this series profile (for internal organization)'}
                fullWidth
                required
              />

              <TextField
                label="Series Name"
                value={formData.series_name || ''}
                onChange={(e) => handleInputChange('series_name', e.target.value)}
                helperText="Name that will appear in your media server (leave empty to use profile name)"
                fullWidth
              />

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label="Destination Path"
                  value={formData.destination_path || ''}
                  onChange={(e) => handleInputChange('destination_path', e.target.value)}
                  helperText="Custom path for this series (leave empty to use default download directory)"
                  fullWidth
                />
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => setShowFolderBrowser(true)}
                  sx={{ mt: 1, minWidth: 100 }}
                >
                  Browse
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Season Number"
                  type="number"
                  value={formData.season_number ?? 1}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 1 : parseInt(e.target.value);
                    handleInputChange('season_number', isNaN(value) ? 1 : value);
                  }}
                  error={!!errors.season_number}
                  helperText={errors.season_number || 'Season number (0 for specials, 1+ for regular seasons)'}
                  sx={{ flex: 1 }}
                  inputProps={{ min: 0 }}
                />

                <TextField
                  label="Episode Counter"
                  type="number"
                  value={formData.episode_counter || 1}
                  onChange={(e) => handleInputChange('episode_counter', parseInt(e.target.value) || 1)}
                  error={!!errors.episode_counter}
                  helperText={errors.episode_counter || 'Next episode number to assign'}
                  sx={{ flex: 1 }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_default || false}
                      onChange={(e) => handleInputChange('is_default', e.target.checked)}
                    />
                  }
                  label="Default Profile"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.generate_nfo || false}
                      onChange={(e) => handleInputChange('generate_nfo', e.target.checked)}
                    />
                  }
                  label="Generate NFO Files"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enabled !== false}
                      onChange={(e) => handleInputChange('enabled', e.target.checked)}
                    />
                  }
                  label="Enabled"
                />
              </Box>

              {formData.is_default && (
                <Typography variant="body2" color="textSecondary">
                  <strong>Default Profile:</strong> Will catch all videos that don't match other profiles.
                  Videos will be placed in Season 00 (Specials).
                </Typography>
              )}
            </Box>
          </Paper>

          {/* Naming Template */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Naming Template
            </Typography>

            <NamingTemplateEditor
              template={formData.naming_template || ''}
              onChange={(template) => handleInputChange('naming_template', template)}
              error={errors.naming_template}
              variables={templateVariables}
            />
          </Paper>

          {/* Filters */}
          {!formData.is_default && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Filters
              </Typography>

              <FilterBuilder
                filters={formData.filters || []}
                onChange={handleFiltersChange}
                error={errors.filters}
              />
            </Paper>
          )}

          {/* Help Section */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">
                <HelpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Help & Examples
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2">Template Variables:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {templateVariables.map((item) => (
                    <Chip
                      key={item.var}
                      label={`${item.var} - ${item.desc}`}
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Box>

                <Divider />

                <Typography variant="subtitle2">Example Templates:</Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography variant="body2">
                    <strong>Standard:</strong> <code>{'{series} - s{season:02d}e{episode:03d} - {clean_title}'}</code>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Date-based:</strong> <code>{'{series} - {year}x{month:02d}{day:02d} - {title}'}</code>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Minimal:</strong> <code>{'S{season:02d}E{episode:03d} - {title}'}</code>
                  </Typography>
                </Box>

                <Divider />

                <Typography variant="subtitle2">Filter Examples:</Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography variant="body2">
                    <strong>Regex:</strong> <code>{'Tutorial #(\\d+):'}</code> - Matches "Tutorial #1: Introduction"
                  </Typography>
                  <Typography variant="body2">
                    <strong>Contains:</strong> <code>Daily Show</code> - Matches any title containing "Daily Show"
                  </Typography>
                  <Typography variant="body2">
                    <strong>Duration:</strong> <code>300-1800</code> - Matches videos between 5-30 minutes
                  </Typography>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          {profile ? 'Update' : 'Create'}
        </Button>
      </DialogActions>

      <FolderBrowser
        open={showFolderBrowser}
        currentPath={formData.destination_path}
        onClose={() => setShowFolderBrowser(false)}
        onSelect={(path) => {
          handleInputChange('destination_path', path);
          setShowFolderBrowser(false);
        }}
        token={token}
      />
    </Dialog>
  );
};

export default ProfileEditor;