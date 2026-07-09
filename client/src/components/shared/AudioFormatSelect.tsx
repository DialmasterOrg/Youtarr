import React from 'react';
import { OptionSelect } from './OptionSelect';
import { AUDIO_FORMAT_OPTIONS } from '../../utils/downloadOptions';

export interface AudioFormatSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  emptyLabel?: string;
  helperText?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  labelId?: string;
}

/** Download-type dropdown (video only / video + MP3 / MP3 only). */
export function AudioFormatSelect({
  label = 'Download Type',
  emptyLabel = 'Video Only (default)',
  ...rest
}: AudioFormatSelectProps) {
  return <OptionSelect options={AUDIO_FORMAT_OPTIONS} label={label} emptyLabel={emptyLabel} {...rest} />;
}

export default AudioFormatSelect;
