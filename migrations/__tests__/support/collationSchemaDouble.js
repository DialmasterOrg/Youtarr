'use strict';

// There is no DDL harness in this repo. This double models the collation
// state of a database (default collation, per-table collation, per-column
// collation, per-table foreign keys) and applies the ALTER statements the
// collation helpers issue, so tests can assert the schema they leave behind
// rather than a SQL script.
//
// `tables` maps a table name to
// `{ collation, columns: { name: collation }, foreignKeys: [...] }` where each
// foreign key is `{ name, columns, referencedTable, referencedColumns,
// updateRule, deleteRule }`. Statements are recorded in order with the
// transaction they were issued on and the FOREIGN_KEY_CHECKS value in effect
// when they ran.
//
// Changing the collation of a column that takes part in a foreign key is
// refused the way the server refuses it: with FOREIGN_KEY_CHECKS=1 on every
// engine, and regardless of that setting when `rejectForeignKeyColumnChanges`
// is set (MariaDB 10.4.31+ and everything newer).

const ALTER_DATABASE = /^ALTER DATABASE `(.+)` CHARACTER SET (\w+) COLLATE (\w+)$/;
const CONVERT_TABLE = /^ALTER TABLE `(.+)` CONVERT TO CHARACTER SET (\w+) COLLATE (\w+)$/;
const MODIFY_UUID = /^ALTER TABLE `(.+)` MODIFY `(.+)` CHAR\(36\) CHARACTER SET (\w+) COLLATE (\w+) NOT NULL$/;
const DROP_FOREIGN_KEY = /^ALTER TABLE `(.+)` DROP FOREIGN KEY `(.+)`$/;
const ADD_FOREIGN_KEY =
  /^ALTER TABLE `(.+)` ADD CONSTRAINT `(.+)` FOREIGN KEY \((.+)\) REFERENCES `(.+)` \((.+)\)(?: ON UPDATE (\w+(?: \w+)?))?(?: ON DELETE (\w+(?: \w+)?))?$/;
const SET_FK_CHECKS = /^SET FOREIGN_KEY_CHECKS = (\d)$/;

// What MariaDB reports for a key created without an ON UPDATE / ON DELETE clause.
const DEFAULT_RULE = 'RESTRICT';

const splitColumnList = (list) => list.split(',').map((column) => column.trim().replace(/^`|`$/g, ''));

function createCollationSchemaDouble({
  database = { name: 'youtarr', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },
  tables = {},
  failOnSqlMatching = null,
  rejectForeignKeyColumnChanges = false,
} = {}) {
  const ops = [];
  const transactions = [];
  const state = { foreignKeyChecks: 1 };

  for (const table of Object.values(tables)) {
    table.foreignKeys = table.foreignKeys || [];
  }

  const findTable = (name) =>
    Object.entries(tables).find(([tableName]) => tableName.toLowerCase() === name.toLowerCase());

  const requireTable = (name) => {
    const table = tables[name];
    if (!table) {
      throw new Error(`unknown table ${name}`);
    }
    return table;
  };

  // Mirrors ER_FK_COLUMN_CANNOT_CHANGE (child side) and
  // ER_FK_COLUMN_CANNOT_CHANGE_CHILD (parent side).
  const assertColumnChangeAllowed = (tableName, column, newCollation) => {
    const table = tables[tableName];
    if (table.columns[column] === newCollation) {
      return;
    }
    if (!rejectForeignKeyColumnChanges && state.foreignKeyChecks === 0) {
      return;
    }
    const own = table.foreignKeys.find((fk) => fk.columns.includes(column));
    if (own) {
      throw new Error(`Cannot change column '${column}': used in a foreign key constraint '${own.name}'`);
    }
    for (const [childName, child] of Object.entries(tables)) {
      const referencing = child.foreignKeys.find(
        (fk) => fk.referencedTable.toLowerCase() === tableName.toLowerCase() && fk.referencedColumns.includes(column)
      );
      if (referencing) {
        throw new Error(
          `Cannot change column '${column}': used in a foreign key constraint '${referencing.name}' of table '${database.name}.${childName}'`
        );
      }
    }
  };

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
      const table = requireTable(match[1]);
      for (const column of Object.keys(table.columns)) {
        assertColumnChangeAllowed(match[1], column, match[3]);
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
      assertColumnChangeAllowed(match[1], match[2], match[4]);
      table.columns[match[2]] = match[4];
      return;
    }
    if ((match = sql.match(DROP_FOREIGN_KEY))) {
      const table = requireTable(match[1]);
      const index = table.foreignKeys.findIndex((fk) => fk.name === match[2]);
      if (index === -1) {
        throw new Error(`Can't DROP FOREIGN KEY \`${match[2]}\`; check that it exists`);
      }
      table.foreignKeys.splice(index, 1);
      return;
    }
    if ((match = sql.match(ADD_FOREIGN_KEY))) {
      const table = requireTable(match[1]);
      const [, , name, columnList, referencedTable, referencedList, updateRule = DEFAULT_RULE, deleteRule = DEFAULT_RULE] = match;
      const columns = splitColumnList(columnList);
      const referencedColumns = splitColumnList(referencedList);
      const parentEntry = findTable(referencedTable);
      if (table.foreignKeys.some((fk) => fk.name === name)) {
        throw new Error(`Duplicate FOREIGN KEY constraint name '${name}'`);
      }
      if (!parentEntry) {
        throw new Error(`unknown referenced table ${referencedTable}`);
      }
      columns.forEach((column, i) => {
        const parentCollation = parentEntry[1].columns[referencedColumns[i]];
        if (!(column in table.columns) || parentCollation === undefined) {
          throw new Error(`unknown column in foreign key ${name}`);
        }
        if (table.columns[column] !== parentCollation) {
          throw new Error(`Cannot add foreign key constraint '${name}': collation mismatch on ${column}`);
        }
      });
      table.foreignKeys.push({ name, columns, referencedTable, referencedColumns, updateRule, deleteRule });
      return;
    }
    throw new Error(`unexpected statement: ${sql}`);
  };

  const foreignKeyRows = () =>
    Object.entries(tables).flatMap(([tableName, table]) =>
      table.foreignKeys.flatMap((fk) =>
        fk.columns.map((column, i) => ({
          name: fk.name,
          table: tableName,
          column,
          position: i + 1,
          referencedTable: fk.referencedTable,
          referencedColumn: fk.referencedColumns[i],
          updateRule: fk.updateRule,
          deleteRule: fk.deleteRule,
        }))
      )
    );

  const sequelize = {
    query: async (sql, options = {}) => {
      const text = sql.replace(/\s+/g, ' ').trim();
      if (/FROM information_schema\.SCHEMATA/i.test(text)) {
        return [{ ...database }];
      }
      if (/FROM information_schema\.TABLES/i.test(text)) {
        return Object.entries(tables).map(([name, table]) => ({ name, collation: table.collation }));
      }
      if (/FROM information_schema\.KEY_COLUMN_USAGE/i.test(text)) {
        return foreignKeyRows();
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
