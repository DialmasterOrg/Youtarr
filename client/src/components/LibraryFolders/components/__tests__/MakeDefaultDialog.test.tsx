import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MakeDefaultDialog } from '../dialogs/MakeDefaultDialog';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import { useDefaultFolder } from '../../hooks/useDefaultFolder';
import { ReorganizeRequiredError } from '../../../shared/Reorganize';

jest.mock('../../hooks/useDefaultFolder', () => ({ useDefaultFolder: jest.fn() }));

const folders = [folder('Kids', { isDefault: true, channelsFollowing: 3 }), folder('TV', { layout: 'tv', makeDefaultNeedsReview: true })];

describe('MakeDefaultDialog', () => {
  test('a cross-layout switch says it moves videos and hands the change to the review', async () => {
    const change = { type: 'defaultSubfolder' as const, value: 'TV' };
    const setDefaultFolder = jest.fn().mockRejectedValue(new ReorganizeRequiredError('Review the move', change));
    (useDefaultFolder as jest.Mock).mockReturnValue({ saving: false, setDefaultFolder });
    const value = makePageValue({ folders });
    const onClose = jest.fn();
    renderInPage(<MakeDefaultDialog folder={folders[1]} onClose={onClose} />, { value });
    expect(screen.getByText(/channels that follow the default become TV shows/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review the move' }));
    expect(onClose).toHaveBeenCalled();
    expect(value.reviewChange).toHaveBeenCalledWith(change, { kind: 'default', folder: 'TV' });
  });

  test('a same-layout switch saves and says existing videos stay', async () => {
    const setDefaultFolder = jest.fn().mockResolvedValue(undefined);
    (useDefaultFolder as jest.Mock).mockReturnValue({ saving: false, setDefaultFolder });
    const onClose = jest.fn();
    renderInPage(<MakeDefaultDialog folder={folder('Music')} onClose={onClose} />, { value: makePageValue({ folders }) });
    expect(screen.getByText('Videos they already downloaded stay where they are. Keep a library on __Kids to watch them.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make default' }));
    expect(setDefaultFolder).toHaveBeenCalledWith('Music');
    expect(onClose).toHaveBeenCalled();
  });

  test('a refusal stays in the dialog', async () => {
    (useDefaultFolder as jest.Mock).mockReturnValue({ saving: false, setDefaultFolder: jest.fn().mockRejectedValue(new Error('Wait for the current download')) });
    renderInPage(<MakeDefaultDialog folder={folder('Music')} onClose={jest.fn()} />, { value: makePageValue({ folders }) });
    await userEvent.click(screen.getByRole('button', { name: 'Make default' }));
    expect(await screen.findByText('Wait for the current download')).toBeInTheDocument();
  });
});
