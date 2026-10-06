import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TvFolderSetup from '../TvFolderSetup';

describe('TvFolderSetup', () => {
  const setup = () => {
    const calls: string[] = [];
    const createSubfolder = jest.fn(async (name: string) => { calls.push(`create:${name}`); });
    const setFolderLayout = jest.fn(async (name: string, layout: string) => { calls.push(`layout:${name}:${layout}`); });
    const onSwitch = jest.fn(async (layout: string, folder: string) => { calls.push(`switch:${layout}:${folder}`); });
    render(<TvFolderSetup createSubfolder={createSubfolder} setFolderLayout={setFolderLayout} onSwitch={onSwitch} />);
    return { calls, createSubfolder, setFolderLayout, onSwitch, user: userEvent.setup() };
  };

  test('suggests "TV Shows" and shows where it is saved', () => {
    setup();

    expect(screen.getByLabelText('Folder name')).toHaveValue('TV Shows');
    expect(screen.getByText('Saved as __TV Shows in your downloads folder.')).toBeInTheDocument();
  });

  test('refuses an empty name without calling the server', async () => {
    const { user, createSubfolder } = setup();

    await user.clear(screen.getByLabelText('Folder name'));
    await user.click(screen.getByRole('button', { name: 'Create TV folder' }));

    expect(screen.getByText('Enter a folder name.')).toBeInTheDocument();
    expect(createSubfolder).not.toHaveBeenCalled();
  });

  test('creates the folder, makes it a TV folder, then switches the channel to it', async () => {
    const { user, calls } = setup();

    await user.clear(screen.getByLabelText('Folder name'));
    await user.type(screen.getByLabelText('Folder name'), '  Shows  ');
    await user.click(screen.getByRole('button', { name: 'Create TV folder' }));

    await waitFor(() => {
      expect(calls).toEqual(['create:Shows', 'layout:Shows:tv', 'switch:tv:Shows']);
    });
  });

  test('shows the server message and stops when a step fails', async () => {
    const { user, setFolderLayout, onSwitch } = setup();
    setFolderLayout.mockRejectedValueOnce(new Error('__TV Shows already holds downloaded files.'));

    await user.click(screen.getByRole('button', { name: 'Create TV folder' }));

    expect(await screen.findByText('__TV Shows already holds downloaded files.')).toBeInTheDocument();
    expect(onSwitch).not.toHaveBeenCalled();
  });
});
