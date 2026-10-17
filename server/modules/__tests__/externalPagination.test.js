const { pagination, paginationDto, CatalogError } = require('../externalPagination');

test('catalog pagination rejects unbounded or conflicting parameters', () => {
  for (const query of [{ page: '101' }, { pageSize: '101' }, { page: '-1' },
    { cursor: 'x'.repeat(201) }, { page: '1', cursor: 'anything' }]) {
    expect(() => pagination(query)).toThrow(CatalogError);
  }
  const result = paginationDto(1, 50, 60);
  expect(pagination({ cursor: result.nextCursor })).toEqual({ page: 2, pageSize: 50, offset: 50 });
  expect(paginationDto(1, 50, 0)).toMatchObject({ totalPages: 0, nextCursor: null });
});
