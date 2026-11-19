import React, { useState } from 'react';
import { Button, TextField } from '../../../ui';
import { Plus as AddIcon, Settings as SettingsIcon } from '../../../../lib/icons';
import { cn } from '../../../../lib/cn';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';
import { useSubfolders } from '../../../../hooks/useSubfolders';
import { SubfolderAutocomplete } from '../../../shared/SubfolderAutocomplete';
import { AddSubfolderDialog } from '../../../shared/AddSubfolderDialog';
import { ManageSubfoldersDialog } from '../../../shared/ManageSubfoldersDialog';
import { SettingsSection } from '../../common/SettingsSection';
import { SettingRow, settingDescriptionId } from '../../common/SettingRow';
import { DefaultSubfolderDialog } from './DefaultSubfolderDialog';
import type { ConfigState, DeploymentEnvironment } from '../../types';

const PHONE_QUERY = '(max-width: 767px)';
const DOWNLOADS_FOLDER_ID = 'youtubeOutputDirectory';
const DOWNLOADS_FOLDER_NOTE = {
  elfhosted: 'This path is configured by your platform deployment and cannot be changed here.',
  docker: 'Docker volume, set by YOUTUBE_OUTPUT_DIR. Edit .env and restart to change it.',
};

interface PendingDefault {
  subfolder: string | null;
  /** Just created with Add Subfolder (already saved), so declining only skips the default */
  isNew: boolean;
}

export interface CoreFoldersSectionProps {
  config: ConfigState;
  deploymentEnvironment: DeploymentEnvironment;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  token: string | null;
}

/** Settings > Core: the downloads folder and the default subfolder. */
export function CoreFoldersSection({ config, deploymentEnvironment, onConfigChange, token }: CoreFoldersSectionProps) {
  const phone = useMediaQuery(PHONE_QUERY);
  const { subfolders, loading, createSubfolder } = useSubfolders(token);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingDefault, setPendingDefault] = useState<PendingDefault | null>(null);
  const elfhosted = deploymentEnvironment.platform?.toLowerCase() === 'elfhosted';

  const requestDefault = (subfolder: string | null, meta?: { isNewlyCreated?: boolean }) => {
    if ((config.defaultSubfolder || '') === (subfolder || '')) return;
    setPendingDefault({ subfolder, isNew: meta?.isNewlyCreated === true });
  };

  const handleAdd = (name: string) => {
    setAddOpen(false);
    createSubfolder(name).catch((err: unknown) => {
      console.error('Failed to persist subfolder:', err);
    });
    requestDefault(name, { isNewlyCreated: true });
  };

  return (
    <>
      <SettingsSection id="folders" title="Folders" description="Where downloads are saved.">
        <SettingRow controlId={DOWNLOADS_FOLDER_ID} label="Downloads folder"
          description={elfhosted ? DOWNLOADS_FOLDER_NOTE.elfhosted : DOWNLOADS_FOLDER_NOTE.docker}>
          <TextField id={DOWNLOADS_FOLDER_ID} name={DOWNLOADS_FOLDER_ID} fullWidth disabled className="[&_input]:font-mono"
            value={config.youtubeOutputDirectory} aria-describedby={settingDescriptionId(DOWNLOADS_FOLDER_ID)} />
        </SettingRow>
        <div className={cn(phone ? 'px-4 py-3.5' : 'px-5 py-4')}>
          <div className="md:max-w-md">
            <SubfolderAutocomplete mode="global" value={config.defaultSubfolder || null} onChange={requestDefault}
              subfolders={subfolders} loading={loading} label="Default Subfolder" showAddAction={false}
              helperText="Where untracked channels and channels set to 'Default Subfolder' download. No subfolder: the root of the downloads folder." />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button variant="text" size="sm" startIcon={<AddIcon size={14} />} onClick={() => setAddOpen(true)}>Add Subfolder</Button>
            <Button variant="text" size="sm" startIcon={<SettingsIcon size={14} />} onClick={() => setManageOpen(true)}>Manage Subfolders</Button>
          </div>
        </div>
      </SettingsSection>

      <AddSubfolderDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} existingSubfolders={subfolders} />
      <ManageSubfoldersDialog open={manageOpen} onClose={() => setManageOpen(false)} token={token} />
      <DefaultSubfolderDialog open={pendingDefault !== null} subfolder={pendingDefault?.subfolder ?? null}
        isNew={pendingDefault?.isNew === true} token={token}
        onCancel={() => setPendingDefault(null)}
        onConfirm={() => { onConfigChange({ defaultSubfolder: pendingDefault?.subfolder || '' }); setPendingDefault(null); }} />
    </>
  );
}
