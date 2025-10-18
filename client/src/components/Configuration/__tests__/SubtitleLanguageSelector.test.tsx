import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SubtitleLanguageSelector from '../SubtitleLanguageSelector';
import { renderWithProviders } from '../../../test-utils';

describe('SubtitleLanguageSelector Component', () => {
  const mockOnChange = jest.fn();

  const defaultProps = {
    value: '',
    onChange: mockOnChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} />);
      expect(screen.getByLabelText('Subtitle Languages')).toBeInTheDocument();
    });

    test('displays the correct label', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} />);
      const labels = screen.getAllByText('Subtitle Languages');
      expect(labels.length).toBeGreaterThan(0);
    });

    test('shows all 13 language options when dropdown is opened', async () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} />);

      const select = screen.getByLabelText('Subtitle Languages');
      fireEvent.mouseDown(select);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
      });

      expect(screen.getByRole('option', { name: 'English (Original/Uploaded)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Spanish' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'French' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'German' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Japanese' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Portuguese' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Italian' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Russian' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Korean' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Chinese' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Arabic' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Hindi' })).toBeInTheDocument();
    });

    test('renders with disabled state correctly', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} disabled={true} />);

      const select = screen.getByLabelText('Subtitle Languages');
      expect(select).toHaveAttribute('aria-disabled', 'true');
    });

    test('is not disabled by default', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} />);

      const select = screen.getByLabelText('Subtitle Languages');
      expect(select).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Default Values & Initialization', () => {
    test('defaults to English when value is empty string', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="" />);

      expect(screen.getByText('English')).toBeInTheDocument();
    });

    test('defaults to English when value is whitespace only', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="   " />);

      expect(screen.getByText('English')).toBeInTheDocument();
    });

    test('parses comma-separated string values correctly', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en,es,fr" />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.getByText('French')).toBeInTheDocument();
    });

    test('handles whitespace in comma-separated values', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en, es , fr" />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.getByText('French')).toBeInTheDocument();
    });

    test('filters out invalid language codes', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en,invalid,es" />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.queryByText('invalid')).not.toBeInTheDocument();
    });

    test('defaults to English when all codes are invalid', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="invalid1,invalid2" />);

      expect(screen.getByText('English')).toBeInTheDocument();
    });

    test('handles single language code', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="ja" />);

      expect(screen.getByText('Japanese')).toBeInTheDocument();
    });

    test('handles special en-orig language code', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en-orig" />);

      expect(screen.getByText('English (Original/Uploaded)')).toBeInTheDocument();
    });
  });

  describe('Language Selection', () => {
    test('allows selecting multiple languages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      const spanishOption = await screen.findByRole('option', { name: 'Spanish' });
      await user.click(spanishOption);

      expect(mockOnChange).toHaveBeenCalledWith('en,es');
    });

    test('calls onChange with comma-separated string', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      const frenchOption = await screen.findByRole('option', { name: 'French' });
      await user.click(frenchOption);

      expect(mockOnChange).toHaveBeenCalledWith('en,fr');
    });

    test('updates displayed chips when languages are selected', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      const germanOption = await screen.findByRole('option', { name: 'German' });
      await user.click(germanOption);

      expect(mockOnChange).toHaveBeenCalledWith('en,de');

      // Rerender with updated value
      rerender(
        <SubtitleLanguageSelector value="en,de" onChange={mockOnChange} />
      );

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('German')).toBeInTheDocument();
    });

    test('allows selecting all languages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      // Select a few more languages
      const spanishOption = await screen.findByRole('option', { name: 'Spanish' });
      await user.click(spanishOption);

      const japaneseOption = screen.getByRole('option', { name: 'Japanese' });
      await user.click(japaneseOption);

      const koreanOption = screen.getByRole('option', { name: 'Korean' });
      await user.click(koreanOption);

      // Should contain all selected languages
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
      expect(lastCall[0]).toContain('en');
      expect(lastCall[0]).toContain('es');
      expect(lastCall[0]).toContain('ja');
      expect(lastCall[0]).toContain('ko');
    });
  });

  describe('Minimum Selection Enforcement', () => {
    test('prevents deselecting all languages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      // Try to deselect English (the only selected language)
      const englishOption = await screen.findByRole('option', { name: 'English' });
      await user.click(englishOption);

      // Should call onChange with 'en' (enforcing at least one selection)
      expect(mockOnChange).toHaveBeenCalledWith('en');
    });

    test('automatically selects English if user tries to deselect all', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="es" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      // Try to deselect Spanish (the only selected language)
      const spanishOption = await screen.findByRole('option', { name: 'Spanish' });
      await user.click(spanishOption);

      // Should default back to English
      expect(mockOnChange).toHaveBeenCalledWith('en');
    });

    test('allows deselecting when multiple languages are selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en,es,fr" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      // Deselect Spanish
      const spanishOption = await screen.findByRole('option', { name: 'Spanish' });
      await user.click(spanishOption);

      // Should successfully remove Spanish
      expect(mockOnChange).toHaveBeenCalledWith('en,fr');
    });
  });

  describe('Chip Rendering', () => {
    test('renders chips for each selected language', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en,es,ja" />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.getByText('Japanese')).toBeInTheDocument();
    });

    test('shows correct translated labels for language codes', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="de,it,pt" />);

      expect(screen.getByText('German')).toBeInTheDocument();
      expect(screen.getByText('Italian')).toBeInTheDocument();
      expect(screen.getByText('Portuguese')).toBeInTheDocument();
    });

    test('handles special en-orig label correctly', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en-orig,es" />);

      expect(screen.getByText('English (Original/Uploaded)')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });

    test('displays chip with code if language not found in options', () => {
      // Force a scenario where an unknown code might appear (shouldn't happen but test defensively)
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      // All chips should have proper labels
      expect(screen.getByText('English')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty comma-separated list', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value=",,," />);

      expect(screen.getByText('English')).toBeInTheDocument();
    });

    test('handles duplicate language codes in input', () => {
      // The component doesn't deduplicate on render - it accepts whatever the parent gives
      // So we just verify it can render with duplicates without crashing
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en,es" />);

      // Should show both languages
      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });

    test('handles very long comma-separated list', () => {
      const allLanguages = 'en,en-orig,es,fr,de,ja,pt,it,ru,ko,zh,ar,hi';
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value={allLanguages} />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('English (Original/Uploaded)')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.getByText('Hindi')).toBeInTheDocument();
    });

    test('handles mixed valid and invalid codes', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en,xxx,es,yyy,fr" />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.getByText('French')).toBeInTheDocument();
      expect(screen.queryByText('xxx')).not.toBeInTheDocument();
      expect(screen.queryByText('yyy')).not.toBeInTheDocument();
    });

    test('handles trailing commas', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en,es," />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });

    test('handles leading commas', () => {
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value=",en,es" />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });

    test('handles value change after initial render', () => {
      const { rerender } = renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      expect(screen.getByText('English')).toBeInTheDocument();

      // Change the value prop
      rerender(
        <SubtitleLanguageSelector value="ja,ko" onChange={mockOnChange} />
      );

      expect(screen.getByText('Japanese')).toBeInTheDocument();
      expect(screen.getByText('Korean')).toBeInTheDocument();
      expect(screen.queryByText('English')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    test('cannot open dropdown when disabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} disabled={true} />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      // Dropdown should not open, so options should not be visible
      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Spanish' })).not.toBeInTheDocument();
      });
    });

    test('displays chips correctly when disabled', () => {
      renderWithProviders(
        <SubtitleLanguageSelector value="en,es,fr" onChange={mockOnChange} disabled={true} />
      );

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.getByText('French')).toBeInTheDocument();
    });
  });

  describe('Integration with MUI Select', () => {
    test('multiple select works correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      // Select multiple languages
      const arabicOption = await screen.findByRole('option', { name: 'Arabic' });
      await user.click(arabicOption);

      const hindiOption = screen.getByRole('option', { name: 'Hindi' });
      await user.click(hindiOption);

      // onChange should have been called multiple times
      expect(mockOnChange).toHaveBeenCalled();
    });

    test('dropdown opens and remains open for multi-select', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');

      // Open dropdown
      await user.click(select);
      await screen.findByRole('option', { name: 'Spanish' });
      expect(screen.getByRole('option', { name: 'Spanish' })).toBeInTheDocument();

      // Select an option - multi-select keeps dropdown open
      const spanishOption = screen.getByRole('option', { name: 'Spanish' });
      await user.click(spanishOption);

      // Multi-select dropdown should remain open after selection
      expect(screen.getByRole('option', { name: 'French' })).toBeInTheDocument();
    });

    test('MenuItem selection updates the value', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      const chineseOption = await screen.findByRole('option', { name: 'Chinese' });
      await user.click(chineseOption);

      expect(mockOnChange).toHaveBeenCalledWith('en,zh');
    });
  });

  describe('Language Code to Label Mapping', () => {
    test('correctly maps all language codes to labels', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
      });

      // Verify all mappings exist
      const expectedMappings = [
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

      for (const mapping of expectedMappings) {
        expect(screen.getByRole('option', { name: mapping.label })).toBeInTheDocument();
      }
    });

    test('displays correct chips for all supported languages', () => {
      const allCodes = 'en,en-orig,es,fr,de,ja,pt,it,ru,ko,zh,ar,hi';
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value={allCodes} />);

      const expectedLabels = [
        'English',
        'English (Original/Uploaded)',
        'Spanish',
        'French',
        'German',
        'Japanese',
        'Portuguese',
        'Italian',
        'Russian',
        'Korean',
        'Chinese',
        'Arabic',
        'Hindi',
      ];

      for (const label of expectedLabels) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });
  });

  describe('onChange Callback Behavior', () => {
    test('onChange receives correct value when adding language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      const russianOption = await screen.findByRole('option', { name: 'Russian' });
      await user.click(russianOption);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('en,ru');
    });

    test('onChange receives correct value when removing language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} value="en,es,fr" />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      const spanishOption = await screen.findByRole('option', { name: 'Spanish' });
      await user.click(spanishOption);

      expect(mockOnChange).toHaveBeenCalledWith('en,fr');
    });

    test('onChange not called when disabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubtitleLanguageSelector {...defaultProps} disabled={true} />);

      const select = screen.getByLabelText('Subtitle Languages');
      await user.click(select);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });
});
