import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu, Popover, MenuItem as PlainMenuItem } from '../menu';
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
  let anchor: HTMLButtonElement | null = null;

  beforeEach(() => {
    document.documentElement.style.setProperty('--app-shell-overlay-top-offset-px', '60');
    document.documentElement.style.setProperty('--mobile-nav-total-offset-px', '112');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--app-shell-overlay-top-offset-px');
    document.documentElement.style.removeProperty('--mobile-nav-total-offset-px');
    anchor?.remove();
    anchor = null;
  });

  test('menu opening downward clamps height above the bottom nav area', () => {
    anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() => mockAnchorRect({ left: 40, right: 160, bottom: 300, width: 120, height: 40 }));

    render(
      <Menu open anchorEl={anchor} onClose={jest.fn()}>
        <PlainMenuItem>First</PlainMenuItem>
      </Menu>
    );

    expect(screen.getByRole('menu').style.maxHeight).toBe('468px');
  });

  test('menu with tall content stays anchored below the button when a PaperProps maxHeight is set', async () => {
    anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() =>
      mockAnchorRect({ top: 200, left: 40, right: 160, bottom: 236, width: 120, height: 36 })
    );

    render(
      <Menu
        open
        anchorEl={anchor}
        onClose={jest.fn()}
        PaperProps={{ style: { maxHeight: 400, width: 300 } }}
      >
        <PlainMenuItem>First</PlainMenuItem>
      </Menu>
    );

    const menu = screen.getByRole('menu');
    // Simulate tall natural content (hundreds of channels) that exceeds the viewport.
    // Without capping the measured height at PaperProps.maxHeight, the placement
    // math's clamp would pin the menu to viewportTop.
    Object.defineProperty(menu, 'scrollHeight', { configurable: true, value: 1500 });
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(Number.parseFloat(menu.style.top)).toBeGreaterThan(200);
    });
  });

  test('menu flips above the anchor before it would render off screen', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });

    anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() => mockAnchorRect({ top: 660, left: 700, right: 760, bottom: 700, width: 60, height: 40 }));

    render(
      <Menu
        open
        anchorEl={anchor}
        onClose={jest.fn()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ style: { width: '240px', height: '180px' } }}
      >
        <PlainMenuItem>First</PlainMenuItem>
      </Menu>
    );

    const menu = screen.getByRole('menu');

    await waitFor(() => {
      expect(menu).toHaveStyle({ top: '476px', left: '520px' });
    });

    expect(menu).toHaveStyle({ visibility: 'visible' });
  });

  test('menu opening upward clamps height below the header area', () => {
    anchor = document.createElement('button');
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

    expect(screen.getByRole('menu').style.maxHeight).toBe('544px');
  });

  // A transformed ancestor (a Card's hover lift) becomes the containing block
  // for position: fixed descendants, so these overlays must not render inside it.
  test('menu renders outside its parent so a transformed ancestor cannot offset it', () => {
    anchor = document.createElement('button');
    document.body.appendChild(anchor);

    render(
      <div data-testid="transformed-card" style={{ transform: 'translateY(-2px)' }}>
        <Menu open anchorEl={anchor} onClose={jest.fn()}>
          <PlainMenuItem>First</PlainMenuItem>
        </Menu>
      </div>
    );

    const card = within(screen.getByTestId('transformed-card'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(card.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('menu-backdrop')).toBeInTheDocument();
    expect(card.queryByTestId('menu-backdrop')).not.toBeInTheDocument();
  });

  test('popover renders outside its parent so a transformed ancestor cannot offset it', () => {
    anchor = document.createElement('button');
    document.body.appendChild(anchor);

    render(
      <div data-testid="transformed-card" style={{ transform: 'translateY(-2px)' }}>
        <Popover open anchorEl={anchor} onClose={jest.fn()}>
          Popover body
        </Popover>
      </div>
    );

    expect(screen.getByText('Popover body')).toBeInTheDocument();
    expect(within(screen.getByTestId('transformed-card')).queryByText('Popover body')).not.toBeInTheDocument();
  });

  test('popover opens below its anchor when the content fits there', async () => {
    anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() => mockAnchorRect({ top: 200, left: 40, right: 80, bottom: 240, width: 40, height: 40 }));

    render(<Popover open anchorEl={anchor} onClose={jest.fn()}>Popover body</Popover>);

    const popover = screen.getByText('Popover body');
    Object.defineProperty(popover, 'scrollHeight', { configurable: true, value: 200 });
    fireEvent.scroll(window);

    await waitFor(() => expect(popover).toHaveStyle({ top: '244px', maxHeight: '528px' }));
  });

  // Near the bottom of the screen the space below is a few pixels tall, and the
  // content scrolled inside it.
  test('popover opens above its anchor when the content does not fit below', async () => {
    anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() => mockAnchorRect({ top: 700, left: 40, right: 80, bottom: 740, width: 40, height: 40 }));

    render(<Popover open anchorEl={anchor} onClose={jest.fn()}>Popover body</Popover>);

    const popover = screen.getByText('Popover body');
    Object.defineProperty(popover, 'scrollHeight', { configurable: true, value: 200 });
    fireEvent.scroll(window);

    await waitFor(() => expect(popover).toHaveStyle({ top: '496px', maxHeight: '624px' }));
  });

  // window.innerWidth includes a classic scrollbar, which a fixed element cannot
  // use. Placed against it, the popover was squeezed a few pixels, and each new
  // measurement moved it right and squeezed it again until it was a strip.
  test('popover shifted left stays inside the width the page can use', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 385 });
    anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() => mockAnchorRect({ top: 200, left: 350, right: 380, bottom: 240, width: 30, height: 40 }));

    render(<Popover open anchorEl={anchor} onClose={jest.fn()}>Popover body</Popover>);
    const popover = screen.getByText('Popover body');
    popover.getBoundingClientRect = jest.fn(() => mockAnchorRect({ width: 200 }));
    fireEvent.scroll(window);

    await waitFor(() => expect(popover).toHaveStyle({ left: '173px' }));
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 0 });
  });

  // Opened above, its top edge came from the height it had then; content that
  // arrived later grew down over the button.
  test('popover placed above its anchor moves up when its content grows', async () => {
    const originalResizeObserver = window.ResizeObserver;
    let contentResized: () => void = () => {};
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        contentResized = () => callback([], this);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = jest.fn(() => mockAnchorRect({ top: 700, left: 40, right: 80, bottom: 740, width: 40, height: 40 }));

    render(<Popover open anchorEl={anchor} onClose={jest.fn()}>Popover body</Popover>);
    const popover = screen.getByText('Popover body');
    Object.defineProperty(popover, 'scrollHeight', { configurable: true, value: 200 });
    act(() => contentResized());
    expect(popover).toHaveStyle({ top: '496px' });

    Object.defineProperty(popover, 'scrollHeight', { configurable: true, value: 300 });
    act(() => contentResized());

    expect(popover).toHaveStyle({ top: '396px' });
    window.ResizeObserver = originalResizeObserver;
  });

  test('portaled menu still closes when its backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    anchor = document.createElement('button');
    document.body.appendChild(anchor);

    render(
      <Menu open anchorEl={anchor} onClose={onClose}>
        <PlainMenuItem>First</PlainMenuItem>
      </Menu>
    );

    await user.click(screen.getByTestId('menu-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
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

    const content = screen.getByTestId('select-content');
    expect(content).not.toBeNull();
    expect(content).toHaveStyle({ minWidth: 'var(--radix-select-trigger-width)' });
    expect(content).toHaveStyle({ maxWidth: 'min(28rem, calc(100vw - 24px))' });
    expect(content).toHaveStyle({ maxHeight: 'min(var(--radix-select-content-available-height), calc(100dvh - var(--app-shell-overlay-top-offset, 0px) - var(--mobile-nav-total-offset, 0px) - 16px))' });
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

    const content = screen.getByTestId('select-content');
    expect(content).toHaveStyle({ zIndex: '1470' });
  });
});

// A touchscreen laptop reports its trackpad as the main pointer, so the pointer
// media query cannot tell that a finger was used.
describe('tooltip on a device with both a mouse and a touchscreen', () => {
  test('shows on a finger tap', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip title="Tooltip body">
        <button type="button">Info</button>
      </Tooltip>
    );

    await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Info' }) });

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Tooltip body');
  });

  test('a mouse click does not pin the tooltip open', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip title="Tooltip body">
        <button type="button">Info</button>
      </Tooltip>
    );

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button', { name: 'Info' }) });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Info' })).toHaveAccessibleDescription('Tooltip body');

    await user.click(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('closes when focus moves elsewhere, as it does when the tapped button opens a dialog', async () => {
    const user = userEvent.setup();

    render(
      <>
        <Tooltip title="Tooltip body">
          <button type="button">Remove</button>
        </Tooltip>
        <button type="button">Cancel</button>
      </>
    );

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'Cancel' }).focus());
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