import React from 'react';
import { Chip } from '../../../../components/ui';
import { Folder as FolderIcon } from '../../../../lib/icons';
import { isUsingDefaultSubfolder, isExplicitlyNoSubfolder } from '../../../../utils/channelHelpers';

interface SubFolderChipProps {
  subFolder: string | null | undefined;
}

const SubFolderChip: React.FC<SubFolderChipProps> = ({ subFolder }) => {
  // NULL or empty = "root" (backwards compatible, download to root)
  if (isExplicitlyNoSubfolder(subFolder)) {
    return (
      <Chip
        data-testid="subfolder-chip"
        data-default="false"
        data-root="true"
        size="small"
        icon={<FolderIcon size={14} style={{ color: 'var(--muted-foreground)' }} data-testid="FolderIcon" />}
        label="root"
        sx={{
          fontSize: '0.7rem',
          '& .MuiChip-label': { fontStyle: 'italic', color: 'text.secondary' },
        }}
      />
    );
  }

  // ##USE_GLOBAL_DEFAULT## = "global default" (uses global default)
  if (isUsingDefaultSubfolder(subFolder)) {
    return (
      <Chip
        data-testid="subfolder-chip"
        data-default="true"
        size="small"
        icon={<FolderIcon size={14} style={{ color: 'var(--muted-foreground)' }} data-testid="FolderIcon" />}
        label="global default"
        sx={{
          fontSize: '0.7rem',
          '& .MuiChip-label': { fontStyle: 'italic', color: 'text.secondary' },
        }}
      />
    );
  }

  // Specific subfolder
  return (
    <Chip
      data-testid="subfolder-chip"
      data-default="false"
      size="small"
      icon={<FolderIcon size={14} style={{ color: 'var(--primary)' }} data-testid="FolderIcon" />}
      label={`__${subFolder}/`}
      style={{
        fontSize: '0.7rem',
      }}
    />
  );
};

export default SubFolderChip;
