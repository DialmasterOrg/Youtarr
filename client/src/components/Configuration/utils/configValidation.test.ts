import { validateProxyUrl, validateConfig } from './configValidation';
import { DEFAULT_CONFIG, ConfigState } from '../../../config/configSchema';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  sponsorblockCategories: { ...DEFAULT_CONFIG.sponsorblockCategories },
  ...overrides
});

describe('validateProxyUrl', () => {
  test('returns null for empty or whitespace-only values', () => {
    expect(validateProxyUrl('   ')).toBeNull();
  });

  test('accepts supported protocols with optional auth and path', () => {
    const result = validateProxyUrl('https://user:pass@example.com:8443/path');
    expect(result).toBeNull();
  });

  test('rejects unsupported proxy protocols', () => {
    expect(validateProxyUrl('ftp://example.com')).toBe(
      'Invalid proxy URL format. Must be http://, https://, socks4://, or socks5://'
    );
  });

  test('rejects proxies that fail URL parsing despite matching the regex', () => {
    expect(validateProxyUrl('http://example.com:99999')).toBe('Invalid proxy URL');
  });
});

describe('validateConfig', () => {
  test('requires at least one automatic removal threshold when the feature is enabled', () => {
    const config = createConfig({
      autoRemovalEnabled: true,
      autoRemovalFreeSpaceThreshold: '',
      autoRemovalVideoAgeThreshold: ''
    });

    expect(validateConfig(config)).toBe(
      'Cannot save: Automatic removal is enabled but no thresholds are configured'
    );
  });

  test('passes when an automatic removal threshold is configured', () => {
    const config = createConfig({
      autoRemovalEnabled: true,
      autoRemovalFreeSpaceThreshold: '50GB'
    });

    expect(validateConfig(config)).toBeNull();
  });

  test('returns proxy validation errors surfaced by validateProxyUrl', () => {
    const config = createConfig({
      proxy: 'ftp://example.com'
    });

    expect(validateConfig(config)).toBe(
      'Cannot save: Invalid proxy URL format. Must be http://, https://, socks4://, or socks5://'
    );
  });

  test('ignores proxy validation when the field only contains whitespace', () => {
    const config = createConfig({
      proxy: '   '
    });

    expect(validateConfig(config)).toBeNull();
  });
});
