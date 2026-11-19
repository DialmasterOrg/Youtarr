import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerLine } from '../ServerLine';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('ServerLine', () => {
  test('an unreachable server offers Check again', async () => {
    const value = makePageValue();
    renderInPage(<ServerLine folder={folder('Kids', { channels: 1 })} status={{
      serverType: 'plex', name: 'Plex', display: 'unchecked', word: 'Not checked',
      report: { serverType: 'plex', status: 'unreachable', libraries: [], issues: [] },
    }} />, { value });
    expect(screen.getByText(": couldn't be reached, so this folder wasn't checked.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(value.check.refetch).toHaveBeenCalled();
  });

  test('an unused folder is fine without a library', () => {
    renderInPage(<ServerLine folder={folder('Empty')} status={{ serverType: 'emby', name: 'Emby', display: 'fine', word: 'No library', report: null }} />);
    expect(screen.getByText(': not in a library. Fine while nothing downloads here.')).toBeInTheDocument();
  });
});
