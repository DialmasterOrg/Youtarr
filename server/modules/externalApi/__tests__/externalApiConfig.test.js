'use strict';

const { isExternalApiEnabled } = require('../externalApiConfig');

describe('isExternalApiEnabled', () => {
  const originalValue = process.env.EXTERNAL_API_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.EXTERNAL_API_ENABLED;
    } else {
      process.env.EXTERNAL_API_ENABLED = originalValue;
    }
  });

  test.each([undefined, null, '', 'false', 'FALSE', '0', 'yes'])(
    'fails closed for %p',
    (value) => {
      expect(isExternalApiEnabled(value)).toBe(false);
    }
  );

  test.each(['true', 'TRUE', ' true '])(
    'requires an explicit true value for %p',
    (value) => {
      expect(isExternalApiEnabled(value)).toBe(true);
    }
  );

  test('reads the process environment when no value is supplied', () => {
    delete process.env.EXTERNAL_API_ENABLED;
    expect(isExternalApiEnabled()).toBe(false);

    process.env.EXTERNAL_API_ENABLED = 'true';
    expect(isExternalApiEnabled()).toBe(true);
  });
});
