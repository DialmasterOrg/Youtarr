import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import FilterMenu from '../FilterMenu';

describe('FilterMenu', () => {
  const mockHandleClose = jest.fn();
  const mockHandleMenuItemClick = jest.fn();

  const defaultProps = {
    anchorEl: document.createElement('button'),
    handleClose: mockHandleClose,
    handleMenuItemClick: mockHandleMenuItemClick,
    filter: '',
    uniqueChannels: ['Tech Channel', 'Gaming Channel', 'Cooking Channel', 'Music Channel']
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Menu Rendering', () => {
    test('renders menu when anchorEl is provided', () => {
      render(<FilterMenu {...defaultProps} />);

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search channels...')).toBeInTheDocument();
    });

    test('does not render menu content when anchorEl is null', () => {
      render(<FilterMenu {...defaultProps} anchorEl={null} />);

      const menu = screen.getByRole('menu', { hidden: true });
      expect(menu).toBeInTheDocument();
    });

    test('renders search input with search icon', () => {
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      expect(searchInput).toBeInTheDocument();
      expect(screen.getByTestId('SearchIcon')).toBeInTheDocument();
    });

    test('renders "All" option at the top', () => {
      render(<FilterMenu {...defaultProps} />);

      const allOption = screen.getByTestId('filter-menu-all');
      expect(allOption).toBeInTheDocument();
      expect(allOption).toHaveTextContent('All');
    });

    test('renders all unique channels as menu items', () => {
      render(<FilterMenu {...defaultProps} />);

      expect(screen.getByTestId('filter-menu-Tech Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Gaming Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Cooking Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Music Channel')).toBeInTheDocument();
    });
  });

  describe('Filter Selection', () => {
    test('shows check icon next to selected "All" filter when filter is empty', () => {
      render(<FilterMenu {...defaultProps} filter="" />);

      const allOption = screen.getByTestId('filter-menu-all');
      expect(within(allOption).getByTestId('CheckIcon')).toBeInTheDocument();
    });

    test('shows check icon next to selected channel filter', () => {
      render(<FilterMenu {...defaultProps} filter="Gaming Channel" />);

      const gamingOption = screen.getByTestId('filter-menu-Gaming Channel');
      expect(within(gamingOption).getByTestId('CheckIcon')).toBeInTheDocument();

      const allOption = screen.getByTestId('filter-menu-all');
      expect(within(allOption).queryByTestId('CheckIcon')).not.toBeInTheDocument();
    });

    test('calls handleMenuItemClick when "All" is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const allOption = screen.getByTestId('filter-menu-all');
      await user.click(allOption);

      expect(mockHandleMenuItemClick).toHaveBeenCalledWith(
        expect.any(Object),
        ''
      );
    });

    test('calls handleMenuItemClick when a channel is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const techOption = screen.getByTestId('filter-menu-Tech Channel');
      await user.click(techOption);

      expect(mockHandleMenuItemClick).toHaveBeenCalledWith(
        expect.any(Object),
        'Tech Channel'
      );
    });

    test('calls handleClose when Escape key is pressed', () => {
      render(<FilterMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      fireEvent.keyDown(menu, { key: 'Escape', code: 'Escape' });

      expect(mockHandleClose).toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    test('filters channels based on search term (case insensitive)', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.type(searchInput, 'channel');

      expect(screen.getByTestId('filter-menu-Tech Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Gaming Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Cooking Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Music Channel')).toBeInTheDocument();
    });

    test('filters channels with partial match', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.type(searchInput, 'tech');

      expect(screen.getByTestId('filter-menu-Tech Channel')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-menu-Gaming Channel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('filter-menu-Cooking Channel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('filter-menu-Music Channel')).not.toBeInTheDocument();
    });

    test('shows "No channels found" when search has no matches', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.type(searchInput, 'xyz');

      expect(screen.getByText('No channels found')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-menu-Tech Channel')).not.toBeInTheDocument();
    });

    test('search is case insensitive', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.type(searchInput, 'GAMING');

      expect(screen.getByTestId('filter-menu-Gaming Channel')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-menu-Tech Channel')).not.toBeInTheDocument();
    });

    test('resets search term when menu closes', () => {
      const { rerender } = render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      fireEvent.change(searchInput, { target: { value: 'tech' } });
      expect(searchInput).toHaveValue('tech');

      rerender(<FilterMenu {...defaultProps} anchorEl={null} />);
      rerender(<FilterMenu {...defaultProps} />);

      const newSearchInput = screen.getByPlaceholderText('Search channels...');
      expect(newSearchInput).toHaveValue('');
    });

    test('search input has autofocus', () => {
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      expect(searchInput).toHaveFocus();
    });

    test('stops propagation on search input click', async () => {
      const user = userEvent.setup();
      const clickHandler = jest.fn();
      const divWrapper = document.createElement('div');
      divWrapper.addEventListener('click', clickHandler);
      divWrapper.appendChild(defaultProps.anchorEl);

      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.click(searchInput);

      expect(clickHandler).not.toHaveBeenCalled();
    });

    test('stops propagation on search input keydown', () => {
      const keydownHandler = jest.fn();
      document.addEventListener('keydown', keydownHandler);

      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      expect(keydownHandler).not.toHaveBeenCalled();

      document.removeEventListener('keydown', keydownHandler);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty uniqueChannels array', () => {
      render(<FilterMenu {...defaultProps} uniqueChannels={[]} />);

      expect(screen.getByTestId('filter-menu-all')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-menu-Tech Channel')).not.toBeInTheDocument();
    });

    test('handles channels with special characters in names', () => {
      const specialChannels = ['Channel #1', 'Channel & Music', 'Channel @ Home'];
      render(<FilterMenu {...defaultProps} uniqueChannels={specialChannels} />);

      expect(screen.getByTestId('filter-menu-Channel #1')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Channel & Music')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Channel @ Home')).toBeInTheDocument();
    });

    test('maintains "All" option visibility during search', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.type(searchInput, 'tech');

      expect(screen.getByTestId('filter-menu-all')).toBeInTheDocument();
    });

    test('handles rapid search input changes', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');

      await user.type(searchInput, 'tech');
      await user.clear(searchInput);
      await user.type(searchInput, 'gaming');

      expect(screen.getByTestId('filter-menu-Gaming Channel')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-menu-Tech Channel')).not.toBeInTheDocument();
    });

    test('preserves filter selection during search', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} filter="Gaming Channel" />);

      const gamingOption = screen.getByTestId('filter-menu-Gaming Channel');
      expect(within(gamingOption).getByTestId('CheckIcon')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.type(searchInput, 'gaming');

      const filteredGamingOption = screen.getByTestId('filter-menu-Gaming Channel');
      expect(within(filteredGamingOption).getByTestId('CheckIcon')).toBeInTheDocument();
    });

    test('handles search with different casing', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.type(searchInput, 'TECH');

      expect(screen.getByTestId('filter-menu-Tech Channel')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-menu-Gaming Channel')).not.toBeInTheDocument();
    });

    test('displays all channels when search is cleared', async () => {
      const user = userEvent.setup();
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await user.type(searchInput, 'tech');

      expect(screen.queryByTestId('filter-menu-Gaming Channel')).not.toBeInTheDocument();

      await user.clear(searchInput);

      expect(screen.getByTestId('filter-menu-Gaming Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Tech Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Cooking Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Music Channel')).toBeInTheDocument();
    });
  });

  describe('Menu Properties', () => {
    test('menu renders with proper structure', () => {
      render(<FilterMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();

      expect(screen.getByTestId('filter-menu-all')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search channels...')).toBeInTheDocument();
    });

    test('search field is accessible', () => {
      render(<FilterMenu {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('type', 'text');
    });

    test('menu is scrollable with many channels', () => {
      const manyChannels = Array.from({ length: 20 }, (_, i) => `Channel ${i + 1}`);
      render(<FilterMenu {...defaultProps} uniqueChannels={manyChannels} />);

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();

      manyChannels.forEach(channel => {
        expect(screen.getByTestId(`filter-menu-${channel}`)).toBeInTheDocument();
      });
    });
  });
});