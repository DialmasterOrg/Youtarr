import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

export interface VideoFilters {
  minDuration: number | null; // minutes
  maxDuration: number | null; // minutes
  dateFrom: Date | null;
  dateTo: Date | null;
}

export interface UseChannelVideoFiltersReturn {
  filters: VideoFilters;
  // Immediate values for input display (updates instantly)
  inputMinDuration: number | null;
  inputMaxDuration: number | null;
  setMinDuration: (value: number | null) => void;
  setMaxDuration: (value: number | null) => void;
  setDateFrom: (value: Date | null) => void;
  setDateTo: (value: Date | null) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

const initialFilters: VideoFilters = {
  minDuration: null,
  maxDuration: null,
  dateFrom: null,
  dateTo: null,
};

const DEBOUNCE_DELAY = 400; // ms

export function useChannelVideoFilters(): UseChannelVideoFiltersReturn {
  const [filters, setFilters] = useState<VideoFilters>(initialFilters);

  // Separate state for immediate input values (for responsive UI)
  const [inputMinDuration, setInputMinDuration] = useState<number | null>(null);
  const [inputMaxDuration, setInputMaxDuration] = useState<number | null>(null);

  // Refs for debounce timers
  const minDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (minDurationTimerRef.current) clearTimeout(minDurationTimerRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    };
  }, []);

  const setMinDuration = useCallback((value: number | null) => {
    // Update input immediately for responsive UI
    setInputMinDuration(value);

    // Clear existing timer
    if (minDurationTimerRef.current) {
      clearTimeout(minDurationTimerRef.current);
    }

    // Debounce the actual filter update
    minDurationTimerRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, minDuration: value }));
    }, DEBOUNCE_DELAY);
  }, []);

  const setMaxDuration = useCallback((value: number | null) => {
    // Update input immediately for responsive UI
    setInputMaxDuration(value);

    // Clear existing timer
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
    }

    // Debounce the actual filter update
    maxDurationTimerRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, maxDuration: value }));
    }, DEBOUNCE_DELAY);
  }, []);

  const setDateFrom = useCallback((value: Date | null) => {
    setFilters((prev) => ({ ...prev, dateFrom: value }));
  }, []);

  const setDateTo = useCallback((value: Date | null) => {
    setFilters((prev) => ({ ...prev, dateTo: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    // Clear any pending debounce timers
    if (minDurationTimerRef.current) clearTimeout(minDurationTimerRef.current);
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);

    // Reset both input and filter state
    setInputMinDuration(null);
    setInputMaxDuration(null);
    setFilters(initialFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.minDuration !== null ||
      filters.maxDuration !== null ||
      filters.dateFrom !== null ||
      filters.dateTo !== null
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    // Count duration as one filter (even if both min and max are set)
    if (filters.minDuration !== null || filters.maxDuration !== null) {
      count += 1;
    }
    // Count date range as one filter (even if both from and to are set)
    if (filters.dateFrom !== null || filters.dateTo !== null) {
      count += 1;
    }
    return count;
  }, [filters]);

  return {
    filters,
    inputMinDuration,
    inputMaxDuration,
    setMinDuration,
    setMaxDuration,
    setDateFrom,
    setDateTo,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
