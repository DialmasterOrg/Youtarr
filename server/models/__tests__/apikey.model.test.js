const ApiKey = require('../apikey');

describe('ApiKey model', () => {
  const getter = ApiKey.rawAttributes.allowed_media_types.get;

  test('normalizes MariaDB JSON text into the policy media-type array', () => {
    const record = {
      getDataValue: jest.fn().mockReturnValue('["video","short"]'),
    };

    expect(getter.call(record)).toEqual(['video', 'short']);
  });

  test('preserves corrupt JSON so authentication fails closed', () => {
    const record = {
      getDataValue: jest.fn().mockReturnValue('not-json'),
    };

    expect(getter.call(record)).toBe('not-json');
  });

  test('passes through JSON values already decoded by the dialect', () => {
    const mediaTypes = ['video'];
    const record = {
      getDataValue: jest.fn().mockReturnValue(mediaTypes),
    };

    expect(getter.call(record)).toBe(mediaTypes);
  });
});
