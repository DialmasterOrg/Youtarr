import React, { createRef } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InspectorHeader } from '../InspectorHeader';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('InspectorHeader', () => {
  test('shows the full path and offers Make default', async () => {
    const value = makePageValue();
    const kids = folder('Kids');
    renderInPage(<InspectorHeader folder={kids} headingRef={createRef()} asPageTitle={false} />, { value });
    expect(screen.getByRole('heading', { level: 2, name: '__Kids' })).toBeInTheDocument();
    expect(screen.getByText('/usr/src/app/data/__Kids')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make default' }));
    expect(value.openMakeDefault).toHaveBeenCalledWith(kids);
  });

  test('Make default waits for a running reorganize', () => {
    renderInPage(<InspectorHeader folder={folder('Kids')} headingRef={createRef()} asPageTitle={false} />, { value: makePageValue({ reorganizing: true }) });
    expect(screen.getByRole('button', { name: 'Make default' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Make default' })).toHaveAccessibleDescription('Downloads are being reorganized. Change the default folder when that finishes.');
  });

  test('the overflow menu copies the path', async () => {
    const value = makePageValue();
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
    renderInPage(<InspectorHeader folder={folder('', { isDefault: true })} headingRef={createRef()} asPageTitle />, { value });
    expect(screen.getByRole('heading', { level: 1, name: 'Main folder' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make default' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Main folder' }));
    await userEvent.click(screen.getByText('Copy full path'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/usr/src/app/data');
  });

  test('Copy full path works on plain HTTP, where the clipboard API is missing', async () => {
    const value = makePageValue();
    Object.assign(navigator, { clipboard: undefined });
    const exec = jest.fn().mockReturnValue(true);
    Object.assign(document, { execCommand: exec });
    renderInPage(<InspectorHeader folder={folder('Kids')} headingRef={createRef()} asPageTitle={false} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'More actions for __Kids' }));
    await userEvent.click(screen.getByText('Copy full path'));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(value.notify).toHaveBeenCalledWith('Copied');
  });

  test('a failed Copy full path is reported as an error', async () => {
    const value = makePageValue();
    Object.assign(navigator, { clipboard: undefined });
    Object.assign(document, { execCommand: jest.fn().mockReturnValue(false) });
    renderInPage(<InspectorHeader folder={folder('Kids')} headingRef={createRef()} asPageTitle={false} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'More actions for __Kids' }));
    await userEvent.click(screen.getByText('Copy full path'));
    expect(value.notify).toHaveBeenCalledWith("Couldn't copy to the clipboard", 'error');
  });

  test('the overflow button announces a menu', () => {
    renderInPage(<InspectorHeader folder={folder('Kids')} headingRef={createRef()} asPageTitle={false} />);
    expect(screen.getByRole('button', { name: 'More actions for __Kids' })).toHaveAttribute('aria-haspopup', 'menu');
  });
});
