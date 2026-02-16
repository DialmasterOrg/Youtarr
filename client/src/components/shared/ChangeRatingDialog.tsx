import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import RatingBadge from './RatingBadge';

interface ChangeRatingDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (rating: string | null) => Promise<void>;
  selectedCount: number;
}

const RATING_OPTIONS = [
  'NR',
  'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA',
  'G', 'PG', 'PG-13', 'R', 'NC-17',
];

const ChangeRatingDialog: React.FC<ChangeRatingDialogProps> = ({
  open,
  onClose,
  onApply,
  selectedCount,
}) => {
  const [rating, setRating] = useState('NR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const payloadRating = rating === 'NR' ? null : rating;
      await onApply(payloadRating);
      onClose();
    } catch (err) {
      console.error('Failed to apply rating:', err);
      setError(err instanceof Error ? err.message : 'Failed to update content rating');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Content Rating</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Typography variant="body2" sx={{ mb: 2 }}>
            You are changing the content rating for <strong>{selectedCount}</strong> video{selectedCount !== 1 ? 's' : ''}.
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="change-rating-label">Content Rating</InputLabel>
            <Select
              labelId="change-rating-label"
              id="change-rating-select"
              value={rating}
              label="Content Rating"
              onChange={(e) => setRating(e.target.value)}
              disabled={loading}
            >
              {RATING_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt === 'NR' ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                      Clear Rating
                    </Typography>
                  ) : (
                    <>
                      <RatingBadge rating={opt} size="small" sx={{ mr: 1 }} />
                      {opt}
                    </>
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          color="primary"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangeRatingDialog;
