import React from 'react';
import { OptionSelect } from './OptionSelect';
import { RESOLUTION_OPTIONS } from '../../utils/downloadOptions';

export interface ResolutionSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  /** When provided, renders a leading "use default" option. Omit for a required select. */
  emptyLabel?: string;
  helperText?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  labelId?: string;
}

/** Maximum-resolution dropdown backed by the shared RESOLUTION_OPTIONS. */
export function ResolutionSelect({ label = 'Maximum Resolution', ...rest }: ResolutionSelectProps) {
  return <OptionSelect options={RESOLUTION_OPTIONS} label={label} {...rest} />;
}

export default ResolutionSelect;
