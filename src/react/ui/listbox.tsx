import { CSSProperties, KeyboardEvent, ReactNode, SyntheticEvent, createElement } from 'react';
import { optionLabel, optionValue, chooseSelection } from './selection';
import { InsideOption } from './select';
import { forwardTipFocus } from './tooltip';

export interface ListboxProps {
  options: any[]; value: any;
  onChange: (value: any, event: SyntheticEvent) => void;
  multiple?: boolean; disabled?: boolean; ariaLabel?: string;
  className?: string; listStyle?: CSSProperties;
  optionLabel?: string; optionValue?: string;
  renderItem?: (option: any, index: number) => ReactNode;
}
export function Listbox({ options, value, onChange, multiple = false, disabled = false, ariaLabel,
  className = '', listStyle, optionLabel: labelKey, optionValue: valueKey, renderItem }: ListboxProps) {
  const selected = (option: any) => multiple ? (value ?? []).includes(optionValue(option, valueKey, labelKey)) : value === optionValue(option, valueKey, labelKey);
  const pick = (option: any, event: SyntheticEvent) => {
    if (disabled || option?.disabled) return;
    onChange(chooseSelection(value, option, multiple, true, disabled, valueKey, labelKey), event);
  };
  const key = (option: any, event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(option, event); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      (event.key === 'ArrowDown' ? event.currentTarget.nextElementSibling as HTMLElement : event.currentTarget.previousElementSibling as HTMLElement)?.focus();
    }
  };
  return createElement('app-ui-listbox', null, <div className={`ui-listbox ui-component ${className}`}>
    <div className="ui-listbox-list-wrapper" style={listStyle}><ul className="ui-listbox-list" role="listbox" aria-label={ariaLabel} aria-multiselectable={multiple}>
      {options.map((option, index) => <li key={index} className={`ui-listbox-item ${selected(option) ? 'ui-highlight' : ''} ${disabled || option?.disabled ? 'ui-disabled' : ''}`}
        role="option" aria-selected={selected(option)} tabIndex={disabled || option?.disabled ? -1 : 0}
        onClick={event => pick(option, event)} onKeyDown={event => key(option, event)} {...forwardTipFocus}>
        {renderItem ? <InsideOption.Provider value>{renderItem(option, index)}</InsideOption.Provider> : optionLabel(option, labelKey)}
      </li>)}
    </ul></div>
  </div>);
}
