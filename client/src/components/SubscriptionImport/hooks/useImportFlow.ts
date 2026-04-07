import { useReducer } from 'react';
import {
  ImportPhase, ReviewChannel, RowState, RowSettings, DEFAULT_ROW_SETTINGS,
} from '../../../types/subscriptionImport';

export interface ImportFlowState {
  phase: ImportPhase;
  source: 'takeout' | 'cookies' | null;
  channels: ReviewChannel[];
  rowStates: Record<string, RowState>;
  activeJobId: string | null;
  error: string | null;
}

export type ImportFlowAction =
  | { type: 'SET_SOURCE'; payload: 'takeout' | 'cookies' }
  | { type: 'PREVIEW_LOADING' }
  | { type: 'PREVIEW_SUCCESS'; payload: { channels: ReviewChannel[] } }
  | { type: 'PREVIEW_ERROR'; payload: string }
  | { type: 'TOGGLE_ROW_SELECTION'; payload: string }
  | { type: 'SELECT_ALL' }
  | { type: 'DESELECT_ALL' }
  | { type: 'TOGGLE_ALL_AUTO_DOWNLOAD'; payload: boolean }
  | { type: 'UPDATE_ROW_SETTINGS'; payload: { channelId: string; settings: Partial<RowSettings> } }
  | { type: 'START_IMPORT'; payload: string }
  | { type: 'IMPORT_COMPLETE' };

const INITIAL_STATE: ImportFlowState = {
  phase: 'source',
  source: null,
  channels: [],
  rowStates: {},
  activeJobId: null,
  error: null,
};

function buildRowStates(channels: ReviewChannel[]): Record<string, RowState> {
  const rowStates: Record<string, RowState> = {};
  for (const channel of channels) {
    rowStates[channel.channelId] = {
      selected: !channel.alreadySubscribed,
      settings: { ...DEFAULT_ROW_SETTINGS },
    };
  }
  return rowStates;
}

function importFlowReducer(state: ImportFlowState, action: ImportFlowAction): ImportFlowState {
  switch (action.type) {
    case 'SET_SOURCE':
      return { ...state, source: action.payload };

    case 'PREVIEW_LOADING':
      return { ...state, phase: 'preview-loading', error: null };

    case 'PREVIEW_SUCCESS':
      return {
        ...state,
        phase: 'reviewing',
        channels: action.payload.channels,
        rowStates: buildRowStates(action.payload.channels),
        error: null,
      };

    case 'PREVIEW_ERROR':
      return { ...state, phase: 'source', error: action.payload };

    case 'TOGGLE_ROW_SELECTION': {
      const channelId = action.payload;
      const existing = state.rowStates[channelId];
      if (!existing) return state;

      const channel = state.channels.find(c => c.channelId === channelId);
      if (channel?.alreadySubscribed) return state;

      return {
        ...state,
        rowStates: {
          ...state.rowStates,
          [channelId]: { ...existing, selected: !existing.selected },
        },
      };
    }

    case 'SELECT_ALL': {
      const updated: Record<string, RowState> = { ...state.rowStates };
      for (const channel of state.channels) {
        if (!channel.alreadySubscribed) {
          updated[channel.channelId] = { ...updated[channel.channelId], selected: true };
        }
      }
      return { ...state, rowStates: updated };
    }

    case 'DESELECT_ALL': {
      const updated: Record<string, RowState> = { ...state.rowStates };
      for (const channel of state.channels) {
        updated[channel.channelId] = { ...updated[channel.channelId], selected: false };
      }
      return { ...state, rowStates: updated };
    }

    case 'TOGGLE_ALL_AUTO_DOWNLOAD': {
      const updated: Record<string, RowState> = { ...state.rowStates };
      for (const channel of state.channels) {
        const row = updated[channel.channelId];
        if (row.selected) {
          updated[channel.channelId] = {
            ...row,
            settings: { ...row.settings, autoDownloadEnabled: action.payload },
          };
        }
      }
      return { ...state, rowStates: updated };
    }

    case 'UPDATE_ROW_SETTINGS': {
      const { channelId, settings } = action.payload;
      const existing = state.rowStates[channelId];
      if (!existing) return state;

      return {
        ...state,
        rowStates: {
          ...state.rowStates,
          [channelId]: {
            ...existing,
            settings: { ...existing.settings, ...settings },
          },
        },
      };
    }

    case 'START_IMPORT':
      return { ...state, phase: 'importing', activeJobId: action.payload };

    case 'IMPORT_COMPLETE':
      return { ...state, phase: 'complete' };

    default:
      return state;
  }
}

export function useImportFlow() {
  const [state, dispatch] = useReducer(importFlowReducer, INITIAL_STATE);
  return { state, dispatch };
}
