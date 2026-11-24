import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelGrantPicker from '../ChannelGrantPicker';
import type { ChannelListEntry } from '../../../../Subscriptions/hooks/useChannelList';

const channel = (id: number, title: string): ChannelListEntry => ({
  database_id: id,
  url: `https://www.youtube.com/channel/UC${id}`,
  channel_id: `UC${id}`,
  uploader: title,
  title,
  terminated_at: null,
});

const channels = [channel(1, 'Kids Science'), channel(2, 'Kids Art'), channel(3, 'Cooking')];

function Harness({ initialIds = [] }: { initialIds?: number[] }) {
  const [selectedIds, setSelectedIds] = useState<number[]>(initialIds);
  const [search, setSearch] = useState('');
  return (
    <>
      <ChannelGrantPicker
        channels={channels}
        selectedIds={selectedIds}
        search={search}
        onSearchChange={setSearch}
        onSelectedIdsChange={setSelectedIds}
      />
      <output aria-label="Selected ids">{selectedIds.join(',')}</output>
    </>
  );
}

describe('ChannelGrantPicker', () => {
  test('select all picks every channel when nothing is searched', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText('Select all approved channels'));

    expect(screen.getByLabelText('Selected ids')).toHaveTextContent('1,2,3');
  });

  test('select all picks only the channels the search shows', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Search channels'), 'kids');
    await user.click(screen.getByLabelText('Select all shown channels'));

    expect(screen.getByLabelText('Selected ids')).toHaveTextContent('1,2');
  });

  test('clearing select all keeps picks hidden by the search', async () => {
    const user = userEvent.setup();
    render(<Harness initialIds={[1, 2, 3]} />);

    await user.type(screen.getByLabelText('Search channels'), 'kids');
    await user.click(screen.getByLabelText('Select all shown channels'));

    expect(screen.getByLabelText('Selected ids')).toHaveTextContent(/^3$/);
  });

  test('hides select all when the search matches nothing', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Search channels'), 'nothing matches');

    expect(screen.queryByLabelText('Select all shown channels')).not.toBeInTheDocument();
  });
});
