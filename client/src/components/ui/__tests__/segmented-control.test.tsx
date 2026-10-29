import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from '../segmented-control';

const options = [{ value: 'videos', label: 'Videos' }, { value: 'tv', label: 'TV shows' }];

describe('SegmentedControl', () => {
  test('is a radio group with the value checked', () => {
    render(<SegmentedControl aria-label="Preview Kids as" value="videos" onChange={jest.fn()} options={options} />);
    expect(screen.getByRole('radiogroup', { name: 'Preview Kids as' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Videos' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'TV shows' })).toHaveAttribute('aria-checked', 'false');
  });

  test('reports a new value and ignores clicking the checked one', async () => {
    const onChange = jest.fn();
    render(<SegmentedControl aria-label="Layout" value="videos" onChange={onChange} options={options} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Videos' }));
    await userEvent.click(screen.getByRole('radio', { name: 'TV shows' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('tv');
  });

  test('arrow keys move between options', async () => {
    render(<SegmentedControl aria-label="Layout" value="videos" onChange={jest.fn()} options={options} />);
    act(() => { screen.getByRole('radio', { name: 'Videos' }).focus(); });

    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'TV shows' })).toHaveFocus();
  });
});
