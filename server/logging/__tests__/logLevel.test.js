/* eslint-env jest */
const {
  normalizeLevelSetting,
  isValidLevelSetting,
  resolveLevel,
} = require('../logLevel');

describe('normalizeLevelSetting', () => {
  test.each(['warn', 'info', 'debug'])('keeps %p', (value) => {
    expect(normalizeLevelSetting(value)).toBe(value);
  });

  test('lowercases and trims', () => {
    expect(normalizeLevelSetting(' DEBUG ')).toBe('debug');
  });

  test.each(['', 'trace', 'verbose', null, undefined, 42])('turns %p into Default', (value) => {
    expect(normalizeLevelSetting(value)).toBe('');
  });
});

describe('isValidLevelSetting', () => {
  test.each(['', 'warn', 'info', 'debug'])('accepts %p', (value) => {
    expect(isValidLevelSetting(value)).toBe(true);
  });

  test.each(['DEBUG', 'trace', 'verbose', null, 5])('rejects %p', (value) => {
    expect(isValidLevelSetting(value)).toBe(false);
  });
});

describe('resolveLevel', () => {
  test('uses the setting when one is saved', () => {
    expect(resolveLevel({ setting: 'debug', envLevel: 'info' })).toEqual({ level: 'debug', source: 'setting' });
  });

  test('uses LOG_LEVEL when the setting is Default', () => {
    expect(resolveLevel({ setting: '', envLevel: 'warn' })).toEqual({ level: 'warn', source: 'env' });
  });

  test('uses LOG_LEVEL when the setting is unusable', () => {
    expect(resolveLevel({ setting: 'verbose', envLevel: 'trace' })).toEqual({ level: 'trace', source: 'env' });
  });
});
