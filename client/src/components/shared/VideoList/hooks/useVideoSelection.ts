import { useCallback, useMemo, useState } from 'react';
import { SelectionAction } from '../types';

export interface VideoSelectionState<IdType extends string | number> {
  selectedIds: IdType[];
  isSelected: (id: IdType) => boolean;
  toggle: (id: IdType) => void;
  set: (ids: IdType[]) => void;
  add: (ids: IdType[]) => void;
  selectAll: (ids: IdType[]) => void;
  clear: () => void;
  hasSelection: boolean;
  count: number;
  actions: SelectionAction<IdType>[];
  menuAnchor: HTMLElement | null;
  openMenu: (anchor: HTMLElement) => void;
  closeMenu: () => void;
}

export interface UseVideoSelectionOptions<IdType extends string | number> {
  actions?: SelectionAction<IdType>[];
}

export function useVideoSelection<IdType extends string | number = number>({
  actions = [],
}: UseVideoSelectionOptions<IdType> = {}): VideoSelectionState<IdType> {
  const [selectedIds, setSelectedIds] = useState<IdType[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const selectedSet = useMemo(() => new Set<IdType>(selectedIds), [selectedIds]);

  const isSelected = useCallback(
    (id: IdType) => selectedSet.has(id),
    [selectedSet]
  );

  const toggle = useCallback((id: IdType) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const set = useCallback((ids: IdType[]) => {
    setSelectedIds(ids);
  }, []);

  const add = useCallback((ids: IdType[]) => {
    setSelectedIds((prev) => {
      const merged = [...prev];
      for (const id of ids) {
        if (!prev.includes(id)) merged.push(id);
      }
      return merged;
    });
  }, []);

  const selectAll = useCallback((ids: IdType[]) => {
    setSelectedIds(ids);
  }, []);

  const clear = useCallback(() => {
    setSelectedIds([]);
    setMenuAnchor(null);
  }, []);

  const openMenu = useCallback((anchor: HTMLElement) => {
    setMenuAnchor(anchor);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  return {
    selectedIds,
    isSelected,
    toggle,
    set,
    add,
    selectAll,
    clear,
    hasSelection: selectedIds.length > 0,
    count: selectedIds.length,
    actions,
    menuAnchor,
    openMenu,
    closeMenu,
  };
}
