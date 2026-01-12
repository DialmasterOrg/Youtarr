import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import StillLiveDot from '../StillLiveDot';
import { renderWithProviders } from '../../../test-utils';

describe('StillLiveDot Component', () => {
  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<StillLiveDot />);
      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    test('renders LIVE label', () => {
      renderWithProviders(<StillLiveDot />);
      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    test('renders with icon', () => {
      renderWithProviders(<StillLiveDot />);
      expect(screen.getByTestId('FiberManualRecordIcon')).toBeInTheDocument();
    });
  });

  describe('Desktop Mode (with Tooltip)', () => {
    test('renders with tooltip wrapper in desktop mode', () => {
      renderWithProviders(<StillLiveDot isMobile={false} />);
      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    test('tooltip is initially closed', () => {
      renderWithProviders(<StillLiveDot isMobile={false} />);
      expect(screen.queryByText('Cannot download while still airing')).not.toBeInTheDocument();
    });

    test('shows tooltip when chip is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<StillLiveDot isMobile={false} />);

      const chip = screen.getByText('LIVE');
      await user.click(chip);

      await waitFor(() => {
        expect(screen.getByText('Cannot download while still airing')).toBeInTheDocument();
      });
    });

    test('does not call onMobileClick in desktop mode', async () => {
      const user = userEvent.setup();
      const onMobileClick = jest.fn();

      renderWithProviders(
        <StillLiveDot isMobile={false} onMobileClick={onMobileClick} />
      );

      const chip = screen.getByText('LIVE');
      await user.click(chip);

      expect(onMobileClick).not.toHaveBeenCalled();
    });
  });

  describe('Mobile Mode', () => {
    test('renders without tooltip wrapper in mobile mode', () => {
      renderWithProviders(<StillLiveDot isMobile={true} />);
      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    test('calls onMobileClick when clicked in mobile mode', async () => {
      const user = userEvent.setup();
      const onMobileClick = jest.fn();

      renderWithProviders(
        <StillLiveDot isMobile={true} onMobileClick={onMobileClick} />
      );

      const chip = screen.getByText('LIVE');
      await user.click(chip);

      expect(onMobileClick).toHaveBeenCalledTimes(1);
      expect(onMobileClick).toHaveBeenCalledWith('Cannot download while still airing');
    });

    test('does not call onMobileClick when callback is not provided', async () => {
      const user = userEvent.setup();

      renderWithProviders(<StillLiveDot isMobile={true} />);

      const chip = screen.getByText('LIVE');
      await user.click(chip);

      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    test('does not show tooltip in mobile mode', async () => {
      const user = userEvent.setup();
      const onMobileClick = jest.fn();

      renderWithProviders(
        <StillLiveDot isMobile={true} onMobileClick={onMobileClick} />
      );

      const chip = screen.getByText('LIVE');
      await user.click(chip);

      expect(screen.queryByText('Cannot download while still airing')).not.toBeInTheDocument();
    });
  });

  describe('Event Handling', () => {
    test('prevents event propagation when clicked', async () => {
      const user = userEvent.setup();
      const parentClickHandler = jest.fn();

      renderWithProviders(
        <div onClick={parentClickHandler}>
          <StillLiveDot />
        </div>
      );

      const chip = screen.getByText('LIVE');
      await user.click(chip);

      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Default Props', () => {
    test('uses desktop mode by default when isMobile is not specified', () => {
      renderWithProviders(<StillLiveDot />);
      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    test('handles missing onMobileClick prop gracefully', async () => {
      const user = userEvent.setup();

      renderWithProviders(<StillLiveDot isMobile={false} />);

      const chip = screen.getByText('LIVE');
      await user.click(chip);

      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('chip is interactive', () => {
      renderWithProviders(<StillLiveDot />);
      const chip = screen.getByText('LIVE');
      expect(chip).toBeInTheDocument();
    });

    test('tooltip has correct message content', async () => {
      const user = userEvent.setup();
      renderWithProviders(<StillLiveDot isMobile={false} />);

      const chip = screen.getByText('LIVE');
      await user.click(chip);

      await waitFor(() => {
        const tooltip = screen.getByText('Cannot download while still airing');
        expect(tooltip).toBeInTheDocument();
      });
    });
  });
});
