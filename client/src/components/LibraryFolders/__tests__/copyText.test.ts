import { copyText } from '../copyText';

describe('copyText', () => {
  afterEach(() => {
    Object.assign(navigator, { clipboard: undefined });
    Object.assign(document, { execCommand: undefined });
  });

  test('uses the clipboard API where it exists', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await expect(copyText('/yt/__Kids')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('/yt/__Kids');
  });

  test('falls back to a hidden textarea copy on plain HTTP, where the clipboard API is missing', async () => {
    const exec = jest.fn().mockReturnValue(true);
    Object.assign(document, { execCommand: exec });
    await expect(copyText('/yt/__Kids')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  test('falls back when the clipboard API refuses', async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
    Object.assign(document, { execCommand: jest.fn().mockReturnValue(true) });
    await expect(copyText('/yt')).resolves.toBe(true);
  });

  test('reports a failure when both ways fail', async () => {
    Object.assign(document, { execCommand: jest.fn().mockReturnValue(false) });
    await expect(copyText('/yt')).resolves.toBe(false);
  });

  test('reports a failure when the fallback throws', async () => {
    Object.assign(document, { execCommand: jest.fn(() => { throw new Error('unsupported'); }) });
    await expect(copyText('/yt')).resolves.toBe(false);
  });
});
