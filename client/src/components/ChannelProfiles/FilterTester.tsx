import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { ChannelProfile } from '../../types/ChannelProfile';

interface VideoMatch {
  video_id: number;
  youtube_id: string;
  original_title: string;
  clean_title: string;
  new_filename: string;
  season: number;
  episode: number;
  matched_by_filter: boolean;
}

interface FilterTesterProps {
  open: boolean;
  profile: ChannelProfile;
  token: string;
  onClose: () => void;
}

const FilterTester: React.FC<FilterTesterProps> = ({
  open,
  profile,
  token,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<VideoMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open && profile) {
      testFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile]);

  const testFilters = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(
        `/api/profiles/${profile.id}/test`,
        {},
        { headers: { 'x-access-token': token } }
      );
      setMatches(response.data.matches || []);
    } catch (err) {
      console.error('Error testing filters:', err);
      setError('Failed to test filters');
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = matches.filter(match =>
    match.original_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.new_filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const matchedCount = matches.filter(m => m.matched_by_filter).length;
  const totalCount = matches.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Test Filters: {profile.profile_name}
        {profile.is_default && (
          <Chip label="Default Profile" size="small" color="secondary" sx={{ ml: 2 }} />
        )}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Profile Info */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Profile Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  <strong>Naming Template:</strong> {profile.naming_template}
                </Typography>
                <Typography variant="body2">
                  <strong>Season:</strong> {profile.season_number}
                </Typography>
                <Typography variant="body2">
                  <strong>Filters:</strong>
                </Typography>
                {profile.filters && profile.filters.length > 0 ? (
                  <Box sx={{ pl: 2 }}>
                    {profile.filters.map((filter, index) => (
                      <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                        {index + 1}. <strong>{filter.filter_type}:</strong> {filter.filter_value}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary" sx={{ pl: 2 }}>
                    No filters (default profile catches all videos)
                  </Typography>
                )}
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Results Summary */}
          {!loading && !error && (
            <Alert
              severity={matchedCount > 0 ? 'success' : 'info'}
              icon={matchedCount > 0 ? <CheckIcon /> : <CancelIcon />}
            >
              <Typography variant="body2">
                {profile.is_default ? (
                  `Found ${totalCount} videos that would be processed as specials (Season 00)`
                ) : (
                  `Found ${matchedCount} matching videos out of ${totalCount} total videos in channel`
                )}
              </Typography>
            </Alert>
          )}

          {/* Search */}
          {matches.length > 0 && (
            <TextField
              placeholder="Search videos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          )}

          {/* Loading */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Testing filters...</Typography>
            </Box>
          )}

          {/* Error */}
          {error && (
            <Alert severity="error">
              {error}
              <Button onClick={testFilters} sx={{ ml: 2 }}>
                Retry
              </Button>
            </Alert>
          )}

          {/* Results Table */}
          {!loading && !error && filteredMatches.length > 0 && (
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Match</TableCell>
                    <TableCell>Episode</TableCell>
                    <TableCell>Original Title</TableCell>
                    <TableCell>New Filename</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMatches.map((match, index) => (
                    <TableRow key={match.video_id}>
                      <TableCell>
                        {match.matched_by_filter ? (
                          <CheckIcon color="success" fontSize="small" />
                        ) : (
                          <Chip label="Default" size="small" color="secondary" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          S{String(match.season).padStart(2, '0')}E{String(match.episode).padStart(3, '0')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>
                          {match.original_title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            maxWidth: 300,
                          }}
                        >
                          {match.new_filename}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* No Results */}
          {!loading && !error && matches.length === 0 && (
            <Alert severity="info">
              No videos found in this channel to test against.
            </Alert>
          )}

          {/* Filtered No Results */}
          {!loading && !error && matches.length > 0 && filteredMatches.length === 0 && searchTerm && (
            <Alert severity="info">
              No videos match your search term "{searchTerm}".
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={testFilters} disabled={loading}>
          Refresh
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilterTester;