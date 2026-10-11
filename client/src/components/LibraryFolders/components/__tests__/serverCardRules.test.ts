import { folder } from '../../__tests__/renderPage';
import { rendersAsLine, rendersAsRow, showsPlexControl } from '../serverCardRules';
import type { ServerStatus } from '../../../../utils/libraryAttention';

const status = (display: ServerStatus['display'], report: ServerStatus['report']): ServerStatus => ({
  serverType: 'plex', name: 'Plex', display, word: '', report,
});
const report = { serverType: 'plex' as const, status: 'ok' as const, libraries: [], issues: [] };

describe('serverCardRules', () => {
  test('a server without a report renders as a line', () => {
    expect(rendersAsLine(status('unchecked', null))).toBe(true);
  });

  test('a server with issues renders as a card', () => {
    expect(rendersAsLine(status('issues', report))).toBe(false);
  });

  test('a server that is fine takes a row', () => {
    expect(rendersAsRow(status('ok', report))).toBe(true);
  });

  test('a server that only lacks a check takes a row', () => {
    expect(rendersAsRow(status('unchecked', null))).toBe(true);
  });

  test('a server with issues keeps its card', () => {
    expect(rendersAsRow(status('issues', { ...report, status: 'warning', issues: [{ code: 'nfoSaver', message: 'x', libraryId: '1' }] }))).toBe(false);
  });

  test('a folder missing its library keeps the card', () => {
    expect(rendersAsRow(status('noLibrary', { ...report, status: 'missing' }))).toBe(false);
  });

  test('the Plex control shows for a folder that needs a library', () => {
    expect(showsPlexControl(folder('Kids', { channels: 1 }))).toBe(true);
  });

  test('the Plex control shows for an unused folder that has a mapping', () => {
    expect(showsPlexControl(folder('Empty', { plexMapping: { choice: 'default', libraryId: null } }))).toBe(true);
  });

  test('the Plex control is hidden for an unused folder without a mapping', () => {
    expect(showsPlexControl(folder('Empty'))).toBe(false);
  });
});
