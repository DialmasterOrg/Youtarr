import React from 'react';
import { cn } from '../../../lib/cn';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { InfoTooltip } from './InfoTooltip';

const PHONE_QUERY = '(max-width: 767px)';

/** Grows a button's clickable box to 44px without changing layout. */
export const PHONE_HIT_AREA = '[&_button]:relative [&_button]:after:absolute [&_button]:after:-inset-2.5 [&_button]:after:content-[\'\']';

export const settingDescriptionId = (controlId: string) => `${controlId}-description`;

export interface SettingRowProps {
  /** Id of the form control; the label points at it */
  controlId: string;
  label: React.ReactNode;
  /** Always visible; wraps, never truncates */
  description?: React.ReactNode;
  /** Long detail only, after the label */
  tooltip?: string;
  onMobileTooltipClick?: (text: string) => void;
  /** E.g. the Platform Managed chip, after the label */
  badge?: React.ReactNode;
  control?: React.ReactNode;
  /** link: a right-aligned text link, 44px tall on phones */
  controlSize?: 'switch' | 'select' | 'select-compact' | 'link';
  /** A select drops below the text on phones */
  stackControlOnPhone?: boolean;
  /** Full-width content under the row */
  children?: React.ReactNode;
  disabled?: boolean;
}

/** Label and visible description on the left, the control on the right (Core 2.2). */
export function SettingRow({
  controlId, label, description, tooltip, onMobileTooltipClick, badge, control, controlSize = 'switch',
  stackControlOnPhone = false, children, disabled = false,
}: SettingRowProps) {
  const phone = useMediaQuery(PHONE_QUERY);
  const isSelect = controlSize === 'select' || controlSize === 'select-compact';
  const stacked = phone && stackControlOnPhone && isSelect;
  const controlClass = cn(
    'shrink-0 pt-0.5',
    controlSize === 'switch' && phone && PHONE_HIT_AREA,
    controlSize === 'link' && phone && '[&>*]:inline-flex [&>*]:min-h-[44px] [&>*]:items-center',
    isSelect && (stacked ? 'w-full [&>*]:min-h-[44px] [&>*]:w-full' : phone ? 'w-28 [&>*]:min-h-[44px] [&>*]:w-full' : 'w-60 [&>*]:w-full'),
  );
  return (
    <div className={cn(phone ? 'px-4 py-3.5' : 'px-5 py-4', disabled && 'opacity-60')}>
      <div className={cn('flex justify-between', stacked ? 'flex-col gap-3' : 'items-start', phone ? 'gap-3' : 'gap-6')}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <label htmlFor={controlId} className="text-sm font-medium leading-5 text-foreground">{label}</label>
            {tooltip && (
              <span className={cn('inline-flex', phone && PHONE_HIT_AREA)}>
                <InfoTooltip text={tooltip} onMobileClick={onMobileTooltipClick} />
              </span>
            )}
            {badge}
          </div>
          {description && (
            <p id={settingDescriptionId(controlId)} className="mt-1 text-[13px] leading-[19.5px] text-muted-foreground">{description}</p>
          )}
        </div>
        {control && <div className={controlClass}>{control}</div>}
      </div>
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

export default SettingRow;
