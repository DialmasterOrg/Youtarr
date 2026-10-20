import type React from 'react';

export type VideoListViewMode = 'grid' | 'list' | 'table';

export type ChipFilterMode = 'off' | 'only' | 'exclude';

export type FilterConfig =
  | {
      id: 'dateRange';
      dateFrom: Date | null;
      dateTo: Date | null;
      onFromChange: (value: Date | null) => void;
      onToChange: (value: Date | null) => void;
      onClear?: () => void;
      hidden?: boolean;
      hiddenReason?: string;
    }
  | {
      id: 'dateRangeString';
      dateFrom: string;
      dateTo: string;
      onFromChange: (value: string) => void;
      onToChange: (value: string) => void;
      onClear?: () => void;
      hidden?: boolean;
    }
  | {
      id: 'maxRating';
      value: string;
      onChange: (value: string) => void;
    }
  // Status chips rest at `defaultValue` (off unless given): a chip at its
  // resting value is not "active", and clearing filters returns it there.
  | {
      id: 'protected';
      value: ChipFilterMode;
      onChange: (value: ChipFilterMode) => void;
      defaultValue?: ChipFilterMode;
    }
  | {
      id: 'missing';
      value: ChipFilterMode;
      onChange: (value: ChipFilterMode) => void;
      defaultValue?: ChipFilterMode;
    }
  | {
      id: 'deleted';
      value: ChipFilterMode;
      onChange: (value: ChipFilterMode) => void;
      defaultValue?: ChipFilterMode;
    }
  | {
      id: 'ignored';
      value: ChipFilterMode;
      onChange: (value: ChipFilterMode) => void;
      defaultValue?: ChipFilterMode;
    }
  | {
      id: 'downloaded';
      value: ChipFilterMode;
      onChange: (value: ChipFilterMode) => void;
      defaultValue?: ChipFilterMode;
    }
  | {
      id: 'watched';
      value: ChipFilterMode;
      onChange: (value: ChipFilterMode) => void;
      defaultValue?: ChipFilterMode;
    }
  | {
      id: 'duration';
      min: number | null;
      max: number | null;
      inputMin: number | null;
      inputMax: number | null;
      onMinChange: (value: number | null) => void;
      onMaxChange: (value: number | null) => void;
      onClear?: () => void;
    }
  | {
      id: 'channel';
      value: string;
      options: string[];
      onChange: (value: string) => void;
    };

export interface SortOption {
  key: string;
  label: string;
  // An order with no direction (e.g. the source's own ranking): the button
  // shows no arrow for it and re-choosing it changes nothing.
  undirected?: boolean;
}

export interface SortConfig {
  options: SortOption[];
  activeKey: string;
  direction: 'asc' | 'desc';
  onChange: (key: string, direction: 'asc' | 'desc') => void;
}

export type SelectionIntent = 'base' | 'primary' | 'success' | 'warning' | 'danger';

export interface SelectionAction<IdType extends string | number = string | number> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  intent?: SelectionIntent;
  disabled?: (selectedIds: IdType[]) => boolean;
  onClick: (selectedIds: IdType[]) => void;
}

export type PaginationMode = 'pages' | 'infinite';
