import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyButton } from '../CopyButton';
import { makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('CopyButton', () => {
  test('copies its text and confirms', async () => {
    const value = makePageValue();
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
    renderInPage(<CopyButton text="/yt/__Kids" label="Copy folder" />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Copy folder' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/yt/__Kids');
    expect(value.notify).toHaveBeenCalledWith('Copied');
  });

  test('says so, as an error, when the clipboard refuses', async () => {
    const value = makePageValue();
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
    renderInPage(<CopyButton text="/yt" />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    expect(value.notify).toHaveBeenCalledWith("Couldn't copy to the clipboard", 'error');
  });

  test('falls back to a hidden textarea copy where the clipboard API is missing', async () => {
    const value = makePageValue();
    Object.assign(navigator, { clipboard: undefined });
    const exec = jest.fn().mockReturnValue(true);
    Object.assign(document, { execCommand: exec });
    renderInPage(<CopyButton text="/yt/__Kids" />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(value.notify).toHaveBeenCalledWith('Copied');
  });

  test('reports a failure, as an error, when the fallback copy fails too', async () => {
    const value = makePageValue();
    Object.assign(navigator, { clipboard: undefined });
    Object.assign(document, { execCommand: jest.fn().mockReturnValue(false) });
    renderInPage(<CopyButton text="/yt" />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    expect(value.notify).toHaveBeenCalledWith("Couldn't copy to the clipboard", 'error');
  });
});
