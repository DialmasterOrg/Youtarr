import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PatternRow from '../PatternRow';
import { TitlePatternDraft } from '../../../../../types/titleShows';

const PATTERN: TitlePatternDraft = {
  text: 'BEYBLADE EN Episode {episode}: {title}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title',
};

function renderRow(props: Partial<React.ComponentProps<typeof PatternRow>> = {}) {
  const onChange = jest.fn();
  const onRemove = jest.fn();
  const onMove = jest.fn();
  render(
    <PatternRow
      index={0}
      count={2}
      pattern={PATTERN}
      compiledRegex={'(?i)BEYBLADE\\s+EN'}
      onChange={onChange}
      onRemove={onRemove}
      onMove={onMove}
      {...props}
    />
  );
  return { onChange, onRemove, onMove };
}

describe('PatternRow', () => {
  test('edits the pattern text', () => {
    const { onChange } = renderRow();
    fireEvent.change(screen.getByLabelText('Pattern 1'), { target: { value: 'Ep {episode}' } });
    expect(onChange).toHaveBeenCalledWith({ ...PATTERN, text: 'Ep {episode}' });
  });

  test.each([
    ['simple', PATTERN],
    ['regex', { ...PATTERN, kind: 'regex' as const, text: '(?i)BEYBLADE\\s+EN' }],
  ])('styles the %s pattern input like the row\'s other text fields', (_mode, pattern) => {
    renderRow({ pattern });
    const fieldClasses = screen.getByLabelText('Season number').className.split(' ');
    expect(screen.getByLabelText('Pattern 1')).toHaveClass(...fieldClasses);
  });

  test('switches to regex mode with the compiled pattern', () => {
    const { onChange } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Edit as regular expression' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: 'regex', text: '(?i)BEYBLADE\\s+EN' }));
  });

  test('keeps the simple text for the way back', () => {
    const { onChange } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Edit as regular expression' }));
    expect(onChange.mock.calls[0][0].simpleText).toBe(PATTERN.text);
  });

  test('switches back to the simple text it started from', () => {
    const { onChange } = renderRow({ pattern: { ...PATTERN, kind: 'regex', text: '(?i)BEYBLADE\\s+EN', simpleText: PATTERN.text } });
    fireEvent.click(screen.getByRole('button', { name: 'Use the simple syntax' }));
    expect(onChange).toHaveBeenCalledWith({ ...PATTERN, simpleText: undefined });
  });

  test('offers regex mode only once the preview has compiled the current text', () => {
    renderRow({ compiledRegex: null });
    expect(screen.getByRole('button', { name: 'Edit as regular expression' })).toBeDisabled();
  });

  test('keeps a saved regex for the way back when it switches to the simple syntax', () => {
    const { onChange } = renderRow({ pattern: { ...PATTERN, kind: 'regex', text: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use the simple syntax' }));
    expect(onChange).toHaveBeenCalledWith({ ...PATTERN, kind: 'simple', text: 'x', simpleText: undefined, regexText: 'x' });
  });

  test('restores the saved regex without a compiled preview', () => {
    const { onChange } = renderRow({ pattern: { ...PATTERN, text: 'x', regexText: 'x' }, compiledRegex: null });
    const button = screen.getByRole('button', { name: 'Edit as regular expression' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({ ...PATTERN, kind: 'regex', text: 'x', regexText: undefined });
  });

  test('forgets the saved regex once the simple text is edited', () => {
    const { onChange } = renderRow({ pattern: { ...PATTERN, text: 'x', regexText: 'x' } });
    fireEvent.change(screen.getByLabelText('Pattern 1'), { target: { value: 'Ep {episode}' } });
    expect(onChange).toHaveBeenCalledWith({ ...PATTERN, text: 'Ep {episode}', regexText: undefined });
  });

  test('sets a fixed season number', () => {
    const { onChange } = renderRow();
    fireEvent.change(screen.getByLabelText('Season number'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ ...PATTERN, seasonFixed: 2 });
  });

  test('hides the season number for a season taken from the title', () => {
    renderRow({ pattern: { ...PATTERN, seasonSource: 'title' } });
    expect(screen.queryByLabelText('Season number')).not.toBeInTheDocument();
  });

  test('removes the pattern', () => {
    const { onRemove } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Remove pattern 1' }));
    expect(onRemove).toHaveBeenCalled();
  });

  test('moves the pattern down but not up from the top', () => {
    const { onMove } = renderRow();
    expect(screen.getByRole('button', { name: 'Move pattern 1 up' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move pattern 1 down' }));
    expect(onMove).toHaveBeenCalledWith(1);
  });
});
