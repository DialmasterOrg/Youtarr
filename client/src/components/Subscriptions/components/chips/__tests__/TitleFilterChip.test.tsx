import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TitleFilterChip from '../TitleFilterChip';
import { renderWithProviders } from '../../../../../test-utils';

describe('TitleFilterChip', () => {
  test('renders nothing when the title filter regex is null', () => {
    renderWithProviders(
      <TitleFilterChip titleFilterRegex={null} onRegexClick={jest.fn()} isMobile={false} />
    );

    expect(screen.queryByTestId('regex-filter-chip')).not.toBeInTheDocument();
  });

  test('renders nothing when the title filter regex is undefined', () => {
    renderWithProviders(
      <TitleFilterChip titleFilterRegex={undefined} onRegexClick={jest.fn()} isMobile={false} />
    );

    expect(screen.queryByTestId('regex-filter-chip')).not.toBeInTheDocument();
  });

  test('renders a chip with an icon when a regex is provided', () => {
    renderWithProviders(
      <TitleFilterChip titleFilterRegex="^foo" onRegexClick={jest.fn()} isMobile={false} />
    );

    const chip = screen.getByTestId('regex-filter-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('Filters');
    expect(within(chip).getByTestId('HelpOutlineIcon')).toBeInTheDocument();
  });

  test('invokes the click handler with the regex', async () => {
    const onRegexClick = jest.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <TitleFilterChip titleFilterRegex=".*download" onRegexClick={onRegexClick} isMobile={false} />
    );

    await user.click(screen.getByTestId('regex-filter-chip'));

    expect(onRegexClick).toHaveBeenCalledTimes(1);
    expect(onRegexClick).toHaveBeenCalledWith(expect.anything(), '.*download');
  });

  test('renders correctly on mobile', () => {
    renderWithProviders(
      <TitleFilterChip titleFilterRegex="[a-z]+" onRegexClick={jest.fn()} isMobile={true} />
    );

    expect(screen.getByTestId('regex-filter-chip')).toBeInTheDocument();
  });
});
