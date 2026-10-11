import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoPopover } from '../InfoPopover';
import { makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('InfoPopover', () => {
  test('keeps its text hidden until the button is pressed', async () => {
    renderInPage(<InfoPopover label="About video folders">Each video is a movie.</InfoPopover>);
    expect(screen.queryByText('Each video is a movie.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'About video folders' }));
    expect(screen.getByText('Each video is a movie.')).toBeInTheDocument();
  });

  test('announces whether it is open', async () => {
    renderInPage(<InfoPopover label="About video folders">Each video is a movie.</InfoPopover>);
    const button = screen.getByRole('button', { name: 'About video folders' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  test('pressing the button again closes it', async () => {
    renderInPage(<InfoPopover label="About video folders">Each video is a movie.</InfoPopover>);
    await userEvent.click(screen.getByRole('button', { name: 'About video folders' }));
    await userEvent.click(screen.getByRole('button', { name: 'About video folders' }));
    expect(screen.queryByText('Each video is a movie.')).not.toBeInTheDocument();
  });

  test('Escape closes it', async () => {
    renderInPage(<InfoPopover label="About video folders">Each video is a movie.</InfoPopover>);
    await userEvent.click(screen.getByRole('button', { name: 'About video folders' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Each video is a movie.')).not.toBeInTheDocument();
  });

  test('the check variant reads as a success', () => {
    renderInPage(<InfoPopover label="Matches the library that holds this folder." variant="check">Matches.</InfoPopover>);
    expect(screen.getByRole('button', { name: 'Matches the library that holds this folder.' })).toHaveClass('text-success');
  });

  test('phones get a 44px tap area around the small icon, so the line keeps its height', () => {
    renderInPage(<InfoPopover label="About video folders">Each video is a movie.</InfoPopover>, { value: makePageValue({ phone: true }) });
    expect(screen.getByRole('button', { name: 'About video folders' })).toHaveClass('h-[22px]', 'w-[22px]', 'before:-inset-[11px]');
  });
});
