'use strict';

// There is no DDL harness in this repo. This double models the collation
// state of a database (default collation, per-table collation, per-column
// collation) and applies the ALTER statements the collation helpers issue,
// so tests can assert the schema they leave behind rather than a SQL script.
//
// `tables` maps a table name to `{ collation, columns: { name: collation } }`.
// Statements are recorded in order with the transaction they were issued on
// and the FOREIGN_KEY_CHECKS value in effect when they ran.

const ALTER_DATABASE = /^ALTER DATABASE `(.+)` CHARACTER SET (\w+) COLLATE (\w+)$/;
const CONVERT_TABLE = /^ALTER TABLE `(.+)` CONVERT TO CHARACTER SET (\w+) COLLATE (\w+)$/;
const MODIFY_UUID = /^ALTER TABLE `(.+)` MODIFY `(.+)` CHAR\(36\) CHARACTER SET (\w+) COLLATE (\w+) NOT NULL$/;
const SET_FK_CHECKS = /^SET FOREIGN_KEY_CHECKS = (\d)$/;

function createCollationSchemaDouble({
  database = { name: 'youtarr', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },
  tables = {},
  failOnSqlMatching = null,
} = {}) {
  const ops = [];
  const transactions = [];
  const state = { foreignKeyChecks: 1 };

  const findTable = (name) =>
    Object.entries(tables).find(([tableName]) => tableName.toLowerCase() === name.toLowerCase());

  const apply = (sql) => {
    let match;
    if ((match = sql.match(SET_FK_CHECKS))) {
      state.foreignKeyChecks = Number(match[1]);
      return;
    }
    if ((match = sql.match(ALTER_DATABASE))) {
      if (match[1] !== database.name) {
        throw new Error(`unknown database ${match[1]}`);
      }
      database.charset = match[2];
      database.collation = match[3];
      return;
    }
    if ((match = sql.match(CONVERT_TABLE))) {
      const table = tables[match[1]];
      if (!table) {
        throw new Error(`unknown table ${match[1]}`);
      }
      table.collation = match[3];
      for (const column of Object.keys(table.columns)) {
        table.columns[column] = match[3];
      }
      return;
    }
    if ((match = sql.match(MODIFY_UUID))) {
      const table = tables[match[1]];
      if (!table || !(match[2] in table.columns)) {
        throw new Error(`unknown column ${match[1]}.${match[2]}`);
      }
      table.columns[match[2]] = match[4];
      return;
    }
    throw new Error(`unexpected statement: ${sql}`);
  };

  const sequelize = {
    query: async (sql, options = {}) => {
      const text = sql.replace(/\s+/g, ' ').trim();
      if (/FROM information_schema\.SCHEMATA/i.test(text)) {
        return [{ ...database }];
      }
      if (/FROM information_schema\.TABLES/i.test(text)) {
        return Object.entries(tables).map(([name, table]) => ({ name, collation: table.collation }));
      }
      if (/FROM information_schema\.COLUMNS/i.test(text)) {
        const [tableName, columnName] = options.replacements;
        const entry = findTable(tableName);
        if (!entry || !(columnName in entry[1].columns)) {
          return [];
        }
        return [{ table: entry[0], collation: entry[1].columns[columnName] }];
      }
      ops.push({ sql: text, transaction: options.transaction, foreignKeyChecks: state.foreignKeyChecks });
      if (failOnSqlMatching && failOnSqlMatching.test(text)) {
        throw new Error(`forced failure for: ${text}`);
      }
      apply(text);
      return [];
    },
    transaction: async () => {
      const record = { committed: false, rolledBack: false };
      transactions.push(record);
      return {
        commit: async () => {
          record.committed = true;
        },
        rollback: async () => {
          record.rolledBack = true;
        },
      };
    },
  };

  return { ops, transactions, database, tables, state, sequelize };
}

module.exports = { createCollationSchemaDouble };
