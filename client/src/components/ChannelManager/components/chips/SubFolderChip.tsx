import React from 'react';
import { Chip } from '../../../../components/ui';
import { Folder as FolderIcon } from '../../../../lib/icons';
import { isUsingDefaultSubfolder, isExplicitlyNoSubfolder } from '../../../../utils/channelHelpers';
import { SHARED_CHANNEL_META_CHIP_STYLE, SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE } from '../../../shared/chipStyles';

interface SubFolderChipProps {
  subFolder: string | null | undefined;
}

const SubFolderChip: React.FC<SubFolderChipProps> = ({ subFolder }) => {
  const chipStyle = {
    ...SHARED_CHANNEL_META_CHIP_STYLE,
    ...SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE,
  };

  // NULL or empty = "root" (backwards compatible, download to root)
  if (isExplicitlyNoSubfolder(subFolder)) {
    return (
      <Chip
        data-testid="subfolder-chip"
        data-default="false"
        data-root="true"
        size="small"
        color="default"
        icon={<FolderIcon size={14} style={{ color: 'var(--channel-meta-chip-icon)' }} data-testid="FolderIcon" />}
        label="root"
        style={chipStyle}
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
        color="default"
        icon={<FolderIcon size={14} style={{ color: 'var(--channel-meta-chip-icon)' }} data-testid="FolderIcon" />}
        label="global default"
        style={chipStyle}
      />
    );
  }

  // Specific subfolder — filled grey with folder icon to match quality chip style
  return (
    <Chip
      data-testid="subfolder-chip"
      data-default="false"
      size="small"
      color="default"
      icon={<FolderIcon size={14} style={{ color: 'var(--channel-meta-chip-icon)' }} data-testid="FolderIcon" />}
      label={`__${subFolder}/`}
      style={chipStyle}
    />
  );
};

export default SubFolderChip;
