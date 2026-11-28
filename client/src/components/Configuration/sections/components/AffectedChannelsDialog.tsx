import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CircularProgress, DialogContentText } from '../../../ui';
import ConfirmDialog from '../../../shared/ConfirmDialog';

interface AffectedChannels {
  count: number;
  channelNames: string[];
}

interface ConfirmProps {
  open: boolean;
  token: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

interface AffectedChannelsDialogProps extends ConfirmProps {
  title: string;
  /** Endpoint that answers which tracked channels the change reaches */
  lookupUrl: string;
  noneText: string;
  describeCount: (count: number) => string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Keep the confirm button off until the lookup has answered */
  confirmAfterLookup?: boolean;
  /** children go above the affected channels, footer below */
  children: React.ReactNode;
  footer: React.ReactNode;
}

const plural = (count: number) => (count !== 1 ? 's' : '');

/** A confirmation that names the tracked channels a settings change reaches. */
function AffectedChannelsDialog({
  open, token, onConfirm, onCancel, title, lookupUrl, noneText, describeCount,
  confirmLabel, cancelLabel = 'Cancel', confirmAfterLookup = false, children, footer,
}: AffectedChannelsDialogProps) {
  // null: the lookup failed, so the count is unknown.
  const [affected, setAffected] = useState<AffectedChannels | null>(null);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setAffected(null);
    setShowList(false);
    axios.get<AffectedChannels>(lookupUrl, { headers: { 'x-access-token': token || '' } })
      .then((response) => { if (!cancelled) setAffected(response.data); })
      .catch(() => { if (!cancelled) setAffected(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, token, lookupUrl]);

  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      confirmDisabled={confirmAfterLookup && loading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {children}
      <div className="my-4">
        {loading ? (
          <span className="flex items-center gap-2"><CircularProgress size={16} />Checking affected channels...</span>
        ) : affected === null ? (
          <DialogContentText className="text-warning">
            Could not determine how many channels are affected. You can still continue, but the affected channel count is unknown.
          </DialogContentText>
        ) : affected.count === 0 ? (
          <DialogContentText>{noneText}</DialogContentText>
        ) : (
          <>
            <DialogContentText>{describeCount(affected.count)}</DialogContentText>
            <button type="button" onClick={() => setShowList((shown) => !shown)}
              className="mt-1 text-sm text-primary underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
              {showList ? 'Hide affected channels' : 'Show affected channels'}
            </button>
            {showList && (
              <ul className="mt-2 max-h-[200px] overflow-auto rounded bg-muted/50 py-2 pl-6 text-sm">
                {affected.channelNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
      {footer}
    </ConfirmDialog>
  );
}

export interface DefaultSubfolderDialogProps extends ConfirmProps {
  /** The subfolder about to become the default (clean name, no __ prefix); null or empty is the root directory */
  subfolder: string | null;
  /** The subfolder was just created with Add Subfolder, so declining keeps it and only skips the default */
  isNew: boolean;
}

/** Confirm a change of the default subfolder, naming the channels that follow it. */
export function DefaultSubfolderDialog({ subfolder, isNew, ...confirm }: DefaultSubfolderDialogProps) {
  return (
    <AffectedChannelsDialog
      {...confirm}
      title={isNew ? 'Set New Subfolder as Default?' : 'Set Default Subfolder?'}
      lookupUrl="/api/channels/using-default-subfolder"
      noneText="No tracked channels are currently using Default Subfolder."
      describeCount={(count) => `${count} tracked channel${plural(count)} configured to use Default Subfolder.`}
      confirmLabel="Set as Default"
      cancelLabel={isNew ? "Don't Set as Default" : 'Cancel'}
      footer={(
        <>
          <DialogContentText>
            Videos will be downloaded to channel folders in: <strong>{subfolder ? `__${subfolder}` : 'the root directory'}</strong>
          </DialogContentText>
          <DialogContentText className="mt-2 italic">Existing videos will not be moved.</DialogContentText>
        </>
      )}
    >
      {isNew && (
        <DialogContentText className="mb-2">
          Subfolder <strong>{`__${subfolder}`}</strong> has been created and is available anywhere subfolders can be selected.
        </DialogContentText>
      )}
      <DialogContentText>
        {isNew
          ? 'Would you also like to make it the default subfolder? This will affect where videos are downloaded for:'
          : 'Setting a default subfolder will affect where videos are downloaded for:'}
      </DialogContentText>
      <ul className="mt-2 list-disc pl-6 text-sm">
        <li>Untracked channels (manual URL downloads)</li>
        <li>Channels configured to use &quot;Default Subfolder&quot;</li>
      </ul>
    </AffectedChannelsDialog>
  );
}

export interface FlatStructureDialogProps extends ConfirmProps {
  /** The switch is being turned on (flat) or off (per-video folders) */
  turningOn: boolean;
}

/** Confirm a change of the global flat-structure default (Core 5). */
export function FlatStructureDialog({ turningOn, ...confirm }: FlatStructureDialogProps) {
  return (
    <AffectedChannelsDialog
      {...confirm}
      title="Change default file structure?"
      lookupUrl="/api/channels/using-global-file-structure"
      noneText="No tracked channels are currently using the global setting."
      describeCount={(count) =>
        `${count} tracked channel${plural(count)} follow${count === 1 ? 's' : ''} the global setting and will be affected.`}
      confirmLabel="Confirm"
      confirmAfterLookup
      footer={(
        <DialogContentText>
          Previously downloaded videos are not affected. Existing files will not be moved or renamed; only new downloads use the new structure.
        </DialogContentText>
      )}
    >
      <DialogContentText>
        {turningOn
          ? 'New downloads for channels using the global setting will be saved directly in the channel folder (flat structure, no per-video subfolders).'
          : 'New downloads for channels using the global setting will be saved in individual per-video subfolders.'}
      </DialogContentText>
    </AffectedChannelsDialog>
  );
}
