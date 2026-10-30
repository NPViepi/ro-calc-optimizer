import { createElement } from 'react';
import { Select } from '../ui/select';
import { keyActivate } from '../ui/key-activate';
import { useTooltip } from '../ui/tooltip';
import { useText } from '../state/use-text';
import { hoverless } from '../ui/viewport';
import './status-input.css';

export interface StatusInputProps {
  label: string; dropdownList: any[]; value: number | undefined; onChange: (value: number) => void;
  extraValue?: number; showExtra?: boolean; badgeSeverity?: 'success' | 'info' | 'warning' | 'danger';
  disabled?: boolean; extraClickable?: boolean; compareExtraValue?: number | null;
  otherValue?: number | null; otherLabel?: string; onExtraClick?: () => void; onCompareExtraClick?: () => void;
}
const signed = (value: number) => value < 0 ? String(value) : `+${value}`;
export function StatusInput({ label, dropdownList, value, onChange, extraValue = 0, showExtra = true,
  badgeSeverity = 'info', disabled = false, extraClickable = true, compareExtraValue = null,
  otherValue = null, otherLabel = '', onExtraClick, onCompareExtraClick }: StatusInputProps) {
  const t = useText();
  const otherText = otherValue == null || otherValue === (Number(value) || 0) ? null : String(otherValue);
  const delta = compareExtraValue != null && compareExtraValue !== extraValue;
  const clickable = !!extraValue && extraClickable;
  const captionTip = useTooltip({ text: otherText ? t('calc.statOther', { stat: label, side: otherLabel, value: otherText }) : '', position: 'top', showDelay: 300 });
  const deltaTip = useTooltip({ text: t('calc.statCompare', { stat: label }), position: 'top', showDelay: 300, tap: false });
  return createElement('app-status-input', null, <div className="status_input">
    <div className="joined_field">
      {/* With the other build's value the label holds a tip: it takes focus, and on touch a
          tap opens the tip only (not also the field the label points at). */}
      <label {...captionTip.triggerProps} tabIndex={otherText ? 0 : undefined}
        onClick={event => { if (otherText && hoverless()) event.preventDefault(); captionTip.triggerProps.onClick?.(event); }}
        className={`joined_caption status_label ${otherText ? 'status_label--other' : ''}`} htmlFor={label}>{label}{otherText && <span className="status_other">{otherText}</span>}</label>
      {captionTip.tooltip}
      <Select panelClassName="joined-dropdown-panel" disabled={disabled} inputId={label} autoDisplayFirst={false}
        options={dropdownList} filter filterBy="label" scrollHeight="350px" resetFilterOnHide value={value} onChange={onChange}
        emptyFilterMessage="" renderFilterIcon={() => null} />
    </div>
    {showExtra && <span className="status_badges"><span className={`status_badge_stack ${delta ? 'status_badge_stack--delta' : ''}`}>
      <span {...keyActivate(clickable)} className={`status_extra ${badgeSeverity === 'info' ? 'text-cyan-300' : 'text-yellow-400'} ${clickable ? 'bonus_clickable' : ''}`}
        onClick={() => { if (clickable) onExtraClick?.(); }}>{signed(extraValue)}</span>
      {delta && <span {...deltaTip.triggerProps} {...keyActivate()} className={`status_delta bonus_clickable status_delta--${compareExtraValue! > extraValue ? 'up' : 'down'}`}
        onClick={onCompareExtraClick}>{signed(compareExtraValue!)}</span>}
      {delta && deltaTip.tooltip}
    </span></span>}
  </div>);
}
