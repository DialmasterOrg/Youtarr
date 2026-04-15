import React from 'react';
import { cn } from '../../../lib/cn';
import { Zap as BoltLightningIcon, Trash2 as DeleteIcon } from '../../../lib/icons';

interface SelectionActionFabProps {
  count: number;
  intent: 'download' | 'delete';
  menuOpen: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ariaControls?: string;
}

function formatCount(count: number) {
  if (count > 99) {
    return '99+';
  }

  return String(count);
}

function SelectionActionFab({ count, intent, menuOpen, onClick, ariaControls }: SelectionActionFabProps) {
  const label = `Actions for ${count} selected video${count !== 1 ? 's' : ''}`;

  return (
    <div className="selection-action-fab-shell">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menuOpen ? 'true' : 'false'}
        aria-controls={menuOpen ? ariaControls : undefined}
        onClick={onClick}
        className={cn(
          'selection-action-fab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          `selection-action-fab--${intent}`,
          menuOpen && 'selection-action-fab--open'
        )}
      >
        {intent === 'download' ? <BoltLightningIcon /> : <DeleteIcon />}
      </button>
      <span data-testid="selection-action-count" className="selection-action-fab__badge" aria-hidden="true">
        {formatCount(count)}
      </span>
    </div>
  );
}

export default SelectionActionFab;