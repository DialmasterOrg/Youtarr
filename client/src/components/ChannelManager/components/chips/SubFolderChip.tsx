import React from 'react';
import { Chip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
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
        icon={<FolderIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} data-testid="FolderIcon" />}
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
        icon={<FolderIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} data-testid="FolderIcon" />}
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
      icon={<FolderIcon sx={{ fontSize: '0.9rem', color: 'primary.main' }} data-testid="FolderIcon" />}
      label={`__${subFolder}/`}
      sx={{
        fontSize: '0.7rem',
      }}
    />
  );
};

export default SubFolderChip;
