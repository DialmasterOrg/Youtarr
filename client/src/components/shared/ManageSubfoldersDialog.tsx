import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Typography,
} from '../ui';
import { Trash2 as DeleteIcon } from '../../lib/icons';
import { useSubfolders } from '../../hooks/useSubfolders';
import { useSubfolderUsage, SubfolderUsage } from '../../hooks/useSubfolderUsage';

interface ManageSubfoldersDialogProps {
  open: boolean;
  onClose: () => void;
  token: string | null;
}

type ChipColor = 'default' | 'primary' | 'info' | 'warning';

function usageChips(usage: SubfolderUsage): Array<{ label: string; color: ChipColor }> {
  const chips: Array<{ label: string; color: ChipColor }> = [];
  if (usage.isDefault) chips.push({ label: 'Default', color: 'primary' });
  if (usage.plexMapped) chips.push({ label: 'Plex library', color: 'info' });
  if (usage.channels > 0) {
    chips.push({ label: `${usage.channels} channel${usage.channels === 1 ? '' : 's'}`, color: 'default' });
  }
  if (usage.playlists > 0) {
    chips.push({ label: `${usage.playlists} playlist${usage.playlists === 1 ? '' : 's'}`, color: 'default' });
  }
  if (usage.hasFiles) chips.push({ label: 'Has videos', color: 'warning' });
  return chips;
}

export function ManageSubfoldersDialog({ open, onClose, token }: ManageSubfoldersDialogProps) {
  // Only fetch while the dialog is open (the usage list does on-disk checks).
  const activeToken = open ? token : null;
  const { items, loading } = useSubfolderUsage(activeToken);
  const { deleteSubfolder } = useSubfolders(activeToken);
  const [errorByName, setErrorByName] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const handleDelete = async (name: string) => {
    setBusy(name);
    setErrorByName((prev) => ({ ...prev, [name]: '' }));
    try {
      await deleteSubfolder(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete subfolder';
      setErrorByName((prev) => ({ ...prev, [name]: message }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manage Subfolders</DialogTitle>
      <DialogContent>
        {loading && items.length === 0 && <Typography variant="body2">Loading...</Typography>}
        {!loading && items.length === 0 && (
          <Typography variant="body2" className="text-muted-foreground">
            No subfolders yet.
          </Typography>
        )}
        <ul className="m-0 list-none p-0">
          {items.map((item) => {
            const chips = usageChips(item.usage);
            return (
              <li key={item.displayName} className="flex flex-col gap-1 border-b border-border py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Typography component="span" variant="body2">
                      {item.displayName}
                    </Typography>
                    <div className="flex flex-wrap items-center gap-1">
                      {chips.length === 0 ? (
                        <Typography variant="caption" className="text-muted-foreground">
                          Unused
                        </Typography>
                      ) : (
                        chips.map((chip) => (
                          <Chip key={chip.label} label={chip.label} size="small" variant="outlined" color={chip.color} />
                        ))
                      )}
                    </div>
                  </div>
                  <Button
                    variant="text"
                    aria-label={item.deletable ? `Delete ${item.displayName}` : `${item.displayName} is in use`}
                    disabled={!item.deletable || busy === item.name}
                    onClick={() => handleDelete(item.name)}
                  >
                    <DeleteIcon size={16} />
                  </Button>
                </div>
                {errorByName[item.name] && (
                  <Typography variant="caption" className="text-destructive">
                    {errorByName[item.name]}
                  </Typography>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ManageSubfoldersDialog;
