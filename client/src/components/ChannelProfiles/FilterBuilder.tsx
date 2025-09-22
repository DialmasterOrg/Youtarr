import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Typography,
  Alert,
  Chip,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { ProfileFilter } from '../../types/ChannelProfile';

interface FilterBuilderProps {
  filters: ProfileFilter[];
  onChange: (filters: ProfileFilter[]) => void;
  error?: string;
}

const FilterBuilder: React.FC<FilterBuilderProps> = ({
  filters,
  onChange,
  error,
}) => {
  const [newFilter, setNewFilter] = useState<Partial<ProfileFilter>>({
    filter_type: 'title_contains',
    filter_value: '',
    priority: filters.length,
  });

  const [regexValidation, setRegexValidation] = useState<Record<number, string>>({});

  const handleAddFilter = () => {
    if (!newFilter.filter_value?.trim()) return;

    const filter: ProfileFilter = {
      filter_type: newFilter.filter_type as ProfileFilter['filter_type'],
      filter_value: newFilter.filter_value.trim(),
      priority: filters.length,
    };

    onChange([...filters, filter]);
    setNewFilter({
      filter_type: 'title_contains',
      filter_value: '',
      priority: filters.length + 1,
    });
  };

  const handleRemoveFilter = (index: number) => {
    const updatedFilters = filters.filter((_, i) => i !== index);
    // Reorder priorities
    const reorderedFilters = updatedFilters.map((filter, i) => ({
      ...filter,
      priority: i,
    }));
    onChange(reorderedFilters);
  };

  const handleFilterChange = (index: number, field: keyof ProfileFilter, value: any) => {
    const updatedFilters = [...filters];
    updatedFilters[index] = {
      ...updatedFilters[index],
      [field]: value,
    };

    // Validate regex if it's a regex filter
    if (field === 'filter_value' && updatedFilters[index].filter_type === 'title_regex') {
      validateRegex(index, value);
    }

    onChange(updatedFilters);
  };

  const validateRegex = (index: number, pattern: string) => {
    try {
      new RegExp(pattern, 'i');
      setRegexValidation(prev => {
        const newValidation = { ...prev };
        delete newValidation[index];
        return newValidation;
      });
    } catch (error) {
      setRegexValidation(prev => ({
        ...prev,
        [index]: 'Invalid regex pattern',
      }));
    }
  };

  const moveFilter = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= filters.length) return;

    const updatedFilters = [...filters];
    const [movedFilter] = updatedFilters.splice(fromIndex, 1);
    updatedFilters.splice(toIndex, 0, movedFilter);

    // Reorder priorities
    const reorderedFilters = updatedFilters.map((filter, i) => ({
      ...filter,
      priority: i,
    }));

    onChange(reorderedFilters);
  };

  const getFilterTypeLabel = (type: ProfileFilter['filter_type']) => {
    switch (type) {
      case 'title_regex':
        return 'Title Regex';
      case 'title_contains':
        return 'Title Contains';
      case 'duration_range':
        return 'Duration Range';
      default:
        return type;
    }
  };

  const getFilterHelperText = (type: ProfileFilter['filter_type']) => {
    switch (type) {
      case 'title_regex':
        return 'Regular expression pattern (e.g., "Episode \\d+:")';
      case 'title_contains':
        return 'Text that must be in the title (e.g., "Tutorial")';
      case 'duration_range':
        return 'Duration range in seconds (e.g., "300-1800" for 5-30 minutes)';
      default:
        return '';
    }
  };

  const validateDurationRange = (value: string): boolean => {
    if (!value.includes('-')) return false;
    const [min, max] = value.split('-').map(Number);
    return !isNaN(min) && !isNaN(max) && min >= 0 && max > min;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Existing Filters */}
      {filters.map((filter, index) => (
        <Card key={index} variant="outlined">
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  size="small"
                  onClick={() => moveFilter(index, index - 1)}
                  disabled={index === 0}
                >
                  ↑
                </IconButton>
                <DragIcon color="disabled" />
                <IconButton
                  size="small"
                  onClick={() => moveFilter(index, index + 1)}
                  disabled={index === filters.length - 1}
                >
                  ↓
                </IconButton>
              </Box>

              <Chip
                label={`Priority ${index + 1}`}
                size="small"
                variant="outlined"
              />

              <FormControl sx={{ minWidth: 150 }}>
                <Select
                  value={filter.filter_type}
                  onChange={(e) => handleFilterChange(index, 'filter_type', e.target.value)}
                  size="small"
                >
                  <MenuItem value="title_contains">Title Contains</MenuItem>
                  <MenuItem value="title_regex">Title Regex</MenuItem>
                  <MenuItem value="duration_range">Duration Range</MenuItem>
                </Select>
              </FormControl>

              <TextField
                value={filter.filter_value}
                onChange={(e) => handleFilterChange(index, 'filter_value', e.target.value)}
                placeholder={getFilterHelperText(filter.filter_type)}
                error={Boolean(regexValidation[index]) || Boolean(
                  filter.filter_type === 'duration_range' &&
                  filter.filter_value &&
                  !validateDurationRange(filter.filter_value)
                )}
                helperText={regexValidation[index] ||
                           (filter.filter_type === 'duration_range' &&
                            filter.filter_value && !validateDurationRange(filter.filter_value) ?
                            'Invalid format. Use "min-max" (e.g., "300-1800")' : '')}
                sx={{ flex: 1 }}
                size="small"
              />

              <IconButton
                onClick={() => handleRemoveFilter(index)}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>

            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              {getFilterTypeLabel(filter.filter_type)}: {getFilterHelperText(filter.filter_type)}
            </Typography>
          </CardContent>
        </Card>
      ))}

      {/* Add New Filter */}
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Add New Filter
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Filter Type</InputLabel>
            <Select
              value={newFilter.filter_type || 'title_contains'}
              onChange={(e) => setNewFilter({ ...newFilter, filter_type: e.target.value as ProfileFilter['filter_type'] })}
              label="Filter Type"
              size="small"
            >
              <MenuItem value="title_contains">Title Contains</MenuItem>
              <MenuItem value="title_regex">Title Regex</MenuItem>
              <MenuItem value="duration_range">Duration Range</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Filter Value"
            value={newFilter.filter_value || ''}
            onChange={(e) => setNewFilter({ ...newFilter, filter_value: e.target.value })}
            placeholder={getFilterHelperText(newFilter.filter_type as ProfileFilter['filter_type'])}
            sx={{ flex: 1 }}
            size="small"
          />

          <Button
            onClick={handleAddFilter}
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!newFilter.filter_value?.trim()}
          >
            Add
          </Button>
        </Box>

        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          {getFilterHelperText(newFilter.filter_type as ProfileFilter['filter_type'])}
        </Typography>
      </Paper>

      {/* Help Section */}
      <Alert severity="info" icon={<HelpIcon />}>
        <Typography variant="body2">
          <strong>Filter Evaluation:</strong> All filters must match for a video to be assigned to this profile.
          Filters are evaluated in priority order (top to bottom).
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" component="div">
            <strong>Examples:</strong>
          </Typography>
          <Typography variant="caption" component="div">
            • <strong>Title Contains:</strong> "Python Tutorial" → matches "Python Tutorial: Variables"
          </Typography>
          <Typography variant="caption" component="div">
            • <strong>Title Regex:</strong> "Episode \d+:" → matches "Episode 5: Advanced Topics"
          </Typography>
          <Typography variant="caption" component="div">
            • <strong>Duration Range:</strong> "300-1800" → matches videos between 5-30 minutes
          </Typography>
        </Box>
      </Alert>
    </Box>
  );
};

export default FilterBuilder;