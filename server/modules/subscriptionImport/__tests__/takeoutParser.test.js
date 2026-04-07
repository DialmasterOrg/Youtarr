'use strict';

const { parseCsv } = require('../takeoutParser');

describe('takeoutParser.parseCsv', () => {
  const header = 'Channel Id,Channel Url,Channel Title';

  test('parses a well-formed Takeout CSV', () => {
    const csv = [
      header,
      'UC1JTQBa5QxZCpXrFSkMxmPw,http://www.youtube.com/channel/UC1JTQBa5QxZCpXrFSkMxmPw,Raycevick',
      'UCBJycsmduvYEL83R_U4JriQ,http://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ,MKBHD',
    ].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf8'));
    expect(result).toEqual([
      { channelId: 'UC1JTQBa5QxZCpXrFSkMxmPw', url: 'https://www.youtube.com/channel/UC1JTQBa5QxZCpXrFSkMxmPw', title: 'Raycevick' },
      { channelId: 'UCBJycsmduvYEL83R_U4JriQ', url: 'https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ', title: 'MKBHD' },
    ]);
  });

  test('handles titles with commas inside quoted fields', () => {
    const csv = [header, 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,"Smith, Jones, and Co."'].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf8'));
    expect(result[0].title).toBe('Smith, Jones, and Co.');
  });

  test('handles titles with escaped double quotes', () => {
    const csv = [header, 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,"He said ""hi"""'].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf8'));
    expect(result[0].title).toBe('He said "hi"');
  });

  test('handles unicode in titles', () => {
    const csv = [header, 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,日本語 チャンネル'].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf8'));
    expect(result[0].title).toBe('日本語 チャンネル');
  });

  test('strips UTF-8 BOM from the start of the file', () => {
    const csvWithBom = '\uFEFF' + [header, 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,Test'].join('\n');
    const result = parseCsv(Buffer.from(csvWithBom, 'utf8'));
    expect(result).toHaveLength(1);
    expect(result[0].channelId).toBe('UCabc123def456ghij');
  });

  test('dedupes repeated channel ids', () => {
    const csv = [header, 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,First', 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,Second'].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf8'));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('First');
  });

  test('normalizes http:// to https:// in channel urls', () => {
    const csv = [header, 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,X'].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf8'));
    expect(result[0].url).toMatch(/^https:\/\//);
  });

  test('ignores rows with invalid channel ids (not starting with UC)', () => {
    const csv = [header, 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,Good', 'bogus123,http://www.youtube.com/channel/bogus123,Bad'].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf8'));
    expect(result).toHaveLength(1);
    expect(result[0].channelId).toBe('UCabc123def456ghij');
  });

  test('throws on missing header', () => {
    const csv = 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,Test';
    expect(() => parseCsv(Buffer.from(csv, 'utf8'))).toThrow(/header/i);
  });

  test('throws on empty file', () => {
    expect(() => parseCsv(Buffer.from('', 'utf8'))).toThrow(/empty/i);
  });

  test('throws when no valid rows remain', () => {
    const csv = [header, 'bogus,http://example.com,x'].join('\n');
    expect(() => parseCsv(Buffer.from(csv, 'utf8'))).toThrow(/no valid.*channel/i);
  });

  test('tolerates trailing empty lines', () => {
    const csv = [header, 'UCabc123def456ghij,http://www.youtube.com/channel/UCabc123def456ghij,Test', '', ''].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf8'));
    expect(result).toHaveLength(1);
  });
});
