import React from 'react';
import { useLibraryPage } from '../LibraryFoldersContext';

/** h3 inside the two-column inspector (its title is the h2), h2 on a detail screen (its title is the h1). */
export function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  const { twoColumn } = useLibraryPage();
  const Tag = twoColumn ? 'h3' : 'h2';
  return <Tag id={id} className={twoColumn ? 'font-display text-[15px] font-semibold' : 'font-display text-[17px] font-semibold'}>{children}</Tag>;
}
