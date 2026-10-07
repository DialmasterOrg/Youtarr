import React from 'react';
import { render as rtlRender, screen, within, fireEvent, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SubfolderAutocomplete } from '../SubfolderAutocomplete';
import { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } from '../../../utils/channelHelpers';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

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
    const [inputValue, setInputValue] = React.useState('');
    if (!open) return null;
    return React.createElement('div', { 'data-testid': 'add-subfolder-dialog' },
      React.createElement('label', { htmlFor: 'subfolder-name-input' }, 'Library folder name'),
      React.createElement('input', {
        id: 'subfolder-name-input',
        value: inputValue,
        onChange: (e: { target: { value: string } }) => setInputValue(e.target.value),
      }),
      React.createElement('button', {
        'data-testid': 'dialog-close',
        onClick: onClose,
      }, 'Close'),
      React.createElement('button', {
        'data-testid': 'dialog-add',
        onClick: () => onAdd(inputValue || 'NewFolder'),
      }, 'Add library folder'),
    );
  }
}));

describe('SubfolderAutocomplete', () => {
  const mockOnChange = jest.fn();
  const defaultSubfolders = ['__Sports', '__Music', '__Tech'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('links to Library folders', () => {
    render(<SubfolderAutocomplete mode="channel" value={null} onChange={mockOnChange} subfolders={defaultSubfolders} />);
    const link = screen.getByRole('link', { name: 'Manage library folders (opens in a new tab)' });
    expect(link).toHaveAttribute('href', '/settings/library');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  describe('Channel Mode', () => {
    const channelModeProps = {
      mode: 'channel' as const,
      value: null,
      onChange: mockOnChange,
      subfolders: defaultSubfolders,
    };

    test('shows "Main folder" special option', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...channelModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(within(screen.getByRole('listbox')).getByText('Main folder')).toBeInTheDocument();
    });

    test('shows "Default folder (main folder)" when no defaultSubfolderDisplay', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...channelModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Default folder (main folder)')).toBeInTheDocument();
    });

    test('shows "Default folder (__name)" when defaultSubfolderDisplay provided', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...channelModeProps} defaultSubfolderDisplay="Videos" />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Default folder (__Videos)')).toBeInTheDocument();
    });

    test('calls onChange with GLOBAL_DEFAULT_SENTINEL when default option selected', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...channelModeProps} value={null} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Default folder (main folder)'));

      expect(mockOnChange).toHaveBeenCalledWith(GLOBAL_DEFAULT_SENTINEL);
    });

    test('displays GLOBAL_DEFAULT_SENTINEL as "Default Subfolder"', () => {
      render(<SubfolderAutocomplete {...channelModeProps} value={GLOBAL_DEFAULT_SENTINEL} />);

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toHaveValue('Default folder (main folder)');
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

      expect(within(screen.getByRole('listbox')).getByText('No override (use channel settings)')).toBeInTheDocument();
    });

    test('shows "Main folder" option', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...downloadModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Main folder')).toBeInTheDocument();
    });

    test('shows "Use the default folder" option', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...downloadModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      expect(screen.getByText('Use the default folder')).toBeInTheDocument();
    });

    test('calls onChange with ROOT_SENTINEL when root directory selected', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete {...downloadModeProps} />);

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Main folder'));

      expect(mockOnChange).toHaveBeenCalledWith(ROOT_SENTINEL);
    });

    test('displays ROOT_SENTINEL as "Main folder"', () => {
      render(<SubfolderAutocomplete {...downloadModeProps} value={ROOT_SENTINEL} />);

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toHaveValue('Main folder');
    });

    test('displays null as "No override (use channel settings)"', () => {
      render(<SubfolderAutocomplete {...downloadModeProps} value={null} />);

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toHaveValue('No override (use channel settings)');
    });
  });

  describe('Add library folder dialog', () => {
    test('opens dialog when "Add library folder" clicked', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="channel"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add library folder'));

      expect(screen.getByTestId('add-subfolder-dialog')).toBeInTheDocument();
    });

    test('does not change value when "Add library folder" clicked', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="channel"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add library folder'));

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    test('closes dialog when close button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="channel"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add library folder'));

      expect(screen.getByTestId('add-subfolder-dialog')).toBeInTheDocument();

      await user.click(screen.getByTestId('dialog-close'));

      expect(screen.queryByTestId('add-subfolder-dialog')).not.toBeInTheDocument();
    });

    test('calls onChange with the new name and closes dialog when library folder added', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="channel"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add library folder'));
      await user.click(screen.getByTestId('dialog-add'));

      expect(mockOnChange).toHaveBeenCalledWith('NewFolder');
      expect(screen.queryByTestId('add-subfolder-dialog')).not.toBeInTheDocument();
    });

    test('newly added subfolder appears in dropdown', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="channel"
          value={null}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
        />
      );

      // Add a new library folder via dialog
      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);
      await user.click(screen.getByText('Add library folder'));
      await user.click(screen.getByTestId('dialog-add'));

      // Reopen dropdown and check for the new library folder
      await user.click(autocomplete);

      expect(screen.getByText('__NewFolder')).toBeInTheDocument();
    });

    test('persists a newly added subfolder via createSubfolder when provided', async () => {
      const onChange = jest.fn();
      const createSubfolder = jest.fn().mockResolvedValue(undefined);
      render(
        <SubfolderAutocomplete
          mode="channel"
          value={null}
          onChange={onChange}
          subfolders={[]}
          createSubfolder={createSubfolder}
        />
      );

      fireEvent.click(screen.getByText('Add library folder'));
      fireEvent.change(screen.getByLabelText('Library folder name'), { target: { value: 'Sports' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add library folder' }));

      await waitFor(() => expect(createSubfolder).toHaveBeenCalledWith('Sports'));
      expect(onChange).toHaveBeenCalledWith('Sports');
    });
  });

  describe('State and Props', () => {
    test('disables autocomplete when disabled prop is true', () => {
      render(
        <SubfolderAutocomplete
          mode="channel"
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
      // Verify the component accepts and handles the loading prop correctly
      render(
        <SubfolderAutocomplete
          mode="channel"
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
          mode="channel"
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
          mode="channel"
          value={null}
          onChange={mockOnChange}
          subfolders={[]}
        />
      );

      const autocomplete = screen.getByRole('combobox');
      await user.click(autocomplete);

      // Should still show special options and Add library folder
      expect(within(screen.getByRole('listbox')).getByText('Main folder')).toBeInTheDocument();
      expect(screen.getByText('Add library folder')).toBeInTheDocument();
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
      expect(autocomplete).toHaveValue('Main folder');
    });

    test('handles custom subfolder value not in list', () => {
      // Custom values not in the list are still rendered with __ prefix
      // This test just verifies the component doesn't crash
      render(
        <SubfolderAutocomplete
          mode="channel"
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
          mode="channel"
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

  describe('folder layouts', () => {
    const layoutOf = (folder: string) => (folder === 'Sports' || folder === '' ? 'tv' : 'videos') as 'tv' | 'videos';

    test('labels TV subfolders', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete mode="channel" value={null} onChange={mockOnChange} subfolders={defaultSubfolders} layoutOf={layoutOf} />);

      await user.click(screen.getByRole('combobox'));

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('__Sports (TV)')).toBeInTheDocument();
      expect(within(listbox).getByText('__Music')).toBeInTheDocument();
    });

    test('labels the default subfolder by its layout', async () => {
      const user = userEvent.setup();
      render(
        <SubfolderAutocomplete
          mode="channel"
          value={GLOBAL_DEFAULT_SENTINEL}
          onChange={mockOnChange}
          subfolders={defaultSubfolders}
          defaultSubfolderDisplay="Sports"
          layoutOf={layoutOf}
        />
      );

      await user.click(screen.getByRole('combobox'));

      expect(within(screen.getByRole('listbox')).getByText('Default folder (__Sports) (TV)')).toBeInTheDocument();
    });

    test('labels the root option when the main folder is TV', () => {
      render(<SubfolderAutocomplete mode="channel" value={null} onChange={mockOnChange} subfolders={[]} layoutOf={layoutOf} />);
      expect(screen.getByRole('combobox')).toHaveValue('Main folder (TV)');
    });

    test('shows no layout labels without a resolver', async () => {
      const user = userEvent.setup();
      render(<SubfolderAutocomplete mode="channel" value={null} onChange={mockOnChange} subfolders={defaultSubfolders} />);

      await user.click(screen.getByRole('combobox'));

      expect(within(screen.getByRole('listbox')).getByText('__Sports')).toBeInTheDocument();
    });
  });
});

