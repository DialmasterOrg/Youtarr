import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
  GITHUB_SPONSORS_URL,
  PATREON_URL,
  SupportLinkButtons,
} from '../SupportLinkButtons';

describe('SupportLinkButtons', () => {
  test('links to GitHub Sponsors in a new tab', () => {
    render(<SupportLinkButtons />);

    const link = screen.getByRole('link', { name: /github sponsors/i });
    expect(link).toHaveAttribute('href', GITHUB_SPONSORS_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('links to Patreon in a new tab', () => {
    render(<SupportLinkButtons />);

    const link = screen.getByRole('link', { name: /patreon/i });
    expect(link).toHaveAttribute('href', PATREON_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('reports a click on either link', async () => {
    const onLinkClick = jest.fn();
    const user = userEvent.setup();
    render(<SupportLinkButtons onLinkClick={onLinkClick} />);

    await user.click(screen.getByRole('link', { name: /github sponsors/i }));
    await user.click(screen.getByRole('link', { name: /patreon/i }));

    expect(onLinkClick).toHaveBeenCalledTimes(2);
  });
});
