import { formatDateTime, formatDateTimeInZone } from '../formatters';

const iso = '2026-09-21T00:00:00.000Z';

describe('formatDateTimeInZone', () => {
  test('formats an instant in the given IANA zone', () => {
    // Midnight UTC on 21 September is 09:00 the same day in Tokyo.
    const formatted = formatDateTimeInZone(iso, 'Asia/Tokyo');
    expect(formatted).toMatch(/9:00/);
    expect(formatted).toMatch(/21/);
  });

  test('uses the browser zone when no zone is given', () => {
    expect(formatDateTimeInZone(iso, null)).toBe(formatDateTime(iso));
  });

  test('uses the browser zone for an unknown zone name', () => {
    expect(formatDateTimeInZone(iso, 'Mars/Olympus_Mons')).toBe(formatDateTime(iso));
  });

  test('returns null for an empty value', () => {
    expect(formatDateTimeInZone(null, 'Asia/Tokyo')).toBeNull();
  });
});
