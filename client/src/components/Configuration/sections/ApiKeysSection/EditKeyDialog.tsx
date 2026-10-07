import React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Typography,
} from '../../../ui';
import { AlertTriangle as WarningIcon } from 'lucide-react';
import { ApiKey, useApiKeys } from './useApiKeys';
import { useExternalAccessEditor } from './useExternalAccessEditor';
import PolicyEditor from './PolicyEditor';
import ChannelGrantPicker from './ChannelGrantPicker';

interface Props {
  apiKey: ApiKey;
  api: ReturnType<typeof useApiKeys>;
  onClose: () => void;
  onSaved: () => void;
}
export default function EditKeyDialog(props: Props) {
  const { apiKey } = props;
  const {
    editPolicy,
    channelOptions,
    channelSearch,
    selectedChannelIds,
    savingPolicy,
    loading,
    editLoadError,
    editSubmitError,
    pendingExternalUpdate,
    setEditPolicy,
    setChannelSearch,
    setSelectedChannelIds,
    closeEditDialog,
    reload,
    saveExternalAccess,
    cancelPrivilegeConfirmation,
    confirmPrivilegeIncrease,
  } = useExternalAccessEditor(props);
  return (
    <>
      <Dialog open onClose={closeEditDialog} maxWidth="md" fullWidth>
        <DialogTitle>Edit External Access — {apiKey.name}</DialogTitle>
        <DialogContent>
          <Alert severity="info" className="mb-4">
            Permissions, policy, and channel grants are enforced by Youtarr on
            every request.
          </Alert>
          {editLoadError && (
            <Alert severity="error" className="mb-4">
              <div className="space-y-2">
                <Typography variant="body2">{editLoadError}</Typography>
                <Button size="small" variant="outlined" onClick={reload}>
                  Retry
                </Button>
              </div>
            </Alert>
          )}
          {editSubmitError && (
            <Alert severity="error" className="mb-4">
              {editSubmitError}
            </Alert>
          )}
          {!editLoadError && loading && (
            <Alert severity="info" className="mb-4">
              Loading channel grants and available channels...
            </Alert>
          )}
          <PolicyEditor policy={editPolicy} onChange={setEditPolicy} />
          <Divider className="my-5" />
          <Typography variant="subtitle2" className="mb-2">
            Approved channels ({selectedChannelIds.length})
          </Typography>
          {selectedChannelIds.length === 0 && (
            <Alert
              severity="warning"
              className="mb-3"
              icon={<WarningIcon size={18} />}
            >
              Saving with zero approved channels is allowed, but this key will
              fail closed and cannot view or request catalog content until
              grants are added.
            </Alert>
          )}
          <ChannelGrantPicker
            channels={channelOptions}
            selectedIds={selectedChannelIds}
            search={channelSearch}
            onSearchChange={setChannelSearch}
            onSelectedIdsChange={setSelectedChannelIds}
            maxHeight="320px"
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={savingPolicy} onClick={closeEditDialog}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveExternalAccess}
            disabled={savingPolicy || loading || Boolean(editLoadError)}
          >
            {savingPolicy ? 'Saving…' : 'Save External Access'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(pendingExternalUpdate)}
        onClose={cancelPrivilegeConfirmation}
      >
        <DialogTitle>Confirm expanded external access?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" className="mb-3">
            This change may increase what the external integration can view or
            request.
          </Alert>
          <Typography variant="body2">
            Continue saving these expanded permissions and channel grants?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelPrivilegeConfirmation} disabled={savingPolicy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmPrivilegeIncrease}
            disabled={savingPolicy}
          >
            {savingPolicy ? 'Saving...' : 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
