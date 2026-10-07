import React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContentBody,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  TextField,
} from '../ui';
import { ExternalRequestReview } from '../../types/externalRequest';
import { ReviewAction } from './requestPolicy';

export default function RequestActionDialog({
  request,
  action,
  reason,
  setReason,
  grant,
  setGrant,
  error,
  submitting,
  onCancel,
  onSubmit,
}: {
  request: ExternalRequestReview;
  action: ReviewAction;
  reason: string;
  setReason: (value: string) => void;
  grant: boolean;
  setGrant: (value: boolean) => void;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        Confirm {action === 'approve' ? 'approval' : 'rejection'}
      </DialogTitle>
      <DialogContentBody className="space-y-4">
        <DialogContentText>
          {action === 'approve'
            ? request.type === 'channel'
              ? 'Youtarr will recheck the requester, resolve and provision the channel, then optionally grant it to that key.'
              : request.type === 'delete_video'
                ? 'Youtarr will recheck policy before deleting the local video files.'
                : 'Youtarr will recheck policy before accepting the download.'
            : 'Rejecting this request is final. The client may submit a new request later.'}
        </DialogContentText>
        {action === 'reject' && (
          <TextField
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            inputProps={{ maxLength: 300 }}
            helperText={`${reason.trim().length}/300 characters`}
            multiline
            rows={3}
            fullWidth
            required
          />
        )}
        {action === 'approve' && request.type === 'channel' && (
          <FormControlLabel
            control={
              <Checkbox
                disabled={submitting || request.status === 'approved'}
                checked={grant}
                onChange={(event) => setGrant(event.target.checked)}
              />
            }
            label="Grant the provisioned channel to the requesting key"
          />
        )}
        {request.status === 'approved' && (
          <Alert severity="info">
            Retrying preserves the original approval and channel grant choice.
          </Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContentBody>
      <DialogActions>
        <Button
          variant="outlined"
          color="inherit"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color={action === 'reject' ? 'error' : 'primary'}
          disabled={
            submitting || (action === 'reject' && reason.trim().length === 0)
          }
          loading={submitting}
          onClick={onSubmit}
        >
          Confirm {action === 'approve' ? 'approval' : 'rejection'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
