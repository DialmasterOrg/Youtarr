import React, { useEffect, useState } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  SelectChangeEvent,
} from '@mui/material';

interface SubtitleLanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface LanguageOption {
  code: string;
  label: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'en-orig', label: 'English (Original/Uploaded)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
];

function SubtitleLanguageSelector({
  value,
  onChange,
  disabled = false,
}: SubtitleLanguageSelectorProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  // Convert string value to array when component mounts or value changes
  useEffect(() => {
    if (value && value.trim()) {
      const languages = value.split(',').map((lang) => lang.trim()).filter(Boolean);
      // Filter out invalid codes
      const validLanguages = languages.filter((lang) =>
        LANGUAGE_OPTIONS.some((opt) => opt.code === lang)
      );
      setSelectedLanguages(validLanguages.length > 0 ? validLanguages : ['en']);
    } else {
      setSelectedLanguages(['en']);
    }
  }, [value]);

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const newValue = event.target.value as string[];

    // Ensure at least one language is selected
    if (newValue.length === 0) {
      setSelectedLanguages(['en']);
      onChange('en');
      return;
    }

    setSelectedLanguages(newValue);
    onChange(newValue.join(','));
  };

  const getLanguageLabel = (code: string): string => {
    const option = LANGUAGE_OPTIONS.find((opt) => opt.code === code);
    return option ? option.label : code;
  };

  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel id="subtitle-language-label">Subtitle Languages</InputLabel>
      <Select
        labelId="subtitle-language-label"
        id="subtitle-language-select"
        multiple
        value={selectedLanguages}
        onChange={handleChange}
        label="Subtitle Languages"
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((code) => (
              <Chip
                key={code}
                label={getLanguageLabel(code)}
                size="small"
              />
            ))}
          </Box>
        )}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <MenuItem key={option.code} value={option.code}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default SubtitleLanguageSelector;
