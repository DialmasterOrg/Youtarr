import { addSubfolderPrefix, stripSubfolderPrefix } from '../subfolderDisplay';

describe('subfolderDisplay', () => {
  test('addSubfolderPrefix adds __ once', () => {
    expect(addSubfolderPrefix('Sports')).toBe('__Sports');
    expect(addSubfolderPrefix('__Sports')).toBe('__Sports');
  });

  test('stripSubfolderPrefix removes a leading __', () => {
    expect(stripSubfolderPrefix('__Sports')).toBe('Sports');
    expect(stripSubfolderPrefix('Sports')).toBe('Sports');
  });
});
