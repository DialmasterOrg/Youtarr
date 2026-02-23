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
  CircularProgress,
  Alert,
} from '../ui';
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
        <div style={{ marginTop: 8 }}>
          {error && (
            <Alert severity="error" style={{ marginBottom: 16 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Typography variant="body2" style={{ marginBottom: 16 }}>
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
                    <Typography variant="body2" style={{ color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                      Clear Rating
                    </Typography>
                  ) : (
                    <>
                      <RatingBadge rating={opt} size="small" style={{ marginRight: 8 }} />
                      {opt}
                    </>
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
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
