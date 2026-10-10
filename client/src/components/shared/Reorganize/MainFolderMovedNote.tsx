import React from 'react';
import { Alert, Box, Typography } from '../../ui';
import { ReorganizeOperation } from '../../../types/reorganize';

interface MainFolderMovedNoteProps {
  operation: ReorganizeOperation;
  /** The downloads folder still holds files after the move (main folder hasFiles from the folder list) */
  mainFolderHasFiles?: boolean;
  /** How to reach the library steps: a button or a link */
  stepsAction: React.ReactNode;
}

/** What to do after a main folder move: retry first when videos stayed, else change the libraries. */
export function MainFolderMovedNote({ operation, mainFolderHasFiles = false, stepsAction }: MainFolderMovedNoteProps) {
  if (operation.status === 'partial') {
    return (
      <Alert severity="warning" className="mt-3">
        Some videos are still in your downloads folder. Retry them above before you change your media server libraries:
        a library that shows only your Video folders won't show them.
      </Alert>
    );
  }
  return (
    <Alert severity="info" className="mt-3">
      <Typography variant="body2">
        Next, change your media server libraries: a library that shows your whole downloads folder should show your Video
        folders instead. Then add your TV show folder.
      </Typography>
      {mainFolderHasFiles && (
        <Typography variant="body2" className="mt-1">
          Your downloads folder still holds files the move didn't take. A library that shows only your Video folders
          won't show them, so move any you want to keep into a Video folder first.
        </Typography>
      )}
      <Box className="mt-2">{stepsAction}</Box>
    </Alert>
  );
}
