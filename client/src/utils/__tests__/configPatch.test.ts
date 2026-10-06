import { mergeServerChange } from '../configPatch';

interface Mapping { subfolder: string | null; libraryId: string }

const keyOf = (mapping: Mapping) => (mapping.subfolder || '').toLowerCase();
const kids: Mapping = { subfolder: 'Kids', libraryId: '12' };
const tv: Mapping = { subfolder: 'TV', libraryId: '41' };
const music: Mapping = { subfolder: 'Music', libraryId: '40' };

describe('mergeServerChange', () => {
  test('adds what the server added, after the draft\'s own entries', () => {
    expect(mergeServerChange([kids], [kids], [kids, tv], keyOf)).toEqual([kids, tv]);
  });

  test('keeps a pending removal while taking the server\'s addition', () => {
    // The user removed Kids but has not saved; the server added TV meanwhile.
    expect(mergeServerChange([], [kids], [kids, tv], keyOf)).toEqual([tv]);
  });

  test('keeps a pending edit of an entry the server did not touch', () => {
    const edited: Mapping = { subfolder: 'Kids', libraryId: '99' };
    expect(mergeServerChange([edited], [kids], [kids, tv], keyOf)).toEqual([edited, tv]);
  });

  test('keeps a pending addition the server does not know yet', () => {
    expect(mergeServerChange([kids, music], [kids], [kids, tv], keyOf)).toEqual([kids, music, tv]);
  });

  test('applies a change the server made to an entry', () => {
    const moved: Mapping = { subfolder: 'Kids', libraryId: '13' };
    expect(mergeServerChange([kids], [kids], [moved], keyOf)).toEqual([moved]);
  });

  test('applies a removal the server made', () => {
    expect(mergeServerChange([kids, tv], [kids, tv], [tv], keyOf)).toEqual([tv]);
  });

  test('matches entries by key, so a re-cased name replaces rather than duplicates', () => {
    const lower: Mapping = { subfolder: 'kids', libraryId: '12' };
    expect(mergeServerChange([kids], [kids], [lower, tv], keyOf)).toEqual([lower, tv]);
  });

  test('takes the saved list as is when there is no baseline yet', () => {
    expect(mergeServerChange([music], null, [kids, tv], keyOf)).toEqual([kids, tv]);
  });
});
