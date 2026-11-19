import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TvFolderSetup from '../TvFolderSetup';
import { ReorganizeRequiredError } from '../../../shared/Reorganize/reorganizeErrors';

describe('TvFolderSetup', () => {
  const setup = () => {
    const calls: string[] = [];
    const createSubfolder = jest.fn(async (name: string, layout: string) => { calls.push(`create:${name}:${layout}`); });
    const onSwitch = jest.fn(async (layout: string, folder: string) => { calls.push(`switch:${layout}:${folder}`); });
    render(<TvFolderSetup createSubfolder={createSubfolder} onSwitch={onSwitch} />);
    return { calls, createSubfolder, onSwitch, user: userEvent.setup() };
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

  test('creates the folder as a TV folder, then switches the channel to it', async () => {
    const { user, calls } = setup();

    await user.clear(screen.getByLabelText('Folder name'));
    await user.type(screen.getByLabelText('Folder name'), '  Shows  ');
    await user.click(screen.getByRole('button', { name: 'Create TV folder' }));

    await waitFor(() => {
      expect(calls).toEqual(['create:Shows:tv', 'switch:tv:Shows']);
    });
  });

  test('creates the TV folder in one request', async () => {
    const { user, createSubfolder } = setup();

    await user.click(screen.getByRole('button', { name: 'Create TV folder' }));

    await waitFor(() => expect(createSubfolder).toHaveBeenCalledWith('TV Shows', 'tv'));
  });

  test('shows the server message and stops when the folder cannot be created', async () => {
    const createSubfolder = jest.fn().mockRejectedValue(new Error('__TV Shows already holds downloaded files.'));
    const onSwitch = jest.fn();
    render(<TvFolderSetup createSubfolder={createSubfolder} onSwitch={onSwitch} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create TV folder' }));

    expect(await screen.findByText('__TV Shows already holds downloaded files.')).toBeInTheDocument();
    expect(onSwitch).not.toHaveBeenCalled();
  });

  test('hands a main folder move to the review without showing an error', async () => {
    const change = { type: 'mainFolderMove' as const, folder: 'Videos' };
    const onReviewRequired = jest.fn().mockReturnValue(true);
    render(
      <TvFolderSetup
        createSubfolder={jest.fn().mockRejectedValue(new ReorganizeRequiredError('Move first', change))}
        onSwitch={jest.fn()}
        onReviewRequired={onReviewRequired}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create TV folder' }));

    await waitFor(() => expect(onReviewRequired).toHaveBeenCalled());
    expect(screen.queryByText('Move first')).not.toBeInTheDocument();
  });

  test('shows the message when nothing handles the review', async () => {
    const change = { type: 'folderLayout' as const, folder: 'TV Shows', layout: 'tv' as const };
    render(
      <TvFolderSetup
        createSubfolder={jest.fn().mockRejectedValue(new ReorganizeRequiredError('Review the move first', change))}
        onSwitch={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create TV folder' }));

    expect(await screen.findByText('Review the move first')).toBeInTheDocument();
  });
});
