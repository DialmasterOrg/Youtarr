jest.mock('../../db', () => ({ sequelize: { query: jest.fn() } }));
const { sequelize } = require('../../db');
const { attachRequestStatuses } = require('../externalCatalogRequests');

beforeEach(() => jest.clearAllMocks());

test('empty catalog pages do not query request history', async () => {
  await attachRequestStatuses({ id: 7 }, []);
  expect(sequelize.query).not.toHaveBeenCalled();
});

test('attaches latest statuses only to the displayed videos for the calling key', async () => {
  sequelize.query.mockResolvedValue([{ youtube_id: 'abcdefghijk', status: 'pending' }]);
  const rows = [{ youtube_id: 'abcdefghijk' }, { youtube_id: 'lmnopqrstuv' }];
  await attachRequestStatuses({ id: 7 }, rows);
  expect(rows.map(row => row.request_status)).toEqual(['pending', null]);
  expect(sequelize.query).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    replacements: { keyId: 7, youtubeIds: ['abcdefghijk', 'lmnopqrstuv'] },
  }));
});
