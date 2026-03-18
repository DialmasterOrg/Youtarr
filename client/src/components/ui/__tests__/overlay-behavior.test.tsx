import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu, MenuItem as PlainMenuItem } from '../menu';
import { Select, MenuItem } from '../select';
import { Tooltip } from '../tooltip';
import { Dialog, DialogTitle, DialogContent } from '../dialog';

function mockAnchorRect(rect: Partial<DOMRect>) {
  return {
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('overlay positioning guards', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--app-shell-overlay-top-offset-px', '60');
    document.documentElement.style.setProperty('--mobile-nav-total-offset-px', '112');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--app-shell-overlay-top-offset-px');
    document.documentElement.style.removeProperty('--mobile-nav-total-offset-px');
  });

  test('menu opening downward clamps height above the bottom nav area', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() => mockAnchorRect({ left: 40, right: 160, bottom: 300, width: 120, height: 40 }));

    render(
      <Menu open anchorEl={anchor} onClose={jest.fn()}>
        <PlainMenuItem>First</PlainMenuItem>
      </Menu>
    );

    expect(screen.getByRole('menu').style.maxHeight).toBe('468px');
  });

  test('menu opening upward clamps height below the header area', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() => mockAnchorRect({ top: 620, left: 40, right: 160, width: 120, height: 40 }));

    render(
      <Menu
        open
        anchorEl={anchor}
        onClose={jest.fn()}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <PlainMenuItem>First</PlainMenuItem>
      </Menu>
    );

    expect(screen.getByRole('menu').style.maxHeight).toBe('552px');
  });

  test('select content uses trigger min width and viewport-safe max height', async () => {
    render(
      <Select value="PG" onChange={jest.fn()}>
        <MenuItem value="G">G - General Audiences</MenuItem>
        <MenuItem value="PG">PG - Parental Guidance Suggested</MenuItem>
      </Select>
    );

    fireEvent.mouseDown(screen.getByRole('button', { name: /Parental Guidance Suggested/i }));

    expect(await screen.findByRole('option', { name: /Parental Guidance Suggested/i })).toBeInTheDocument();

    const content = document.body.querySelector('[data-radix-popper-content-wrapper] > div') as HTMLElement | null;
    expect(content).not.toBeNull();
    expect(content?.style.minWidth).toBe('var(--radix-select-trigger-width)');
    expect(content?.style.maxWidth).toBe('min(28rem, calc(100vw - 24px))');
    expect(content?.style.maxHeight).toBe('min(var(--radix-select-content-available-height), calc(100dvh - var(--app-shell-overlay-top-offset, 0px) - var(--mobile-nav-total-offset, 0px) - 16px))');
  });

  test('select content renders above dialog content when opened inside a modal', async () => {
    render(
      <Dialog open onClose={jest.fn()}>
        <DialogTitle>Dialog title</DialogTitle>
        <DialogContent>
          <Select value="PG" onChange={jest.fn()}>
            <MenuItem value="G">G</MenuItem>
            <MenuItem value="PG">PG</MenuItem>
          </Select>
        </DialogContent>
      </Dialog>
    );

    fireEvent.mouseDown(screen.getByRole('button', { name: 'PG' }));

    expect(await screen.findByRole('option', { name: 'PG' })).toBeInTheDocument();

    const content = document.body.querySelector('[data-radix-popper-content-wrapper] > div') as HTMLElement | null;
    expect(content?.style.zIndex).toBe('1470');
  });
});

describe('mobile tooltip interactions', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    document.documentElement.style.setProperty('--app-shell-overlay-top-offset-px', '60');
    document.documentElement.style.setProperty('--mobile-nav-total-offset-px', '112');
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--app-shell-overlay-top-offset-px');
    document.documentElement.style.removeProperty('--mobile-nav-total-offset-px');
    window.matchMedia = originalMatchMedia;
  });

  test('shows on tap and closes on outside tap for coarse pointers', async () => {
    const user = userEvent.setup();

    render(
      <Tooltip title="Tooltip body">
        <button type="button">Info</button>
      </Tooltip>
    );

    await user.click(screen.getByRole('button', { name: 'Info' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Tooltip body');

    await user.click(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('clamps coarse-pointer tooltip within viewport gutters', async () => {
    const user = userEvent.setup();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });

    render(
      <Tooltip title="Tooltip body">
        <button
          type="button"
          ref={(node) => {
            if (node) {
              node.getBoundingClientRect = jest.fn(() => mockAnchorRect({ left: 8, top: 80, right: 40, bottom: 112, width: 32, height: 32 }));
            }
          }}
        >
          Edge
        </button>
      </Tooltip>
    );

    await user.click(screen.getByRole('button', { name: 'Edge' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.style.left).toBe('12px');
    expect(Number.parseFloat(tooltip.style.top)).toBeGreaterThanOrEqual(72);
  });
});