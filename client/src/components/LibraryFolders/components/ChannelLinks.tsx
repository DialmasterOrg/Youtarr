import React, { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import { useLibraryPage } from '../LibraryFoldersContext';
import { countOf, SEP } from '../folderText';

const VISIBLE = 8;

export interface ChannelLink {
  channelId: string;
  name: string;
  videoCount?: number;
}

/** Channel page links, the first eight then "and N more" (UI 5.7.2, 5.7.4). Phones get 44px rows. */
export function ChannelLinks({ channels, unit }: { channels: ChannelLink[]; unit?: { one: string; many: string } }) {
  const { phone } = useLibraryPage();
  const [all, setAll] = useState(false);
  const shown = all ? channels : channels.slice(0, VISIBLE);
  const count = (channel: ChannelLink) => (unit && channel.videoCount !== undefined
    ? <span className="text-xs text-muted-foreground"> {countOf(channel.videoCount, unit.one, unit.many)}</span> : null);
  const more = !all && channels.length > VISIBLE
    ? <button type="button" onClick={() => setAll(true)} className={cn('text-primary underline', phone && 'min-h-[44px]')}>and {channels.length - VISIBLE} more</button>
    : null;
  if (phone) {
    return (
      <ul className="flex flex-col">
        {shown.map((channel) => (
          <li key={channel.channelId} className="flex min-h-[44px] items-center">
            <Link to={`/channel/${channel.channelId}`} className="text-primary">{channel.name}</Link>{count(channel)}
          </li>
        ))}
        {more && <li>{more}</li>}
      </ul>
    );
  }
  return (
    <span className="text-[13px]">
      {shown.map((channel, index) => (
        <Fragment key={channel.channelId}>
          {index > 0 && <span aria-hidden="true" className="text-muted-foreground/70">{SEP}</span>}
          <Link to={`/channel/${channel.channelId}`} className="text-primary">{channel.name}</Link>{count(channel)}
        </Fragment>
      ))}
      {more ? <> {more}</> : null}
    </span>
  );
}
