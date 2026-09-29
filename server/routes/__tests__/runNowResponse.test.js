/* eslint-env jest */
const { sendRunBlocked, toRunNowState } = require('../runNowResponse');

function createResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('toRunNowState', () => {
  test('reports an available task', () => {
    expect(toRunNowState(null)).toEqual({ available: true, reason: null, message: null, availableAt: null });
  });

  test('serializes a blocker with its availability time', () => {
    const availableAt = new Date('2026-09-27T12:15:00.000Z');
    expect(toRunNowState({ reason: 'cooldown', message: 'This task ran recently.', availableAt })).toEqual({
      available: false, reason: 'cooldown', message: 'This task ran recently.', availableAt: '2026-09-27T12:15:00.000Z',
    });
  });
});

describe('sendRunBlocked', () => {
  test('answers 409 with the reason', () => {
    const res = createResponse();
    sendRunBlocked(res, { reason: 'running', message: 'This task is already running.', availableAt: null });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'This task is already running.', reason: 'running', availableAt: null });
  });

  test('answers 503 when the task is not registered yet', () => {
    const res = createResponse();
    sendRunBlocked(res, { reason: 'not-registered', message: 'x', availableAt: null });
    expect(res.status).toHaveBeenCalledWith(503);
  });

  test('uses a route-specific message when given one', () => {
    const res = createResponse();
    sendRunBlocked(res, { reason: 'running', message: 'generic', availableAt: null }, { running: 'Rescan already in progress' });
    expect(res.json).toHaveBeenCalledWith({ error: 'Rescan already in progress', reason: 'running', availableAt: null });
  });
});
