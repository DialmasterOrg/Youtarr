import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { defaultSubfolderMoveNotice } from '../defaultSubfolderMove';

describe('defaultSubfolderMoveNotice', () => {
  const saved = { ...DEFAULT_CONFIG, defaultSubfolder: 'Videos' };

  test('asks to save again when another setting is unsaved', () => {
    const form = { ...saved, defaultSubfolder: 'TV', defaultSkipVideoFolder: !saved.defaultSkipVideoFolder };
    expect(defaultSubfolderMoveNotice(form, saved, 'TV')).toBe(
      'The default subfolder changed. Save again to apply your other changes.'
    );
  });

  test('says nothing when the default subfolder was the only change', () => {
    const form = { ...saved, defaultSubfolder: 'TV' };
    expect(defaultSubfolderMoveNotice(form, saved, 'TV')).toBeNull();
  });
});
