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
} from '@mui/material';
import { RATING_OPTIONS } from '../../utils/ratings';

interface ChangeRatingDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (rating: string) => void;
  selectedCount: number;
}

const ChangeRatingDialog: React.FC<ChangeRatingDialogProps> = ({
  open,
  onClose,
  onApply,
  selectedCount,
}) => {
  const [selectedRating, setSelectedRating] = useState('NR');

  const ratingOptions = RATING_OPTIONS.filter(option => option.value !== '');

  const handleApply = () => {
    onApply(selectedRating);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Update Content Rating</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Apply a content rating to {selectedCount} selected video{selectedCount === 1 ? '' : 's'}.
          </Typography>
        </Box>

        <FormControl fullWidth>
          <InputLabel>Content Rating</InputLabel>
          <Select
            value={selectedRating}
            label="Content Rating"
            onChange={(event) => setSelectedRating(event.target.value)}
          >
            {ratingOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleApply} variant="contained" disabled={selectedCount === 0}>
          Apply Rating
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangeRatingDialog;
