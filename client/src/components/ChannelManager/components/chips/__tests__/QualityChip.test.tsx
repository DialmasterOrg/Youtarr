import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import QualityChip from '../QualityChip';
import { renderWithProviders } from '../../../../../test-utils';
import { within } from '@testing-library/react';

describe('QualityChip', () => {
  test('renders global preferred resolution when no override is provided', () => {
    renderWithProviders(
      <QualityChip videoQuality={null} globalPreferredResolution="1080" />
    );

    const chip = screen.getByTestId('quality-chip');

    expect(chip).toHaveTextContent('1080p');
    expect(chip).toHaveAttribute('data-override', 'false');
    expect(within(chip).queryByTestId('SettingsIcon')).not.toBeInTheDocument();
  });

  test('shows override indicator when channel quality is set', () => {
    renderWithProviders(
      <QualityChip videoQuality="720" globalPreferredResolution="1080" />
    );

    const chip = screen.getByTestId('quality-chip');
    const icon = within(chip).getByTestId('SettingsIcon');

    expect(chip).toHaveTextContent('720p');
    expect(chip).toHaveAttribute('data-override', 'true');
    expect(icon).toBeInTheDocument();
  });

  test('falls back to the global preferred resolution when channel quality is empty', () => {
    renderWithProviders(
      <QualityChip videoQuality="" globalPreferredResolution="1440" />
    );

    const chip = screen.getByTestId('quality-chip');

    expect(chip).toHaveTextContent('1440p');
    expect(chip).toHaveAttribute('data-override', 'false');
    expect(within(chip).queryByTestId('SettingsIcon')).not.toBeInTheDocument();
  });
});
