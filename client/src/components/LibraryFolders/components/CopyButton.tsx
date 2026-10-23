import React from 'react';
import { Copy } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import { useLibraryPage } from '../LibraryFoldersContext';
import { COPY_FAILED_MESSAGE, copyText } from '../copyText';

export function CopyButton({ text, label = 'Copy path' }: { text: string; label?: string }) {
  const { phone, notify } = useLibraryPage();
  const copy = async () => {
    if (await copyText(text)) notify('Copied');
    else notify(COPY_FAILED_MESSAGE, 'error');
  };
  return (
    <button type="button" aria-label={label} onClick={() => { void copy(); }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-ui text-muted-foreground hover:bg-muted/40 hover:text-foreground',
        phone ? 'h-11 w-11' : 'h-[26px] w-[26px]')}>
      <Copy size={14} aria-hidden="true" />
    </button>
  );
}
