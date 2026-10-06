import { renderHook, act } from '@testing-library/react';
import { useTitleShowForm } from '../useTitleShowForm';
import { TitleShow } from '../../../../../types/titleShows';

const SHOW: TitleShow = {
  id: 3, name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV', position: 0, retired: false, excludeTerms: [],
  seasonNames: {}, counts: null,
  patterns: [{ text: 'Ep {episode}', kind: 'simple', seasonSource: 'title', seasonFixed: 4, episodeSource: 'title', compiledRegex: 'x' }],
};

describe('useTitleShowForm', () => {
  test('starts a new show in the default TV folder with one empty pattern', () => {
    const { result } = renderHook(() => useTitleShowForm(true, null, 'TV'));
    expect(result.current.form.libraryFolder).toBe('TV');
    expect(result.current.form.patterns).toHaveLength(1);
    expect(result.current.valid).toBe(false);
  });

  test('builds the draft of an existing show without the compiled regex', () => {
    const { result } = renderHook(() => useTitleShowForm(true, SHOW, 'TV'));
    expect(result.current.draft.patterns).toEqual([
      { text: 'Ep {episode}', kind: 'simple', seasonSource: 'title', seasonFixed: null, episodeSource: 'title' },
    ]);
  });

  test('sends exclude terms one per line and drops empty lines', () => {
    const { result } = renderHook(() => useTitleShowForm(true, SHOW, 'TV'));
    act(() => result.current.update({ excludeText: 'Official Clip\n\n Dub ' }));
    expect(result.current.draft.excludeTerms).toEqual(['Official Clip', 'Dub']);
  });

  test('cannot save while a season is named twice', () => {
    const { result } = renderHook(() => useTitleShowForm(true, SHOW, 'TV'));
    act(() => result.current.update({ seasonRows: [{ season: '1', name: 'A' }, { season: '1', name: 'B' }] }));
    expect(result.current.valid).toBe(false);
  });

  test('leaves the folder name to the server when it is empty', () => {
    const { result } = renderHook(() => useTitleShowForm(true, SHOW, 'TV'));
    act(() => result.current.update({ folderName: '  ' }));
    expect('folderName' in result.current.draft).toBe(false);
  });
});
