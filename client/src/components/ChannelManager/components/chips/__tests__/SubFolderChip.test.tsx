import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubFolderChip from '../SubFolderChip';
import { renderWithProviders } from '../../../../../test-utils';
import { within } from '@testing-library/react';

describe('SubFolderChip', () => {
  test('renders default subfolder when subFolder is null', () => {
    renderWithProviders(<SubFolderChip subFolder={null} />);

    const chip = screen.getByTestId('subfolder-chip');

    expect(chip).toHaveTextContent('default');
    expect(chip).toHaveAttribute('data-default', 'true');
    expect(within(chip).getByTestId('FolderIcon')).toBeInTheDocument();
  });

  test('renders default subfolder when subFolder is undefined', () => {
    renderWithProviders(<SubFolderChip subFolder={undefined} />);

    const chip = screen.getByTestId('subfolder-chip');

    expect(chip).toHaveTextContent('default');
    expect(chip).toHaveAttribute('data-default', 'true');
    expect(within(chip).getByTestId('FolderIcon')).toBeInTheDocument();
  });

  test('renders default subfolder when subFolder is empty string', () => {
    renderWithProviders(<SubFolderChip subFolder="" />);

    const chip = screen.getByTestId('subfolder-chip');

    expect(chip).toHaveTextContent('default');
    expect(chip).toHaveAttribute('data-default', 'true');
  });

  test('renders custom subfolder with correct format', () => {
    renderWithProviders(<SubFolderChip subFolder="my-channel" />);

    const chip = screen.getByTestId('subfolder-chip');

    expect(chip).toHaveTextContent('__my-channel/');
    expect(chip).toHaveAttribute('data-default', 'false');
    expect(within(chip).getByTestId('FolderIcon')).toBeInTheDocument();
  });

  test('renders subfolder with special characters', () => {
    renderWithProviders(<SubFolderChip subFolder="test_folder-2024" />);

    const chip = screen.getByTestId('subfolder-chip');

    expect(chip).toHaveTextContent('__test_folder-2024/');
    expect(chip).toHaveAttribute('data-default', 'false');
  });

  test('renders subfolder with spaces', () => {
    renderWithProviders(<SubFolderChip subFolder="My Channel Name" />);

    const chip = screen.getByTestId('subfolder-chip');

    expect(chip).toHaveTextContent('__My Channel Name/');
    expect(chip).toHaveAttribute('data-default', 'false');
  });
});
