'use strict';

const { isExternalApiEnabled, isExternalApiPath } = require('../externalApiConfig');

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

describe('isExternalApiPath', () => {
  test.each(['/external-api', '/external-api/v1/requests', '/EXTERNAL-API/v1/requests', '/External-Api/v1'])(
    'matches %p like the Express mount does',
    (path) => {
      expect(isExternalApiPath({ path })).toBe(true);
    }
  );

  test.each(['/api/videos', '/external-apis', '/api/external-api/v1', ''])(
    'does not match %p',
    (path) => {
      expect(isExternalApiPath({ path })).toBe(false);
    }
  );
});
