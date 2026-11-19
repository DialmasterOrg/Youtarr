import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChannelShowFilter from '../ChannelShowFilter';

const SHOWS = [{ id: 3, name: 'Beyblade' }, { id: 4, name: 'Clips' }];

describe('ChannelShowFilter', () => {
  test('renders nothing for a channel without shows', () => {
    const { container } = render(<ChannelShowFilter shows={[]} value={null} onChange={jest.fn()} onShowMissing={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('offers the missing episodes of the chosen show', () => {
    const onShowMissing = jest.fn();
    render(<ChannelShowFilter shows={SHOWS} value={4} onChange={jest.fn()} onShowMissing={onShowMissing} />);
    fireEvent.click(screen.getByRole('button', { name: 'Missing episodes' }));
    expect(onShowMissing).toHaveBeenCalledWith(4);
  });

  test('offers no missing episodes while every video is listed', () => {
    render(<ChannelShowFilter shows={SHOWS} value={null} onChange={jest.fn()} onShowMissing={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Missing episodes' })).not.toBeInTheDocument();
  });
});
