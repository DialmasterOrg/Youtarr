import React from 'react';
import {
  describeMissing,
  describeRow,
  getRemovalState,
  removalFromRow,
  type RemovalRow,
} from '../../utils/videoRemoval';

// Tooltips showing a RemovalDescription widen past the default so a file path
// wraps less. Touch tooltips keep their own width cap.
export const REMOVAL_TOOLTIP_CLASS = 'max-w-md';

interface RemovalDescriptionProps {
  row: RemovalRow;
}

// Why a video has no file, for a chip tooltip. A missing file's path sits on
// its own line in a monospace pill so it stands apart from the explanation;
// a color would not, since the tooltip inverts between light and dark themes.
function RemovalDescription({ row }: RemovalDescriptionProps) {
  const { path, rest } = describeMissing(removalFromRow(row), row.filePath);
  if (getRemovalState(row.removed, row.removed_reason) !== 'missing' || !path) {
    return <>{describeRow(row)}</>;
  }

  return (
    <>
      Youtarr expected a file at:{' '}
      <code className="my-1 block break-all rounded bg-background/15 px-1.5 py-0.5 font-mono">{path}</code>{' '}
      {rest}
    </>
  );
}

export default RemovalDescription;
