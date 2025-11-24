import React from 'react';
import { Box, Typography } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';

interface SubFolderChipProps {
  subFolder: string | null | undefined;
}

const SubFolderChip: React.FC<SubFolderChipProps> = ({ subFolder }) => {
  if (!subFolder) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="subfolder-chip" data-default="true">
        <FolderIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} data-testid="FolderIcon" />
        <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          default
        </Typography>
      </Box>
    );
  }

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
