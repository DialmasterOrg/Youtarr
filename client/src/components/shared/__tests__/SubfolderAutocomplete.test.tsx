import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SubfolderAutocomplete } from '../SubfolderAutocomplete';
import { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } from '../../../utils/channelHelpers';

// Mock AddSubfolderDialog to simplify testing
jest.mock('../AddSubfolderDialog', () => ({
  AddSubfolderDialog: function MockAddSubfolderDialog({
    open,
    onClose,
    onAdd,
  }: {
    open: boolean;
    onClose: () => void;
    onAdd: (name: string) => void;
  }) {
    const React = require('react');
    if (!open) return null;
    return React.createElement('div', { 'data-testid': 'add-subfolder-dialog' },
      React.createElement('button', {
        'data-testid': 'dialog-close',
        onClick: onClose
      }, 'Close'),
      React.createElement('button', {
        'data-testid': 'dialog-add',
        onClick: () => onAdd('NewFolder')
      }, 'Add')
    );
  }
}));

describe('SubfolderAutocomplete', () => {
  const mockOnChange = jest.fn();
  const defaultSubfolders = ['__Sports', '__Music', '__Tech'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Global Mode', () => {
    const globalModeProps = {
      mode: 'global' as const,
      value: null,
      onChange: mockOnChange,
      subfolders: defaultSubfolders,
    };

    test('renders with correct label', () => {
      render(<SubfolderAutocomplete {...globalModeProps} />);
      expect(screen.getByLabelText('Subfolder')).toBeInTheDocument();
    });

    test('renders with custom label', () => {
      render(<SubfolderAutocomplete {...globalModeProps} label="Custom Label" />);
      expect(screen.getByLabelText('Custom Label')).toBeInTheDocument();
    });

    test('shows "No Subfolder (root)" special option when dropdown opened', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...globalModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('No Subfolder (root)')).toBeInTheDocument();
    });

    test('shows existing subfolders with __ prefix', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...globalModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('__Sports')).toBeInTheDocument();
      expect(screen.getByText('__Music')).toBeInTheDocument();
      expect(screen.getByText('__Tech')).toBeInTheDocument();
    });

    test('shows "Add Subfolder" action option', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...globalModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Add Subfolder')).toBeInTheDocument();
    });

    test('displays null value as "No Subfolder (root)"', () => {
      render(<SubfolderAutocomplete {...globalModeProps} value={null} />);

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toHaveValue('No Subfolder (root)');
    });

    test('displays subfolder value with __ prefix', () => {
      render(<SubfolderAutocomplete {...globalModeProps} value="Sports" />);

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toHaveValue('__Sports');
    });

    test('calls onChange with null when "No Subfolder (root)" selected', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...globalModeProps} value="Sports" />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('No Subfolder (root)'));

      expect(mockOnChange).toHaveBeenCalledWith(null);
    });

    test('calls onChange with clean value when subfolder selected', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...globalModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('__Sports'));

      expect(mockOnChange).toHaveBeenCalledWith('Sports');
    });
  });

  describe('Channel Mode', () => {
    const channelModeProps = {
      mode: 'channel' as const,
      value: null,
      onChange: mockOnChange,
      subfolders: defaultSubfolders,
    };

    test('shows "No Subfolder (root)" special option', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...channelModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('No Subfolder (root)')).toBeInTheDocument();
    });

    test('shows "Default Subfolder (root)" when no defaultSubfolderDisplay', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...channelModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Default Subfolder (root)')).toBeInTheDocument();
    });

    test('shows "Default Subfolder (__name)" when defaultSubfolderDisplay provided', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...channelModeProps} defaultSubfolderDisplay="Videos" />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Default Subfolder (__Videos)')).toBeInTheDocument();
    });

    test('calls onChange with GLOBAL_DEFAULT_SENTINEL when default option selected', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...channelModeProps} value={null} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Default Subfolder (root)'));

      expect(mockOnChange).toHaveBeenCalledWith(GLOBAL_DEFAULT_SENTINEL);
    });

    test('displays GLOBAL_DEFAULT_SENTINEL as "Default Subfolder"', () => {
      render(<SubfolderAutocomplete {...channelModeProps} value={GLOBAL_DEFAULT_SENTINEL} />);

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toHaveValue('Default Subfolder (root)');
    });
  });

  describe('Download Mode', () => {
    const downloadModeProps = {
      mode: 'download' as const,
      value: null,
      onChange: mockOnChange,
      subfolders: defaultSubfolders,
    };

    test('shows "No override (use channel settings)" special option', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...downloadModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('No override (use channel settings)')).toBeInTheDocument();
    });

    test('shows "Root directory (no subfolder)" option', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...downloadModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Root directory (no subfolder)')).toBeInTheDocument();
    });

    test('shows "Use Global Default Subfolder" option', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...downloadModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Use Global Default Subfolder')).toBeInTheDocument();
    });

    test('calls onChange with ROOT_SENTINEL when root directory selected', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...downloadModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Root directory (no subfolder)'));

      expect(mockOnChange).toHaveBeenCalledWith(ROOT_SENTINEL);
    });

    test('displays ROOT_SENTINEL as "Root directory (no subfolder)"', () => {
      render(<SubfolderAutocomplete {...downloadModeProps} value={ROOT_SENTINEL} />);

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toHaveValue('Root directory (no subfolder)');
    });

    test('displays null as "No override (use channel settings)"', () => {
      render(<SubfolderAutocomplete {...downloadModeProps} value={null} />);

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toHaveValue('No override (use channel settings)');
    });
  });

  describe('Add Subfolder Dialog', () => {
    test('opens dialog when "Add Subfolder" clicked', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add Subfolder'));

      expect(screen.getByTestId('add-subfolder-dialog')).toBeInTheDocument();
    });

    test('does not change value when "Add Subfolder" clicked', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add Subfolder'));

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    test('closes dialog when close button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add Subfolder'));

      expect(screen.getByTestId('add-subfolder-dialog')).toBeInTheDocument();

      await user.click(screen.getByTestId('dialog-close'));

      expect(screen.queryByTestId('add-subfolder-dialog')).not.toBeInTheDocument();
    });

    test('calls onChange and closes dialog when subfolder added', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add Subfolder'));
      await user.click(screen.getByTestId('dialog-add'));

      expect(mockOnChange).toHaveBeenCalledWith('NewFolder');
      expect(screen.queryByTestId('add-subfolder-dialog')).not.toBeInTheDocument();
    });

    test('newly added subfolder appears in dropdown', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      // Add a new subfolder via dialog
      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add Subfolder'));
      await user.click(screen.getByTestId('dialog-add'));

      // Reopen dropdown and check for the new subfolder
      await user.click(autocomplete);

      expect(screen.getByText('__NewFolder')).toBeInTheDocument();
    });
  });

  describe('State and Props', () => {
    test('disables autocomplete when disabled prop is true', () => {
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
          disabled={true}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toBeDisabled();
    });

    test('accepts loading prop without crashing', () => {
      // MUI Autocomplete handles loading internally with a spinner
      // This test verifies the component accepts and handles the prop correctly
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
          loading={true}
        />
      );

      // Component should render successfully with loading prop
      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toBeInTheDocument();
    });

    test('displays helper text when provided', () => {
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
          helperText="Choose a subfolder"
        />
      );

      expect(screen.getByText('Choose a subfolder')).toBeInTheDocument();
    });

    test('handles empty subfolders array', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={[]}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      // Should still show special options and Add Subfolder
      expect(screen.getByText('No Subfolder (root)')).toBeInTheDocument();
      expect(screen.getByText('Add Subfolder')).toBeInTheDocument();
    });

    test('handles undefined value', () => {
      render(
        <SubfolderAutocomplete
          mode="channel"
          value={undefined}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      // undefined should be treated as null (no subfolder)
      expect(autocomplete).toHaveValue('No Subfolder (root)');
    });

    test('handles custom subfolder value not in list', () => {
      // Custom values not in the list are still rendered with __ prefix
      // This test just verifies the component doesn't crash
      render(
        <SubfolderAutocomplete
          mode="global"
          value="CustomFolder"
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      // The component creates a synthetic option for values not in the list
      expect(autocomplete).toHaveValue('__CustomFolder');
    });
  });

  describe('Option Selection', () => {
    test('can select a subfolder from the list', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="global"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      // Select a subfolder
      await user.click(screen.getByText('__Music'));

      expect(mockOnChange).toHaveBeenCalledWith('Music');
    });
  });
});
