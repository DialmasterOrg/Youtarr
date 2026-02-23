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
  const parseInitialLanguages = React.useCallback((rawValue: string) => {
    if (rawValue && rawValue.trim()) {
      const languages = rawValue.split(',').map((lang) => lang.trim()).filter(Boolean);
      const validLanguages = languages.filter((lang) =>
        LANGUAGE_OPTIONS.some((opt) => opt.code === lang)
      );
      return validLanguages.length > 0 ? validLanguages : ['en'];
    }
    return ['en'];
  }, []);

  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(() => parseInitialLanguages(value));
  const [open, setOpen] = useState(false);

  // Convert string value to array when component mounts or value changes
  useEffect(() => {
    setSelectedLanguages(parseInitialLanguages(value));
  }, [value, parseInitialLanguages]);

  const handleToggleLanguage = (code: string) => {
    if (disabled) return;
    const isSelected = selectedLanguages.includes(code);

    if (isSelected) {
      const next = selectedLanguages.filter((lang) => lang !== code);
      if (next.length === 0) {
        setSelectedLanguages(['en']);
        onChange('en');
        return;
      }
      setSelectedLanguages(next);
      onChange(next.join(','));
      return;
    }

    const next = [...selectedLanguages, code];
    setSelectedLanguages(next);
    onChange(next.join(','));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label
        htmlFor="subtitle-language-select"
        style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 500 }}
      >
        Subtitle Languages
      </label>
      <button
        id="subtitle-language-select"
        type="button"
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        disabled={disabled}
        aria-disabled={disabled ? 'true' : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Subtitle Languages"
        style={{
          width: '100%',
          textAlign: 'left',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-input)',
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
          padding: '8px',
          fontSize: '0.875rem',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'auto',
        }}
      >
        {selectedLanguages
          .map((code) => LANGUAGE_OPTIONS.find((o) => o.code === code)?.label || code)
          .join(', ')}
      </button>
      {open && !disabled && (
        <div role="listbox" aria-label="Subtitle Languages options" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: 4, maxHeight: 220, overflowY: 'auto' }}>
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = selectedLanguages.includes(option.code);
            return (
              <div
                key={option.code}
                role="option"
                aria-selected={selected}
                onClick={() => handleToggleLanguage(option.code)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selected ? 'var(--muted)' : 'transparent',
                }}
              >
                {option.label}
              </div>
            );
          })}
        </div>
      )}
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
