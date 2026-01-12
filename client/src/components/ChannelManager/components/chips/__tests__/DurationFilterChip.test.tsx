import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DurationFilterChip from '../DurationFilterChip';
import { renderWithProviders } from '../../../../../test-utils';

describe('DurationFilterChip', () => {
  test('renders nothing when no duration filters are provided', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={null} maxDuration={null} isMobile={false} />
    );

    const chip = screen.queryByText(/m$/);
    expect(chip).not.toBeInTheDocument();
  });

  test('renders nothing when both durations are undefined', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={undefined} maxDuration={undefined} isMobile={false} />
    );

    const chip = screen.queryByText(/m$/);
    expect(chip).not.toBeInTheDocument();
  });

  test('renders nothing when both durations are zero', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={0} maxDuration={0} isMobile={false} />
    );

    const chip = screen.queryByText(/m$/);
    expect(chip).not.toBeInTheDocument();
  });

  test('renders chip with min duration only', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={300} maxDuration={null} isMobile={false} />
    );

    const chip = screen.getByText('≥5m');
    expect(chip).toBeInTheDocument();
  });

  test('renders chip with max duration only', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={null} maxDuration={600} isMobile={false} />
    );

    const chip = screen.getByText('≤10m');
    expect(chip).toBeInTheDocument();
  });

  test('renders chip with both min and max duration', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={300} maxDuration={900} isMobile={false} />
    );

    const chip = screen.getByText('5-15m');
    expect(chip).toBeInTheDocument();
  });

  test('converts seconds to minutes correctly', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={120} maxDuration={3600} isMobile={false} />
    );

    const chip = screen.getByText('2-60m');
    expect(chip).toBeInTheDocument();
  });

  test('floors fractional minutes when converting from seconds', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={90} maxDuration={150} isMobile={false} />
    );

    // 90 seconds = 1.5 minutes (floors to 1)
    // 150 seconds = 2.5 minutes (floors to 2)
    const chip = screen.getByText('1-2m');
    expect(chip).toBeInTheDocument();
  });

  test('renders AccessTime icon', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={300} maxDuration={null} isMobile={false} />
    );

    const icon = screen.getByTestId('AccessTimeIcon');
    expect(icon).toBeInTheDocument();
  });

  test('displays tooltip with duration filter description for min only', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={600} maxDuration={null} isMobile={false} />
    );

    const chipContainer = screen.getByLabelText('Channel download duration filter: ≥10m');
    expect(chipContainer).toBeInTheDocument();
  });

  test('displays tooltip with duration filter description for max only', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={null} maxDuration={1200} isMobile={false} />
    );

    const chipContainer = screen.getByLabelText('Channel download duration filter: ≤20m');
    expect(chipContainer).toBeInTheDocument();
  });

  test('displays tooltip with duration filter description for range', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={180} maxDuration={600} isMobile={false} />
    );

    const chipContainer = screen.getByLabelText('Channel download duration filter: 3-10m');
    expect(chipContainer).toBeInTheDocument();
  });

  test('works correctly on mobile', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={300} maxDuration={900} isMobile={true} />
    );

    const chip = screen.getByText('5-15m');
    expect(chip).toBeInTheDocument();
  });

  test('handles edge case with very large duration values', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={86400} maxDuration={172800} isMobile={false} />
    );

    // 86400 seconds = 1440 minutes (24 hours)
    // 172800 seconds = 2880 minutes (48 hours)
    const chip = screen.getByText('1440-2880m');
    expect(chip).toBeInTheDocument();
  });

  test('renders chip with small size variant', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={300} maxDuration={null} isMobile={false} />
    );

    const chipContainer = screen.getByLabelText('Channel download duration filter: ≥5m');
    expect(chipContainer).toHaveClass('MuiChip-sizeSmall');
  });

  test('renders chip with outlined variant', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={300} maxDuration={null} isMobile={false} />
    );

    const chipContainer = screen.getByLabelText('Channel download duration filter: ≥5m');
    expect(chipContainer).toHaveClass('MuiChip-outlined');
  });

  test('renders chip with primary color', () => {
    renderWithProviders(
      <DurationFilterChip minDuration={300} maxDuration={null} isMobile={false} />
    );

    const chipContainer = screen.getByLabelText('Channel download duration filter: ≥5m');
    expect(chipContainer).toHaveClass('MuiChip-colorPrimary');
  });
});
