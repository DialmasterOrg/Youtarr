const models = require('../index');

describe('Subfolder model registration', () => {
  test('is exported from models/index', () => {
    expect(models.Subfolder).toBeDefined();
  });

  test('maps to the subfolders table with a name attribute', () => {
    expect(models.Subfolder.tableName).toBe('subfolders');
    expect(models.Subfolder.rawAttributes.name).toBeDefined();
  });
});
