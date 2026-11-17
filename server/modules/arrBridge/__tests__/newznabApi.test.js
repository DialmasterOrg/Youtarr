/* eslint-env jest */
const { createNewznabApi } = require('../newznabApi');
const { SearchUnavailableError } = require('../searchQueue');
const { buildNzbLink, parseNzb } = require('../nzbFile');

const KEY = 'k'.repeat(64);
const ORIGIN = 'http://youtarr:3011';
const XML = 'application/xml; charset=utf-8';
const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';

const item = {
  title: TITLE,
  guid: 'youtarr-abcdefghijk-tv',
  link: `${ORIGIN}/arr/newznab/nzb/${TITLE}.nzb?id=abcdefghijk`,
  comments: 'https://www.youtube.com/watch?v=abcdefghijk',
  pubDate: new Date('2024-03-01T12:00:00.000Z'),
  kind: 'tv',
};

function setup({ items = [item] } = {}) {
  const searchService = { search: jest.fn().mockResolvedValue(items) };
  const logger = { warn: jest.fn(), info: jest.fn() };
  const api = createNewznabApi({
    getConfig: () => ({ arrBridgeEnabled: true, arrBridgeApiKey: KEY }),
    searchService,
    logger,
  });
  return { api, searchService, logger };
}

describe('newznabApi', () => {
  describe('handleApi', () => {
    test('caps needs no key', async () => {
      const { api } = setup();
      const response = await api.handleApi({ t: 'caps' }, ORIGIN);
      expect(response).toMatchObject({ status: 200, contentType: XML });
      expect(response.body).toContain('<caps>');
    });

    test('caps with a wrong key reports the key, so the indexer Test shows it', async () => {
      const { api } = setup();
      const response = await api.handleApi({ t: 'caps', apikey: 'wrong' }, ORIGIN);
      expect(response.status).toBe(200);
      expect(response.body).toContain('<error code="100" description="Incorrect user credentials"/>');
    });

    test('a search with a wrong key is error 100 with HTTP 200', async () => {
      const { api, searchService } = setup();
      const response = await api.handleApi({ t: 'tvsearch', apikey: 'wrong', q: 'x' }, ORIGIN);
      expect(response).toMatchObject({ status: 200, contentType: XML });
      expect(response.body).toContain('<error code="100"');
      expect(searchService.search).not.toHaveBeenCalled();
    });

    test('a search without a key is refused before its parameters are looked at', async () => {
      const { api } = setup();
      const response = await api.handleApi({ t: 'details' }, ORIGIN);
      expect(response.body).toContain('<error code="100"');
    });

    test('an invalid request is the matching Newznab error', async () => {
      const { api } = setup();
      const response = await api.handleApi({ t: 'tvsearch', apikey: KEY, q: ['a', 'b'] }, ORIGIN);
      expect(response.status).toBe(200);
      expect(response.body).toContain('<error code="201"');
    });

    test('a search renders the items the search service returns', async () => {
      const { api, searchService } = setup();
      const response = await api.handleApi(
        { t: 'tvsearch', apikey: KEY, cat: '5030,5040', title: 'The Office (US)', season: '1', ep: '2' },
        ORIGIN
      );
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ shape: 'episode', text: 'The Office (US)', season: 1, episode: 2 }),
        ORIGIN
      );
      expect(response).toMatchObject({ status: 200, contentType: XML });
      expect(response.body).toContain(`<title>${TITLE}</title>`);
    });

    test('a search that could not run is error 900 with HTTP 200, never a 429 or an empty page', async () => {
      const { api, searchService, logger } = setup();
      searchService.search.mockRejectedValue(new SearchUnavailableError('hold-timeout'));

      const response = await api.handleApi({ t: 'tvsearch', apikey: KEY, q: 'x', season: '1', ep: '1', cat: '5030' }, ORIGIN);

      expect(response.status).toBe(200);
      expect(response.body).toContain('<error code="900" description="Youtarr could not search YouTube right now"/>');
      expect(response.body).not.toContain('<rss');
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ reason: 'hold-timeout' }), expect.any(String));
    });

    test('an unexpected error is thrown for the route to report', async () => {
      const { api, searchService } = setup();
      searchService.search.mockRejectedValue(new Error('bug'));
      await expect(api.handleApi({ t: 'tvsearch', apikey: KEY }, ORIGIN)).rejects.toThrow('bug');
    });
  });

  describe('handleNzb', () => {
    const fields = {
      youtubeId: 'abcdefghijk',
      kind: 'tv',
      releaseTitle: TITLE,
      uploadDate: new Date('2024-03-01T12:00:00.000Z'),
      estimatedBytes: 1000,
    };
    const linkParts = () => {
      const url = new URL(buildNzbLink(ORIGIN, fields, KEY));
      return { file: decodeURIComponent(url.pathname.split('/').pop()), query: Object.fromEntries(url.searchParams) };
    };

    test('serves the carrier NZB for a link the feed handed out', () => {
      const { api } = setup();
      const { file, query } = linkParts();

      const response = api.handleNzb(file, query);

      expect(response).toMatchObject({ status: 200, contentType: 'application/x-nzb', filename: `${TITLE}.nzb` });
      expect(parseNzb(response.body)).toEqual(fields);
    });

    test('answers 404 for a wrong key', () => {
      const { api } = setup();
      const { file, query } = linkParts();
      expect(api.handleNzb(file, { ...query, apikey: 'wrong' })).toEqual({ status: 404 });
    });

    test('answers 404 for the placeholder item', () => {
      const { api } = setup();
      const { file, query } = linkParts();
      expect(api.handleNzb(file, { ...query, id: 'placeholder' })).toEqual({ status: 404 });
    });

    test('answers 404 for a tampered id', () => {
      const { api } = setup();
      const { file, query } = linkParts();
      expect(api.handleNzb(file, { ...query, id: 'abcdefghijkl' })).toEqual({ status: 404 });
    });
  });
});
