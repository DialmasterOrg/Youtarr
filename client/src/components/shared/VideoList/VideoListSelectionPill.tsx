import React from 'react';
import { createPortal } from 'react-dom';
import { Menu, MenuItem, Button, Typography } from '../../ui';
import {
  Trash2 as DeleteIcon,
  X as ClearIcon,
  MoreVert as MoreVertIcon,
} from '../../../lib/icons';
import { ActionBar } from '../ActionBar';
import { useThemeEngine } from '../../../contexts/ThemeEngineContext';
import { cn } from '../../../lib/cn';
import { intentStyles } from '../../../utils/intentStyles';
import { VideoSelectionState } from './hooks/useVideoSelection';
import { SelectionIntent } from './types';

export interface VideoListSelectionPillProps<IdType extends string | number> {
  selection: VideoSelectionState<IdType>;
  isMobile: boolean;
  menuId?: string;
}

function pillClassName(intent: SelectionIntent | undefined, open: boolean): string {
  const base = 'selection-action-fab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const intentClass = intent === 'danger'
    ? 'selection-action-fab--delete'
    : intent === 'warning'
    ? 'selection-action-fab--download'
    : intent === 'success'
    ? 'selection-action-fab--download'
    : 'selection-action-fab--download';
  return cn(base, intentClass, open && 'selection-action-fab--open');
}

function formatCount(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

function intentClass(intent: SelectionIntent | undefined): string {
  switch (intent) {
    case 'danger':
      return 'intent-danger';
    case 'warning':
      return 'intent-warning';
    case 'success':
      return 'intent-success';
    case 'primary':
      return intentStyles.base;
    default:
      return 'intent-base';
  }
}

function VideoListSelectionPill<IdType extends string | number>({
  selection,
  isMobile,
  menuId = 'video-list-selection-actions',
}: VideoListSelectionPillProps<IdType>) {
  const { themeMode } = useThemeEngine();

  if (!selection.hasSelection || typeof window === 'undefined') return null;

  const { count, selectedIds, actions, menuAnchor, openMenu, closeMenu, clear } = selection;

  const primaryIntent = actions.find((a) => a.intent && a.intent !== 'base')?.intent;

  if (isMobile) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: 8,
          right: 8,
          bottom: 'calc(var(--mobile-nav-total-offset, 0px) + 8px)',
          zIndex: 1399,
        }}
      >
        <ActionBar
          variant={themeMode}
          compact
          style={{
            justifyContent: 'space-between',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--radius-ui)',
            border: 'var(--nav-border)',
            backgroundColor: 'var(--card)',
            boxShadow: 'var(--shadow-hard)',
          }}
        >
          <Typography variant="body2" style={{ fontWeight: 700 }}>
            {count} selected
          </Typography>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
            {actions.map((action) => {
              const disabled = action.disabled ? action.disabled(selectedIds) : false;
              return (
                <Button
                  key={action.id}
                  size="small"
                  onClick={() => action.onClick(selectedIds)}
                  className={intentClass(action.intent)}
                  startIcon={action.icon}
                  disabled={disabled}
                  data-testid={`selection-action-${action.id}`}
                >
                  {action.label}
                </Button>
              );
            })}
            <Button
              size="small"
              onClick={clear}
              className="intent-base"
              startIcon={<ClearIcon size={14} />}
            >
              Clear
            </Button>
          </div>
        </ActionBar>
      </div>,
      document.body
    );
  }

  const open = Boolean(menuAnchor);

  return createPortal(
    <>
      <div className="selection-action-fab-shell">
        <button
          type="button"
          aria-label={`Actions for ${count} selected video${count !== 1 ? 's' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={open ? menuId : undefined}
          onClick={(e) => (open ? closeMenu() : openMenu(e.currentTarget))}
          className={pillClassName(primaryIntent, open)}
          data-testid="video-list-selection-pill"
        >
          <MoreVertIcon />
        </button>
        <span
          data-testid="video-list-selection-count"
          className="selection-action-fab__badge"
          aria-hidden="true"
        >
          {formatCount(count)}
        </span>
      </div>
      <Menu
        id={menuId}
        anchorEl={menuAnchor}
        open={open}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {actions.map((action) => {
          const disabled = action.disabled ? action.disabled(selectedIds) : false;
          return (
            <MenuItem
              key={action.id}
              onClick={() => {
                action.onClick(selectedIds);
                closeMenu();
              }}
              disabled={disabled}
              data-testid={`selection-menu-${action.id}`}
            >
              {action.icon && <span style={{ marginRight: 8, display: 'inline-flex' }}>{action.icon}</span>}
              <span>{action.label}</span>
            </MenuItem>
          );
        })}
        <MenuItem
          onClick={() => {
            clear();
            closeMenu();
          }}
          data-testid="selection-menu-clear"
        >
          <DeleteIcon style={{ opacity: 0, width: 0, height: 0 }} />
          <ClearIcon size={14} style={{ marginRight: 8 }} />
          <span>Clear Selection</span>
        </MenuItem>
      </Menu>
    </>,
    document.body
  );
}

export default VideoListSelectionPill;
