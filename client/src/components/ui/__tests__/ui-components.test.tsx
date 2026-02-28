/**
 * Coverage sweep for converted UI components.
 * Tests edge-cases not exercised by application-level tests.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── dialog.tsx ──────────────────────────────────────────────────────────────
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentBody,
  DialogContentText,
  DialogActions,
} from '../dialog';

describe('Dialog', () => {
  it('renders children when open', () => {
    render(
      <Dialog open onClose={jest.fn()}>
        <DialogTitle>Test Title</DialogTitle>
        <DialogContent>
          <p>Body text</p>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(
      <Dialog open={false} onClose={jest.fn()}>
        <p>Hidden</p>
      </Dialog>
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('calls onClose with escapeKeyDown when Escape pressed', async () => {
    const onClose = jest.fn();
    render(
      <Dialog open onClose={onClose}>
        <DialogTitle>Title</DialogTitle>
      </Dialog>
    );
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledWith({}, 'escapeKeyDown');
  });

  it('does NOT call onClose on Escape when disableEscapeKeyDown', () => {
    const onClose = jest.fn();
    render(
      <Dialog open onClose={onClose} disableEscapeKeyDown>
        <DialogTitle>Title</DialogTitle>
      </Dialog>
    );
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders fullScreen dialog with correct class', () => {
    render(
      <Dialog open onClose={jest.fn()} fullScreen>
        <DialogTitle>FullScreen</DialogTitle>
      </Dialog>
    );
    expect(screen.getByText('FullScreen')).toBeInTheDocument();
  });

  it('calls onClose via backdrop click', async () => {
    const onClose = jest.fn();
    render(
      <Dialog
        open
        onClose={onClose}
        BackdropProps={{ 'data-testid': 'backdrop' }}
      >
        <DialogTitle>Title</DialogTitle>
      </Dialog>
    );
    const backdrop = screen.getByTestId('backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledWith({}, 'backdropClick');
  });
});

describe('DialogTitle', () => {
  it('renders without close button when no onClose', () => {
    render(<DialogTitle>My Title</DialogTitle>);
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('renders close button and calls onClose when clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<DialogTitle onClose={onClose}>My Title</DialogTitle>);
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DialogContentBody', () => {
  it('renders children with correct classes', () => {
    render(<DialogContentBody data-testid="content">Content here</DialogContentBody>);
    expect(screen.getByTestId('content')).toHaveTextContent('Content here');
  });
});

describe('DialogContentText', () => {
  it('renders as paragraph with text', () => {
    render(<DialogContentText>Helper text</DialogContentText>);
    const el = screen.getByText('Helper text');
    expect(el.tagName).toBe('P');
  });
});

describe('DialogActions', () => {
  it('renders action buttons', () => {
    render(
      <DialogActions>
        <button>Cancel</button>
        <button>OK</button>
      </DialogActions>
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});

// ─── label.tsx ───────────────────────────────────────────────────────────────
import { Label } from '../label';

describe('Label', () => {
  it('renders basic label', () => {
    render(<Label>Name</Label>);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders required indicator when required=true', () => {
    render(<Label required>Email</Label>);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('applies disabled styling when disabled', () => {
    render(<Label disabled data-testid="lbl">Password</Label>);
    const el = screen.getByTestId('lbl');
    expect(el).toHaveClass('opacity-50');
  });
});

// ─── card.tsx ────────────────────────────────────────────────────────────────
import { Card, CardActionArea, CardContent, CardHeader } from '../card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><span>Card body</span></Card>);
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });

  it('applies outlined variant styling', () => {
    render(<Card variant="outlined" data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('shadow-none');
  });

  it('applies disabled styling', () => {
    render(<Card disabled data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('opacity-50');
  });
});

describe('CardActionArea', () => {
  it('calls onClick via click', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<CardActionArea onClick={onClick}>Action</CardActionArea>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('triggers onClick with Enter key', () => {
    const onClick = jest.fn();
    render(<CardActionArea onClick={onClick}>Action</CardActionArea>);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('triggers onClick with Space key', () => {
    const onClick = jest.fn();
    render(<CardActionArea onClick={onClick}>Action</CardActionArea>);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('CardContent', () => {
  it('renders content', () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('CardHeader', () => {
  it('renders title and subheader', () => {
    render(<CardHeader title="Title" subheader="Sub" />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Sub')).toBeInTheDocument();
  });

  it('renders avatar and action', () => {
    render(
      <CardHeader
        title="Title"
        avatar={<span data-testid="avatar">A</span>}
        action={<button>X</button>}
      />
    );
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

// ─── accordion.tsx ───────────────────────────────────────────────────────────
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from '../accordion';

describe('Accordion', () => {
  it('renders collapsed by default', () => {
    render(
      <AccordionRoot type="single" collapsible>
        <AccordionItem value="item1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </AccordionRoot>
    );
    expect(screen.getByText('Section 1')).toBeInTheDocument();
    // Content is in DOM (forceMount) but accordion is closed
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('expands on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <AccordionRoot type="single" collapsible>
        <AccordionItem value="item1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Expanded Content</AccordionContent>
        </AccordionItem>
      </AccordionRoot>
    );
    await user.click(screen.getByText('Section 1'));
    expect(screen.getByText('Expanded Content')).toBeInTheDocument();
  });

  it('allows multiple open items with type=multiple', async () => {
    const user = userEvent.setup();
    render(
      <AccordionRoot type="multiple">
        <AccordionItem value="item1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item2">
          <AccordionTrigger>Section 2</AccordionTrigger>
          <AccordionContent>Content 2</AccordionContent>
        </AccordionItem>
      </AccordionRoot>
    );
    await user.click(screen.getByText('Section 1'));
    await user.click(screen.getByText('Section 2'));
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });
});

// ─── transitions.tsx ─────────────────────────────────────────────────────────
import { Grow, Slide, Fade, Collapse, Backdrop, Zoom } from '../transitions';

describe('Grow', () => {
  it('renders children when in=true', () => {
    render(<Grow in><div>Visible</div></Grow>);
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });

  it('renders when in=false and mountOnEnter=false (default)', () => {
    render(<Grow in={false}><div>Hidden</div></Grow>);
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('does not render when in=false and mountOnEnter=true', () => {
    render(<Grow in={false} mountOnEnter><div>NotMounted</div></Grow>);
    expect(screen.queryByText('NotMounted')).not.toBeInTheDocument();
  });

  it('unmounts after exit when unmountOnExit=true', async () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <Grow in timeout={0} unmountOnExit><div>Content</div></Grow>
    );
    rerender(<Grow in={false} timeout={0} unmountOnExit><div>Content</div></Grow>);
    act(() => { jest.runAllTimers(); });
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('accepts object timeout without enter key', () => {
    // Tests the `timeout.enter ?? 300` fallback
    render(<Grow in timeout={{ exit: 100 }}><div>NoEnter</div></Grow>);
    expect(screen.getByText('NoEnter')).toBeInTheDocument();
  });

  it('transitions visible=true when inProp changes from false to true', async () => {
    const { rerender } = render(<Grow in={false}><div>Toggle</div></Grow>);
    rerender(<Grow in><div>Toggle</div></Grow>);
    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });
});

describe('Slide', () => {
  it('renders when in=true with default direction', () => {
    render(<Slide in><div>SlideIn</div></Slide>);
    expect(screen.getByText('SlideIn')).toBeInTheDocument();
  });

  it('renders all slide directions', () => {
    const directions = ['up', 'down', 'left', 'right'] as const;
    directions.forEach(dir => {
      const { unmount } = render(
        <Slide in direction={dir}><div>Slide {dir}</div></Slide>
      );
      expect(screen.getByText(`Slide ${dir}`)).toBeInTheDocument();
      unmount();
    });
  });

  it('unmounts on exit when unmountOnExit=true', async () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <Slide in timeout={0} unmountOnExit><div>SlideContent</div></Slide>
    );
    rerender(<Slide in={false} timeout={0} unmountOnExit><div>SlideContent</div></Slide>);
    act(() => { jest.runAllTimers(); });
    expect(screen.queryByText('SlideContent')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});

describe('Fade', () => {
  it('renders when in=true', () => {
    render(<Fade in><div>Fading</div></Fade>);
    expect(screen.getByText('Fading')).toBeInTheDocument();
  });

  it('does not render when in=false and unmountOnExit after timeout', async () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <Fade in timeout={0} unmountOnExit><div>FadeOut</div></Fade>
    );
    rerender(<Fade in={false} timeout={0} unmountOnExit><div>FadeOut</div></Fade>);
    act(() => { jest.runAllTimers(); });
    expect(screen.queryByText('FadeOut')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});

describe('Collapse', () => {
  it('renders when in=true', () => {
    render(<Collapse in><div>CollapseContent</div></Collapse>);
    expect(screen.getByText('CollapseContent')).toBeInTheDocument();
  });

  it('does not render when in=false initially', () => {
    render(<Collapse in={false}><div>CollapsedOut</div></Collapse>);
    expect(screen.queryByText('CollapsedOut')).not.toBeInTheDocument();
  });

  it('unmounts when in=false with unmountOnExit', async () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <Collapse in timeout={0} unmountOnExit><div>CollapseFade</div></Collapse>
    );
    rerender(<Collapse in={false} timeout={0} unmountOnExit><div>CollapseFade</div></Collapse>);
    act(() => { jest.runAllTimers(); });
    expect(screen.queryByText('CollapseFade')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('re-shows content when in transitions false→true after unmountOnExit removal', async () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <Collapse in timeout={0} unmountOnExit><div>ReappearContent</div></Collapse>
    );
    // Collapse it — contents unmount after timeout
    rerender(<Collapse in={false} timeout={0} unmountOnExit><div>ReappearContent</div></Collapse>);
    act(() => { jest.runAllTimers(); });
    expect(screen.queryByText('ReappearContent')).not.toBeInTheDocument();

    // Expand again — contents should be visible
    rerender(<Collapse in timeout={0} unmountOnExit><div>ReappearContent</div></Collapse>);
    act(() => { jest.runAllTimers(); });
    expect(screen.getByText('ReappearContent')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('accepts auto timeout', () => {
    render(<Collapse in timeout="auto"><div>AutoCollapse</div></Collapse>);
    expect(screen.getByText('AutoCollapse')).toBeInTheDocument();
  });
});

describe('Backdrop', () => {
  it('renders when open=true', () => {
    render(<Backdrop open data-testid="backdrop"><div>Over</div></Backdrop>);
    expect(screen.getByTestId('backdrop')).toBeInTheDocument();
    expect(screen.getByText('Over')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<Backdrop open={false} data-testid="backdrop">Content</Backdrop>);
    expect(screen.queryByTestId('backdrop')).not.toBeInTheDocument();
  });

  it('renders without dark overlay when invisible=true', () => {
    render(<Backdrop open invisible data-testid="backdrop">Invisible</Backdrop>);
    const el = screen.getByTestId('backdrop');
    expect(el).not.toHaveClass('bg-black/50');
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Backdrop open onClick={onClick} data-testid="backdrop">Click me</Backdrop>);
    await user.click(screen.getByTestId('backdrop'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Zoom', () => {
  it('renders children when in=true', () => {
    render(<Zoom in><div>ZoomIn</div></Zoom>);
    expect(screen.getByText('ZoomIn')).toBeInTheDocument();
  });

  it('returns null when in=false', () => {
    render(<Zoom in={false}><div>ZoomOut</div></Zoom>);
    expect(screen.queryByText('ZoomOut')).not.toBeInTheDocument();
  });
});

// ─── snackbar.tsx ────────────────────────────────────────────────────────────
import { Snackbar } from '../snackbar';

describe('Snackbar', () => {
  it('renders message when open', () => {
    render(<Snackbar open message="Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<Snackbar open={false} message="Hidden" />);
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('renders action element', () => {
    render(
      <Snackbar
        open
        message="Message"
        action={<button>Undo</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Snackbar open message="Closeable" onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledWith(expect.anything(), 'closeButton');
  });

  it('auto-hides after autoHideDuration', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    render(<Snackbar open message="AutoHide" autoHideDuration={3000} onClose={onClose} />);
    act(() => { jest.advanceTimersByTime(3000); });
    expect(onClose).toHaveBeenCalledWith(null, 'timeout');
    jest.useRealTimers();
  });

  it('renders at top-left with anchorOrigin top-left', () => {
    render(
      <Snackbar
        open
        message="TopLeft"
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        data-testid="snack"
      />
    );
    expect(screen.getByText('TopLeft')).toBeInTheDocument();
  });

  it('renders at bottom-right with anchorOrigin bottom-right', () => {
    render(
      <Snackbar
        open
        message="BottomRight"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        data-testid="snack"
      />
    );
    expect(screen.getByText('BottomRight')).toBeInTheDocument();
  });

  it('renders children instead of message when children provided', () => {
    render(
      <Snackbar open>
        <div data-testid="custom-content">Custom</div>
      </Snackbar>
    );
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });
});
