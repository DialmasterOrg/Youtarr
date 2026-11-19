import React from 'react';
import { OptionSelect } from './OptionSelect';
import { AUDIO_FORMAT_OPTIONS } from '../../utils/downloadOptions';

export const VIDEO_ONLY_HELPER_TEXT = 'TV folders are video-only.';

export interface AudioFormatSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  emptyLabel?: string;
  helperText?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  labelId?: string;
  /** The destination is a TV folder: MP3 choices are hidden, except one already selected */
  videoOnly?: boolean;
}

/** Download-type dropdown (video only / video + MP3 / MP3 only). */
export function AudioFormatSelect({
  label = 'Download Type',
  emptyLabel = 'Video Only (default)',
  videoOnly = false,
  helperText,
  ...rest
}: AudioFormatSelectProps) {
  // A selected MP3 choice stays listed so the select can show it while the user changes it.
  const options = videoOnly
    ? AUDIO_FORMAT_OPTIONS.filter((option) => option.value === rest.value)
    : AUDIO_FORMAT_OPTIONS;
  return (
    <OptionSelect
      options={options}
      label={label}
      emptyLabel={emptyLabel}
      helperText={helperText ?? (videoOnly ? VIDEO_ONLY_HELPER_TEXT : undefined)}
      {...rest}
    />
  );
}

export default AudioFormatSelect;
