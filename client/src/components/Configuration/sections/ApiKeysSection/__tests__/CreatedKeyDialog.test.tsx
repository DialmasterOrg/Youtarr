import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreatedKeyDialog, { generateBookmarklet } from '../CreatedKeyDialog';

const createdKey = {
  success: true,
  message: '',
  id: 3,
  name: 'Laptop browser',
  key: 'abc12345def67890',
  prefix: 'abc12345',
};

const renderDialog = (overrides: Partial<React.ComponentProps<typeof CreatedKeyDialog>> = {}) => {
  const props = {
    open: true,
    createdKey,
    role: 'legacy_download' as const,
    action: 'created' as const,
    onClose: jest.fn(),
    onCopy: jest.fn(),
    ...overrides,
  };
  render(<CreatedKeyDialog {...props} />);
  return props;
};

describe('generateBookmarklet', () => {
  test('embeds the key and posts to the download endpoint', () => {
    const code = generateBookmarklet('my-key');

    expect(code).toContain("var k='my-key'");
  });
});

describe('CreatedKeyDialog', () => {
  test('shows the draggable bookmarklet for a bookmarklet key', () => {
    renderDialog();

    expect(screen.getByText(/Send to Youtarr/)).toHaveAttribute('href', generateBookmarklet(createdKey.key));
  });

  test('shows phone shortcut details for a bookmarklet key', () => {
    renderDialog();

    expect(screen.getByText('Mobile / Shortcuts', { exact: false })).toBeInTheDocument();
  });

  test('points an external key at the versioned API instead of the bookmarklet', () => {
    renderDialog({ role: 'view' });

    expect(screen.queryByText(/Send to Youtarr/)).not.toBeInTheDocument();
  });

  test('copies the bookmarklet code', async () => {
    const { onCopy } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Copy bookmarklet code' }));

    expect(onCopy).toHaveBeenCalledWith(generateBookmarklet(createdKey.key), 'Bookmarklet');
  });

  test('titles a regenerated key', () => {
    renderDialog({ action: 'regenerated', role: 'view' });

    expect(screen.getByText(/API Key Regenerated/)).toBeInTheDocument();
  });
});
