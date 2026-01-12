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
  CircularProgress
} from '@mui/material';

interface ChangeRatingDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (rating: string) => Promise<void>;
  selectedCount: number;
}

const RATING_OPTIONS = [
  'NR',
  'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA',
  'G', 'PG', 'PG-13', 'R', 'NC-17'
];

const ChangeRatingDialog: React.FC<ChangeRatingDialogProps> = ({
  open,
  onClose,
  onApply,
  selectedCount,
}) => {
  const [rating, setRating] = useState('NR');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);
    try {
      await onApply(rating);
      onClose();
    } catch (err) {
      console.error('Failed to apply rating:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Content Rating</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            You are changing the content rating for <strong>{selectedCount}</strong> video{selectedCount !== 1 ? 's' : ''}.
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="change-rating-label">Content Rating</InputLabel>
            <Select
              labelId="change-rating-label"
              value={rating}
              label="Content Rating"
              onChange={(e) => setRating(e.target.value)}
              disabled={loading}
            >
              {RATING_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
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
