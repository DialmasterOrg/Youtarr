import React, { useEffect, useState } from 'react';

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

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(event.target.selectedOptions).map((o) => o.value);

    // Ensure at least one language is selected
    if (options.length === 0) {
      setSelectedLanguages(['en']);
      onChange('en');
      return;
    }

    setSelectedLanguages(options);
    onChange(options.join(','));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label
        htmlFor="subtitle-language-select"
        style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 500 }}
      >
        Subtitle Languages
      </label>
      <select
        id="subtitle-language-select"
        multiple
        value={selectedLanguages}
        onChange={handleChange}
        disabled={disabled}
        aria-disabled={disabled ? 'true' : undefined}
        size={5}
        style={{
          width: '100%',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-input)',
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
          padding: '4px',
          fontSize: '0.875rem',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'auto',
        }}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
        Selected: {selectedLanguages.map((code) => {
          const opt = LANGUAGE_OPTIONS.find((o) => o.code === code);
          return opt ? opt.label : code;
        }).join(', ')}
      </span>
    </div>
  );
}

export default SubtitleLanguageSelector;
