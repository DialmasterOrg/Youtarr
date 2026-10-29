'use strict';

const { indexExists } = require('./helpers');

// EXPLAIN evidence for the actual runtime queries is in docs/EXTERNAL_API.md.
// Existing channel/catalog lookup indexes already cover the granted-channel
// joins; no new indexes or uniqueness constraints are needed on those tables.
const INDEXES = [
  {
    fields: ['api_key_id', 'request_type', 'youtube_id', 'created_at', 'id', 'status'],
    name: 'external_requests_catalog_status_idx',
  },
  {
    fields: ['request_type', 'status', 'created_at', 'id'],
    name: 'external_requests_management_idx',
  },
];

module.exports = {
  async up(queryInterface) {
    for (const { fields, name } of INDEXES) {
      if (await indexExists(queryInterface, 'external_requests', { fields }) ||
          await indexExists(queryInterface, 'external_requests', { name })) continue;
      await queryInterface.addIndex('external_requests', fields, { name });
    }
  },

  async down(queryInterface) {
    for (const { fields, name } of [...INDEXES].reverse()) {
      // Preserve equivalent indexes under other names and unrelated same-name
      // indexes. Only remove this migration's named, matching definitions.
      if (await indexExists(queryInterface, 'external_requests', { name, fields })) {
        await queryInterface.removeIndex('external_requests', name);
      }
    }
  },

  INDEXES,
};
