import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TitleShow, TitleShowDraft } from '../../../../../types/titleShows';
import { ReorganizeRequiredError } from '../../../../shared/Reorganize/reorganizeErrors';
import { ShowFolderTakenError } from '../../../hooks/useTitleShows';

const mockPreviewHook = jest.fn();
jest.mock('../../../hooks/useTitleShowPreview', () => ({
  useTitleShowPreview: (...args: unknown[]) => mockPreviewHook(...args),
}));
jest.mock('../TitleShowPreviewTabs', () => ({
  __esModule: true,
  default: function MockTabs(props: { showKey: string }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'preview-tabs' }, props.showKey);
  },
}));

import TitleShowEditorDialog from '../TitleShowEditorDialog';

const SHOW: TitleShow = {
  id: 3, name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV', position: 0, retired: false,
  excludeTerms: ['Official Clip'], seasonNames: { 2: 'V-Force' }, counts: null,
  patterns: [{ text: 'BEYBLADE EN Episode {episode}: {title}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title', compiledRegex: '(?i)x' }],
};
const OTHER: TitleShowDraft = { id: 4, name: 'Clips', patterns: [{ text: '{title} | Clip', kind: 'simple', seasonSource: 'fixed', seasonFixed: 0, episodeSource: 'order' }] };

function renderEditor(props: Partial<React.ComponentProps<typeof TitleShowEditorDialog>> = {}) {
  const handlers = { onClose: jest.fn(), onSave: jest.fn().mockResolvedValue(undefined), onReviewMove: jest.fn(), onRestore: jest.fn() };
  render(
    <TitleShowEditorDialog
      open
      token="token"
      channelId="UC1"
      show={null}
      drafts={[OTHER]}
      tvFolders={['TV', 'Anime']}
      defaultLibraryFolder="TV"
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe('TitleShowEditorDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPreviewHook.mockReturnValue({ preview: null, loading: false, error: null, current: false });
  });

  test('offers regex mode once the preview has compiled the patterns as they are', () => {
    mockPreviewHook.mockReturnValue({
      preview: { compiled: [{ key: 'title:3', patterns: ['(?i)x'] }] }, loading: false, error: null, current: true,
    });
    renderEditor({ show: SHOW });
    expect(screen.getByRole('button', { name: 'Edit as regular expression' })).toBeEnabled();
  });

  test('holds regex mode back while the preview is out of date', () => {
    mockPreviewHook.mockReturnValue({
      preview: { compiled: [{ key: 'title:3', patterns: ['(?i)x'] }] }, loading: false, error: null, current: false,
    });
    renderEditor({ show: SHOW });
    expect(screen.getByRole('button', { name: 'Edit as regular expression' })).toBeDisabled();
  });

  test('previews a new show after the channel\'s other shows', () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText('Show name'), { target: { value: 'Beyblade' } });
    fireEvent.change(screen.getByLabelText('Pattern 1'), { target: { value: 'Ep {episode}' } });
    const [, , shows] = mockPreviewHook.mock.calls[mockPreviewHook.mock.calls.length - 1];
    expect(shows).toEqual([OTHER, expect.objectContaining({ name: 'Beyblade', libraryFolder: 'TV' })]);
    expect(screen.getByTestId('preview-tabs')).toHaveTextContent('new:1');
  });

  test('edits an existing show in place', () => {
    renderEditor({ show: SHOW, drafts: [{ id: 3, name: 'Beyblade', patterns: [] }, OTHER] });
    expect(screen.getByLabelText('Show name')).toHaveValue('Beyblade');
    expect(screen.getByLabelText('Exclude titles containing')).toHaveValue('Official Clip');
    expect(screen.getByTestId('preview-tabs')).toHaveTextContent('title:3');
    const [, , shows] = mockPreviewHook.mock.calls[mockPreviewHook.mock.calls.length - 1];
    expect(shows.map((draft: TitleShowDraft) => draft.id)).toEqual([3, 4]);
  });

  test('saves the show as a draft', async () => {
    const { onSave, onClose } = renderEditor({ show: SHOW, drafts: [{ id: 3, name: 'Beyblade', patterns: [] }] });
    fireEvent.click(screen.getByRole('button', { name: 'Save show' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      id: 3,
      name: 'Beyblade',
      folderName: 'Beyblade',
      libraryFolder: 'TV',
      excludeTerms: ['Official Clip'],
      seasonNames: { 2: 'V-Force' },
      patterns: [{ text: 'BEYBLADE EN Episode {episode}: {title}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' }],
    }));
    expect(onClose).toHaveBeenCalled();
  });

  test('needs a name and a pattern before saving', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Save show' })).toBeDisabled();
  });

  test('adds and removes patterns', () => {
    renderEditor({ show: SHOW });
    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }));
    expect(screen.getByLabelText('Pattern 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove pattern 2' }));
    expect(screen.queryByLabelText('Pattern 2')).not.toBeInTheDocument();
  });

  test('hands a save that moves files to the review', async () => {
    const change = { type: 'titleShows' as const, channelId: 'UC1', shows: [] };
    const { onSave, onReviewMove } = renderEditor({ show: SHOW });
    onSave.mockRejectedValueOnce(new ReorganizeRequiredError('Review the move first.', change));
    fireEvent.click(screen.getByRole('button', { name: 'Save show' }));
    await waitFor(() => expect(onReviewMove).toHaveBeenCalledWith(change));
  });

  test('offers the suggested folder name when the folder is taken', async () => {
    const { onSave } = renderEditor({ show: SHOW });
    onSave.mockRejectedValueOnce(new ShowFolderTakenError('The folder "Beyblade" is taken.', 'Beyblade (Chan)', null));
    fireEvent.click(screen.getByRole('button', { name: 'Save show' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use "Beyblade (Chan)"' }));
    expect(screen.getByLabelText('Folder name')).toHaveValue('Beyblade (Chan)');
  });

  test('offers to restore a removed show that used the folder', async () => {
    const { onSave, onRestore } = renderEditor({ show: null });
    fireEvent.change(screen.getByLabelText('Show name'), { target: { value: 'Beyblade' } });
    fireEvent.change(screen.getByLabelText('Pattern 1'), { target: { value: 'Ep {episode}' } });
    onSave.mockRejectedValueOnce(new ShowFolderTakenError('taken', 'Beyblade (Chan)', 5));
    fireEvent.click(screen.getByRole('button', { name: 'Save show' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore the removed show' }));
    expect(onRestore).toHaveBeenCalledWith(5);
  });

  test('asks for a TV folder when the channel has none', () => {
    renderEditor({ tvFolders: [], defaultLibraryFolder: null });
    expect(screen.getByText(/Set up a TV folder first/)).toBeInTheDocument();
  });
});
