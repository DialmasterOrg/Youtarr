import React from 'react';
import { ArrowLeft } from '../../../lib/icons';
import { Button } from '../../ui';
import type { LibraryFolder } from '../../../types/tvShows';
import { folderKey } from '../../../utils/libraryLayouts';
import { FolderInspector } from './FolderInspector';

/** The narrow layouts' folder screen: a back bar over the inspector at full column width (UI 6.3, 6.4). */
export function FolderDetailScreen({ folder, onBack }: { folder: LibraryFolder; onBack: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="flex h-[52px] items-center border-b border-border">
        <Button variant="text" startIcon={<ArrowLeft size={16} aria-hidden="true" />} onClick={onBack} className="min-h-[44px]">
          Library folders
        </Button>
      </div>
      <FolderInspector key={folderKey(folder.name) || '~main'} folder={folder} asPageTitle />
    </div>
  );
}
