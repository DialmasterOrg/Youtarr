jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

describe('plexRefreshMappings', () => {
  let plexRefreshMappings;
  let plexModule;
  let subfolderModule;
  let config;

  beforeEach(() => {
    jest.resetModules();
    config = {
      plexApiKey: 'token', plexIP: '192.168.1.174', plexPort: '32400',
      plexSubfolderLibraryMappings: [{ subfolder: 'Kids', libraryId: '38' }],
    };
    jest.doMock('../../configModule', () => ({ getConfig: jest.fn(() => config), updateConfig: jest.fn((next) => { config = next; }) }));
    jest.doMock('../../plexModule', () => ({
      getBaseUrl: jest.fn(() => 'http://192.168.1.174:32400'),
      getLibraries: jest.fn().mockResolvedValue([{ id: '38', title: 'Kids' }, { id: '41', title: 'TV' }]),
    }));
    jest.doMock('../../subfolderModule', () => ({
      getAll: jest.fn().mockResolvedValue(['__Kids', '__TV']),
      register: jest.fn().mockResolvedValue(null),
    }));
    plexRefreshMappings = require('../plexRefreshMappings');
    plexModule = require('../../plexModule');
    subfolderModule = require('../../subfolderModule');
  });

  test('sets a library for a folder, in its registry spelling', async () => {
    const result = await plexRefreshMappings.setMapping('tv', '41');

    expect(result).toEqual({
      mappedLibraryId: '41', choice: 'library',
      plexSubfolderLibraryMappings: [{ subfolder: 'Kids', libraryId: '38' }, { subfolder: 'TV', libraryId: '41' }],
    });
    expect(subfolderModule.register).toHaveBeenCalledWith('TV');
  });

  test('overwrites an existing entry', async () => {
    const result = await plexRefreshMappings.setMapping('Kids', '41');
    expect(result.plexSubfolderLibraryMappings).toEqual([{ subfolder: 'Kids', libraryId: '41' }]);
  });

  test('stores the explicit default choice without asking Plex', async () => {
    const result = await plexRefreshMappings.setMapping('Kids', null);

    expect(result).toMatchObject({ mappedLibraryId: null, choice: 'default' });
    expect(plexModule.getLibraries).not.toHaveBeenCalled();
  });

  test('maps the main folder as a null subfolder', async () => {
    const result = await plexRefreshMappings.setMapping('', '38');
    expect(result.plexSubfolderLibraryMappings).toContainEqual({ subfolder: null, libraryId: '38' });
    expect(subfolderModule.register).not.toHaveBeenCalled();
  });

  test('400s a library Plex does not list', async () => {
    await expect(plexRefreshMappings.setMapping('Kids', '99')).rejects.toMatchObject({ status: 400 });
  });

  test('409s when Plex lists nothing (unreachable) or is not configured', async () => {
    plexModule.getLibraries.mockResolvedValue([]);
    await expect(plexRefreshMappings.setMapping('Kids', '41')).rejects.toMatchObject({ status: 409 });
    config.plexApiKey = '';
    await expect(plexRefreshMappings.setMapping('Kids', '41')).rejects.toMatchObject({ status: 409 });
  });

  test('404s an unknown folder', async () => {
    await expect(plexRefreshMappings.setMapping('Nope', null)).rejects.toMatchObject({ status: 404 });
  });

  test('removes an entry without Plex, and answers the same for a missing one', async () => {
    plexModule.getLibraries.mockRejectedValue(new Error('must not be called'));

    await expect(plexRefreshMappings.removeMapping('KIDS')).resolves.toEqual({
      mappedLibraryId: null, choice: 'none', plexSubfolderLibraryMappings: [],
    });
    await expect(plexRefreshMappings.removeMapping('Gone')).resolves.toMatchObject({ choice: 'none' });
  });
});
