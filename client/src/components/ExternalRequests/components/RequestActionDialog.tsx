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
} from '../../ui';
import { ExternalRequestReview } from '../../../types/externalRequest';
import { ReviewAction } from '../requestPolicy';

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
              ? 'Youtarr rechecks the requester now, then adds the channel in the background and optionally grants it to that key.'
              : request.type === 'delete_video'
                ? 'Youtarr rechecks policy now, then deletes the local video files in the background.'
                : 'Youtarr rechecks policy now, then downloads the video in the background.'
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
                disabled={submitting}
                checked={grant}
                onChange={(event) => setGrant(event.target.checked)}
              />
            }
            label="Grant the provisioned channel to the requesting key"
          />
        )}
        {action === 'approve' && (
          <DialogContentText>The status on this page updates as the work runs.</DialogContentText>
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
