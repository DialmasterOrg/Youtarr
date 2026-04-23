import {
  Shield as ShieldIcon,
  CloudOff as CloudOffIcon,
  Block as BlockIcon,
  Download as DownloadIcon,
} from '../../../lib/icons';
import type { FilterConfig } from './types';

export type StatusChipId = 'protected' | 'missing' | 'ignored' | 'downloaded';
export type StatusFilterConfig = Extract<FilterConfig, { id: StatusChipId }>;

// Shape kept deliberately thin: the Icon component (not an element) so each
// consumer can size it, plus the chip's "noun" -- consumers compose the full
// label (e.g. "Only: Protected") from this noun.
export interface StatusChipDescriptor {
  // Lucide's icon components accept size as string | number.
  Icon: React.ComponentType<{ size?: string | number; 'data-testid'?: string }>;
  noun: string;
}

export const STATUS_CHIP_DESCRIPTORS: Record<StatusChipId, StatusChipDescriptor> = {
  protected: { Icon: ShieldIcon, noun: 'Protected' },
  missing: { Icon: CloudOffIcon, noun: 'Missing' },
  ignored: { Icon: BlockIcon, noun: 'Ignored' },
  downloaded: { Icon: DownloadIcon, noun: 'Downloaded' },
};

export const STATUS_CHIP_IDS = Object.keys(STATUS_CHIP_DESCRIPTORS) as StatusChipId[];

export function isStatusChipId(id: string): id is StatusChipId {
  return id in STATUS_CHIP_DESCRIPTORS;
}

// Narrows FilterConfig (not just the id) so consumers can access value/onChange
// without per-branch checks.
export function isStatusFilter(filter: FilterConfig): filter is StatusFilterConfig {
  return isStatusChipId(filter.id);
}
