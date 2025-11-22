'use strict';

const normalizeName = (value) => {
  if (!value) return '';
  return value.toString().toLowerCase();
};

const extractTableName = (table) => {
  if (!table) {
    return '';
  }
  if (typeof table === 'string') {
    return table;
  }
  if (typeof table === 'object') {
    if (table.tableName) return table.tableName;
    if (table.table_name) return table.table_name;
    if (table.name) return table.name;
  }
  return `${table}`;
};

async function tableExists(queryInterface, tableName) {
  const tablesRaw = await queryInterface.showAllTables();
  const target = normalizeName(tableName);

  return tablesRaw.some((table) => normalizeName(extractTableName(table)) === target);
}

async function columnExists(queryInterface, tableName, columnName) {
  const tableDefinition = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(tableDefinition, columnName);
}

async function createTableIfNotExists(queryInterface, tableName, attributes, options = {}) {
  if (await tableExists(queryInterface, tableName)) {
    return false;
  }
  await queryInterface.createTable(tableName, attributes, options);
  return true;
}

async function dropTableIfExists(queryInterface, tableName, options = {}) {
  if (!(await tableExists(queryInterface, tableName))) {
    return false;
  }
  await queryInterface.dropTable(tableName, options);
  return true;
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  if (await columnExists(queryInterface, tableName, columnName)) {
    return false;
  }
  await queryInterface.addColumn(tableName, columnName, definition);
  return true;
}

async function removeColumnIfExists(queryInterface, tableName, columnName) {
  try {
    if (!(await columnExists(queryInterface, tableName, columnName))) {
      return false;
    }
  } catch (error) {
    if (error.original && error.original.code === 'ER_NO_SUCH_TABLE') {
      return false;
    }
    if (error.message && error.message.includes('No description found')) {
      return false;
    }
    throw error;
  }

  await queryInterface.removeColumn(tableName, columnName);
  return true;
}

const normalizeFields = (fields) => {
  if (!fields) return null;

  if (!Array.isArray(fields)) {
    return null;
  }

  return fields.map((field) => {
    if (typeof field === 'string') {
      return normalizeName(field);
    }
    if (field && typeof field === 'object') {
      return normalizeName(field.attribute || field.name || field.columnName);
    }
    return normalizeName(field);
  });
};

async function showIndexesSafe(queryInterface, tableName) {
  try {
    return await queryInterface.showIndex(tableName);
  } catch (error) {
    if (error.original && error.original.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    if (error.message && error.message.includes('does not exist')) {
      return [];
    }
    throw error;
  }
}

async function indexExists(queryInterface, tableName, options = {}) {
  const indexes = await showIndexesSafe(queryInterface, tableName);

  if (indexes.length === 0) {
    return false;
  }

  const targetName = options.name ? normalizeName(options.name) : null;
  const targetFields = options.fields ? normalizeFields(options.fields) : null;

  return indexes.some((index) => {
    if (targetName && normalizeName(index.name) !== targetName) {
      return false;
    }

    if (targetFields) {
      const indexFieldNames = (index.fields || []).map((field) =>
        normalizeName(field.attribute || field.name || field.columnName)
      );

      if (indexFieldNames.length !== targetFields.length) {
        return false;
      }

      for (let i = 0; i < targetFields.length; i += 1) {
        if (indexFieldNames[i] !== targetFields[i]) {
          return false;
        }
      }
    }

    return true;
  });
}

async function addIndexIfMissing(queryInterface, tableName, fields, options = {}) {
  const lookup = options.name
    ? { name: options.name }
    : { fields };

  if (await indexExists(queryInterface, tableName, lookup)) {
    return false;
  }

  await queryInterface.addIndex(tableName, fields, options);
  return true;
}

async function removeIndexIfExists(queryInterface, tableName, identifier) {
  const lookup = Array.isArray(identifier)
    ? { fields: identifier }
    : { name: identifier };

  if (!(await indexExists(queryInterface, tableName, lookup))) {
    return false;
  }

  await queryInterface.removeIndex(tableName, identifier);
  return true;
}

module.exports = {
  tableExists,
  columnExists,
  createTableIfNotExists,
  dropTableIfExists,
  addColumnIfMissing,
  removeColumnIfExists,
  indexExists,
  addIndexIfMissing,
  removeIndexIfExists,
};
