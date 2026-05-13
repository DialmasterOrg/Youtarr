import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG } from '../configSchema';

// useConfig fills missing server fields from DEFAULT_CONFIG and save POSTs the
// full object back, so a default mismatch here silently overwrites the server's.
describe('DEFAULT_CONFIG alignment with config.example.json', () => {
  const examplePath = path.resolve(__dirname, '../../../../config/config.example.json');
  const exampleConfig = JSON.parse(fs.readFileSync(examplePath, 'utf8')) as Record<string, unknown>;
  delete exampleConfig['//comment'];

  // plexUrl is platform-managed and not in the client schema.
  const SERVER_ONLY_FIELDS = new Set<string>(['plexUrl']);

  // Runtime-derived fields populated by the server at /getconfig time
  // (not persisted to config.json, intentionally absent from the template).
  const CLIENT_RUNTIME_FIELDS = new Set<string>([
    'youtubeOutputDirectory',
    'envAuthApplied',
  ]);

  // null vs '': both falsy, treated identically by all consumers.
  const ACCEPTED_TYPE_DIFFERENCES = new Set<string>([
    'autoRemovalFreeSpaceThreshold',
    'autoRemovalVideoAgeThreshold',
  ]);

  test.each(
    Object.entries(exampleConfig).filter(
      ([key]) => !SERVER_ONLY_FIELDS.has(key) && !ACCEPTED_TYPE_DIFFERENCES.has(key)
    )
  )('%s in server template has a matching client default', (key, serverValue) => {
    expect(key in DEFAULT_CONFIG).toBe(true);
    const clientValue = (DEFAULT_CONFIG as Record<string, unknown>)[key];
    expect(clientValue).toEqual(serverValue);
  });

  test.each(
    Object.entries(DEFAULT_CONFIG).filter(
      ([key]) => !CLIENT_RUNTIME_FIELDS.has(key) && !ACCEPTED_TYPE_DIFFERENCES.has(key)
    )
  )('%s in DEFAULT_CONFIG has a matching server template entry', (key, clientValue) => {
    expect(key in exampleConfig).toBe(true);
    const serverValue = exampleConfig[key];
    expect(clientValue).toEqual(serverValue);
  });
});
