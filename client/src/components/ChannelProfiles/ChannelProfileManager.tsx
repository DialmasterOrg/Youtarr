import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  FormControlLabel,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  PlayArrow as TestIcon,
} from '@mui/icons-material';
import axios from 'axios';
import ProfileEditor from './ProfileEditor';
import FilterTester from './FilterTester';
import { ChannelProfile, ProfileFilter } from '../../types/ChannelProfile';

interface ChannelProfileManagerProps {
  channelId: number;
  token: string;
}

const ChannelProfileManager: React.FC<ChannelProfileManagerProps> = ({
  channelId,
  token,
}) => {
  const [profiles, setProfiles] = useState<ChannelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<ChannelProfile | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [testingProfile, setTestingProfile] = useState<ChannelProfile | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<ChannelProfile | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/channels/${channelId}/profiles`, {
        headers: { 'x-access-token': token },
      });
      setProfiles(response.data);
    } catch (error) {
      console.error('Error loading profiles:', error);
      showSnackbar('Error loading profiles', 'error');
    } finally {
      setLoading(false);
    }
  }, [channelId, token, showSnackbar]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleCreateProfile = () => {
    setEditingProfile(null);
    setShowEditor(true);
  };

  const handleEditProfile = (profile: ChannelProfile) => {
    setEditingProfile(profile);
    setShowEditor(true);
  };

  const handleSaveProfile = async (profileData: Partial<ChannelProfile>) => {
    try {
      if (editingProfile) {
        // Update existing profile
        await axios.put(`/api/profiles/${editingProfile.id}`, profileData, {
          headers: { 'x-access-token': token },
        });
        showSnackbar('Profile updated successfully', 'success');
      } else {
        // Create new profile
        await axios.post(`/api/channels/${channelId}/profiles`, profileData, {
          headers: { 'x-access-token': token },
        });
        showSnackbar('Profile created successfully', 'success');
      }

      setShowEditor(false);
      setEditingProfile(null);
      await loadProfiles();
    } catch (error) {
      console.error('Error saving profile:', error);
      showSnackbar('Error saving profile', 'error');
    }
  };

  const handleDeleteProfile = (profile: ChannelProfile) => {
    setProfileToDelete(profile);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteProfile = async () => {
    if (!profileToDelete) return;

    try {
      await axios.delete(`/api/profiles/${profileToDelete.id}`, {
        headers: { 'x-access-token': token },
      });
      showSnackbar('Profile deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      setProfileToDelete(null);
      await loadProfiles();
    } catch (error) {
      console.error('Error deleting profile:', error);
      showSnackbar('Error deleting profile', 'error');
    }
  };

  const handleToggleEnabled = async (profile: ChannelProfile) => {
    try {
      await axios.put(
        `/api/profiles/${profile.id}`,
        { enabled: !profile.enabled },
        { headers: { 'x-access-token': token } }
      );
      await loadProfiles();
      showSnackbar(
        `Profile ${profile.enabled ? 'disabled' : 'enabled'}`,
        'success'
      );
    } catch (error) {
      console.error('Error toggling profile:', error);
      showSnackbar('Error updating profile', 'error');
    }
  };

  const handleTestProfile = (profile: ChannelProfile) => {
    setTestingProfile(profile);
    setShowTester(true);
  };

  const getFilterSummary = (filters: ProfileFilter[]) => {
    if (!filters || filters.length === 0) {
      return 'No filters';
    }

    const filterTypes = filters.map(f => {
      switch (f.filter_type) {
        case 'title_regex':
          return 'Regex';
        case 'title_contains':
          return 'Contains';
        case 'duration_range':
          return 'Duration';
        default:
          return 'Unknown';
      }
    });

    return filterTypes.join(', ');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="Series Configuration" />
        <CardContent>
          <Typography>Loading profiles...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Series Configuration"
          subheader="Configure automatic series organization for this channel"
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateProfile}
              color="primary"
            >
              Add Profile
            </Button>
          }
        />
        <CardContent>
          {profiles.length === 0 ? (
            <Alert severity="info">
              No series profiles configured. Videos will be downloaded using the standard naming convention.
              Create a profile to enable automatic series organization.
            </Alert>
          ) : (
            <List>
              {profiles.map((profile, index) => (
                <ListItem
                  key={profile.id}
                  divider={index < profiles.length - 1}
                  sx={{
                    opacity: profile.enabled ? 1 : 0.6,
                    backgroundColor: profile.is_default ? 'action.hover' : 'transparent',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                    <DragIcon color="disabled" />
                  </Box>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" component="span">
                          {profile.profile_name}
                        </Typography>
                        {profile.is_default && (
                          <Chip
                            label="Default"
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        )}
                        {profile.generate_nfo && (
                          <Chip
                            label="NFO"
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Season {profile.season_number} • Episode {profile.episode_counter} • {getFilterSummary(profile.filters)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" noWrap>
                          Template: {profile.naming_template}
                        </Typography>
                        {profile.destination_path && (
                          <Typography variant="body2" color="textSecondary" noWrap>
                            Path: {profile.destination_path}
                          </Typography>
                        )}
                      </Box>
                    }
                  />

                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={profile.enabled}
                            onChange={() => handleToggleEnabled(profile)}
                            size="small"
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
                      />

                      <Tooltip title="Test Filters">
                        <IconButton
                          onClick={() => handleTestProfile(profile)}
                          size="small"
                          color="info"
                        >
                          <TestIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Edit Profile">
                        <IconButton
                          onClick={() => handleEditProfile(profile)}
                          size="small"
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Delete Profile">
                        <IconButton
                          onClick={() => handleDeleteProfile(profile)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Profile Editor Dialog */}
      <ProfileEditor
        open={showEditor}
        profile={editingProfile}
        onClose={() => {
          setShowEditor(false);
          setEditingProfile(null);
        }}
        onSave={handleSaveProfile}
        token={token}
      />

      {/* Filter Tester Dialog */}
      {testingProfile && (
        <FilterTester
          open={showTester}
          profile={testingProfile}
          token={token}
          onClose={() => {
            setShowTester(false);
            setTestingProfile(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Profile</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the profile "{profileToDelete?.profile_name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteProfile} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ChannelProfileManager;