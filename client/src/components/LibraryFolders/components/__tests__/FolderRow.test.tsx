import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderRow } from '../FolderRow';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import type { ServerStatus } from '../../../../utils/libraryAttention';

const ok: ServerStatus = {
  serverType: 'plex', name: 'Plex', display: 'ok', word: 'YouTube',
  report: { serverType: 'plex', status: 'ok', issues: [], libraries: [{ id: '1', name: 'YouTube', type: 'videos', location: '/yt', relation: 'exact' }] },
};
const kids = folder('Kids', { isDefault: true, channels: 24, channelsChosen: 3, channelsFollowing: 21, fileCount: 1208 });

describe('FolderRow', () => {
  test('names the folder, its default chip, summary and server status', () => {
    renderInPage(<FolderRow folder={kids} statuses={[ok]} selected={false} wide moving={false} onSelect={jest.fn()} />);
    const row = screen.getByRole('button', { name: /__Kids/ });
    expect(row).toHaveTextContent('Default');
    expect(row).toHaveTextContent('3 chose this folder, 21 follow the default');
    expect(screen.getByText('Plex: OK, YouTube.')).toBeInTheDocument();
  });

  test('marks the selected row and selects on click', async () => {
    const onSelect = jest.fn();
    renderInPage(<FolderRow folder={kids} statuses={[ok]} selected wide moving onSelect={onSelect} />);
    const row = screen.getByRole('button', { name: /__Kids/ });
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(row).toHaveTextContent('Moving');
    await userEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith('Kids');
  });

  test('stacked rows show the status line with words', () => {
    renderInPage(<FolderRow folder={kids} statuses={[ok]} selected={false} wide={false} moving={false} onSelect={jest.fn()} />);
    expect(screen.getByRole('button', { name: /__Kids/ })).toHaveTextContent('PlexOK');
  });

  test('stacked rows show the chevron only where a row opens a detail screen', () => {
    const { unmount } = renderInPage(<FolderRow folder={kids} statuses={[ok]} selected={false} wide={false} moving={false} onSelect={jest.fn()} />,
      { value: makePageValue({ twoColumn: false }) });
    expect(screen.getByTestId('row-chevron')).toBeInTheDocument();
    unmount();
    renderInPage(<FolderRow folder={kids} statuses={[ok]} selected={false} wide={false} moving={false} onSelect={jest.fn()} />,
      { value: makePageValue({ twoColumn: true }) });
    expect(screen.queryByTestId('row-chevron')).not.toBeInTheDocument();
  });

  test('points aria-controls at the inspector only in two columns', () => {
    const { unmount } = renderInPage(<FolderRow folder={kids} statuses={[ok]} selected={false} wide moving={false} onSelect={jest.fn()} />, { value: makePageValue({ twoColumn: true }) });
    expect(screen.getByRole('button', { name: /__Kids/ })).toHaveAttribute('aria-controls', 'library-inspector');
    unmount();
    renderInPage(<FolderRow folder={kids} statuses={[ok]} selected={false} wide moving={false} onSelect={jest.fn()} />, { value: makePageValue({ twoColumn: false }) });
    expect(screen.getByRole('button', { name: /__Kids/ })).not.toHaveAttribute('aria-controls');
  });
});
