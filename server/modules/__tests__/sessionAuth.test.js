/* eslint-env jest */

const mockOp = { gt: Symbol('gt') };

jest.mock('../../db', () => ({
  Session: { findOne: jest.fn() },
  Sequelize: { Op: mockOp },
}));

describe('sessionAuth.findActiveSession', () => {
  let sessionAuth;
  let db;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    db = require('../../db');
    sessionAuth = require('../sessionAuth');
  });

  test('returns null without a database lookup when no token is given', async () => {
    await expect(sessionAuth.findActiveSession(undefined)).resolves.toBeNull();
    await expect(sessionAuth.findActiveSession('')).resolves.toBeNull();
    expect(db.Session.findOne).not.toHaveBeenCalled();
  });

  test('looks up only active, unexpired sessions for the token', async () => {
    db.Session.findOne.mockResolvedValue(null);

    await sessionAuth.findActiveSession('abc');

    const { where } = db.Session.findOne.mock.calls[0][0];
    expect(where.session_token).toBe('abc');
    expect(where.is_active).toBe(true);
    expect(where.expires_at[mockOp.gt]).toBeInstanceOf(Date);
  });

  test('returns the matching session', async () => {
    const session = { id: 7, username: 'admin' };
    db.Session.findOne.mockResolvedValue(session);

    await expect(sessionAuth.findActiveSession('abc')).resolves.toBe(session);
  });

  test('propagates database errors', async () => {
    db.Session.findOne.mockRejectedValue(new Error('db down'));

    await expect(sessionAuth.findActiveSession('abc')).rejects.toThrow('db down');
  });
});
