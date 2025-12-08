import React from 'react';
import { Box, Typography } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { isUsingDefaultSubfolder, isExplicitlyNoSubfolder } from '../../../../utils/channelHelpers';

interface SubFolderChipProps {
  subFolder: string | null | undefined;
}

const SubFolderChip: React.FC<SubFolderChipProps> = ({ subFolder }) => {
  // NULL or empty = "root" (backwards compatible, download to root)
  if (isExplicitlyNoSubfolder(subFolder)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="subfolder-chip" data-default="false" data-root="true">
        <FolderIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} data-testid="FolderIcon" />
        <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          root
        </Typography>
      </Box>
    );
  }

  // ##USE_GLOBAL_DEFAULT## = "global default" (uses global default)
  if (isUsingDefaultSubfolder(subFolder)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="subfolder-chip" data-default="true">
        <FolderIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} data-testid="FolderIcon" />
        <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          global default
        </Typography>
      </Box>
    );
  }

  // Specific subfolder
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="subfolder-chip" data-default="false">
      <FolderIcon sx={{ fontSize: '0.9rem', color: 'primary.main' }} data-testid="FolderIcon" />
      <Typography variant="caption">
        __{subFolder}/
      </Typography>
    </Box>
  );
};

export default SubFolderChip;
