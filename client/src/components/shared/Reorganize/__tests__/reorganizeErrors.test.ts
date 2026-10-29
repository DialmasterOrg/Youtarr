import {
  ReorganizeRequiredError, isReorganizeRequired, reorganizeChangeOf, serverCodeOf, serverMessageOf, toRequestError,
} from '../reorganizeErrors';

jest.mock('axios', () => ({
  isAxiosError: (err: unknown): boolean => typeof err === 'object' && err !== null && 'response' in err,
}));

const CHANGE = { type: 'folderLayout' as const, folder: 'Kids', layout: 'tv' as const };
const axiosError = (data: unknown) => ({ response: { status: 409, data } });

describe('reorganizeErrors', () => {
  test('reads the change to preview from a refusal body', () => {
    expect(reorganizeChangeOf({ error: 'Review', reorganizeRequired: true, change: CHANGE })).toEqual(CHANGE);
  });

  test('finds no change in other refusals', () => {
    expect(reorganizeChangeOf({ error: 'No' })).toBeNull();
    expect(reorganizeChangeOf(null)).toBeNull();
  });

  test('reads the server message and code of a request error', () => {
    const err = axiosError({ error: 'Stale', code: 'STALE_PREVIEW' });
    expect(serverMessageOf(err, 'fallback')).toBe('Stale');
    expect(serverCodeOf(err)).toBe('STALE_PREVIEW');
  });

  test('falls back for errors without a server message', () => {
    expect(serverMessageOf(new Error('network'), 'fallback')).toBe('fallback');
    expect(serverCodeOf(new Error('network'))).toBeNull();
  });

  test('turns a reorganize refusal into a ReorganizeRequiredError', () => {
    const err = toRequestError(axiosError({ error: 'Review the move', reorganizeRequired: true, change: CHANGE }), 'fallback');

    expect(isReorganizeRequired(err)).toBe(true);
    expect((err as ReorganizeRequiredError).change).toEqual(CHANGE);
    expect(err.message).toBe('Review the move');
  });

  test('turns any other refusal into a plain error', () => {
    const err = toRequestError(axiosError({ error: 'Nope' }), 'fallback');

    expect(isReorganizeRequired(err)).toBe(false);
    expect(err.message).toBe('Nope');
  });
});
