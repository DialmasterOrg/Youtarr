import React from 'react';
import { OptionSelect, OptionSelectItem } from './OptionSelect';
import { RATING_OPTIONS } from '../../utils/ratings';
import RatingBadge from './RatingBadge';

export interface RatingSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  emptyLabel?: string;
  /** Render a RatingBadge alongside the short code instead of the full description. */
  showBadge?: boolean;
  helperText?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  labelId?: string;
}

/** Default-rating dropdown backed by the shared RATING_OPTIONS. */
export function RatingSelect({
  label = 'Content Rating',
  emptyLabel = 'No Override',
  showBadge = false,
  ...rest
}: RatingSelectProps) {
  const options: OptionSelectItem[] = RATING_OPTIONS.filter((option) => option.value !== '').map(
    (option) => ({
      value: option.value,
      label: showBadge ? (
        <>
          <RatingBadge rating={option.value} size="small" style={{ marginRight: 8 }} /> {option.shortLabel}
        </>
      ) : (
        option.label
      ),
    })
  );

  return <OptionSelect options={options} label={label} emptyLabel={emptyLabel} {...rest} />;
}

export default RatingSelect;
