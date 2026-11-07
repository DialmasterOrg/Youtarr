/* eslint-env jest */
const { Op } = require('sequelize');
const {
  REMOVAL_REASONS,
  REMOVAL_STATES,
  REMOVAL_COLUMNS,
  removalState,
  removedColumns,
  presentColumns,
  stateWhere,
  notStateWhere,
} = require('../videoRemovalState');

describe('videoRemovalState', () => {
  describe('removalState', () => {
    test('is present for a row that is not removed', () => {
      expect(removalState({ removed: 0 })).toBe(REMOVAL_STATES.PRESENT);
      expect(removalState({ removed: false, removed_reason: 'not_found' })).toBe(REMOVAL_STATES.PRESENT);
    });

    test('is missing for a removed row whose file was not found', () => {
      expect(removalState({ removed: 1, removed_reason: 'not_found' })).toBe(REMOVAL_STATES.MISSING);
    });

    test('is deleted for a removed row with any other reason', () => {
      expect(removalState({ removed: true, removed_reason: 'user_deleted' })).toBe(REMOVAL_STATES.DELETED);
      expect(removalState({ removed: true, removed_reason: 'auto_removal' })).toBe(REMOVAL_STATES.DELETED);
      expect(removalState({ removed: true, removed_reason: 'marked_deleted' })).toBe(REMOVAL_STATES.DELETED);
    });

    test('treats a removed row without a recorded reason as deleted', () => {
      expect(removalState({ removed: 1, removed_reason: null })).toBe(REMOVAL_STATES.DELETED);
      expect(removalState({ removed: 1 })).toBe(REMOVAL_STATES.DELETED);
    });
  });

  describe('removedColumns', () => {
    test('marks the row removed with the reason and a timestamp', () => {
      const columns = removedColumns(REMOVAL_REASONS.NOT_FOUND);
      expect(columns).toEqual({
        removed: true,
        removed_reason: 'not_found',
        removed_at: expect.any(Date),
        removed_detail: null,
      });
    });

    test('records the detail and timestamp it is given', () => {
      const at = new Date('2026-10-03T12:00:00Z');
      expect(removedColumns(REMOVAL_REASONS.AUTO_REMOVAL, { detail: 'older than 30 days', at })).toEqual({
        removed: true,
        removed_reason: 'auto_removal',
        removed_at: at,
        removed_detail: 'older than 30 days',
      });
    });

    test('rejects an unknown reason', () => {
      expect(() => removedColumns('bogus')).toThrow('Unknown removal reason: bogus');
    });
  });

  test('presentColumns clears the removed flag and every reason column', () => {
    expect(presentColumns()).toEqual({
      removed: false,
      removed_reason: null,
      removed_at: null,
      removed_detail: null,
    });
    expect(REMOVAL_COLUMNS).toEqual(['removed', 'removed_reason', 'removed_at', 'removed_detail']);
  });

  describe('stateWhere / notStateWhere', () => {
    test('missing is removed with the not_found reason', () => {
      expect(stateWhere('missing')).toEqual({ removed: true, removed_reason: 'not_found' });
      expect(notStateWhere('missing')).toEqual({
        [Op.or]: [
          { removed: false },
          { removed_reason: null },
          { removed_reason: { [Op.ne]: 'not_found' } },
        ],
      });
    });

    test('deleted is removed with any other reason, including none', () => {
      expect(stateWhere('deleted')).toEqual({
        removed: true,
        [Op.or]: [{ removed_reason: null }, { removed_reason: { [Op.ne]: 'not_found' } }],
      });
      expect(notStateWhere('deleted')).toEqual({
        [Op.or]: [{ removed: false }, { removed_reason: 'not_found' }],
      });
    });

    test('rejects a state that is not deleted or missing', () => {
      expect(() => stateWhere('present')).toThrow('Unknown removal state: present');
      expect(() => notStateWhere('bogus')).toThrow('Unknown removal state: bogus');
    });
  });
});
