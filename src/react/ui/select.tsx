import { Fragment, KeyboardEvent, ReactNode, Ref, SyntheticEvent, createContext, createElement, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Portal } from './portal';
import { Icon } from './primitives';
import { optionLabel, optionValue, chooseSelection, filteredRows, toggleAllSelection } from './selection';
import { VirtualList, VirtualListHandle } from './virtual-list';

/** True inside a rendered option (or a select's shown value), where a tap picks or opens rather than reaching the content. */
export const InsideOption = createContext(false);
export interface SelectHandle { setPanelWidth(width: number, constrain?: boolean): void; }
export interface SelectProps {
  ref?: Ref<SelectHandle>;
  options: any[]; value: any;
  onChange: (value: any, event: SyntheticEvent) => void;
  kind?: 'dropdown' | 'multiselect' | 'cascadeselect';
  optionLabel?: string; optionValue?: string; group?: boolean;
  disabled?: boolean; inputId?: string; ariaLabel?: string; ariaLabelledBy?: string;
  filter?: boolean; filterBy?: string; filterPlaceholder?: string;
  optionFilter?: (option: any) => boolean;
  placeholder?: string; defaultLabel?: string; selectedItemsLabel?: string;
  showClear?: boolean; showToggleAll?: boolean; resetFilterOnHide?: boolean;
  autoDisplayFirst?: boolean; autofocus?: boolean; scrollHeight?: string;
  className?: string; panelClassName?: string; emptyFilterMessage?: string;
  virtualScroll?: boolean; virtualScrollItemSize?: number;
  optionGroupLabel?: string; optionGroupChildren?: string[];
  renderItem?: (option: any) => ReactNode; renderSelected?: (option: any) => ReactNode;
  renderGroup?: (option: any) => ReactNode; renderFilterIcon?: () => ReactNode;
  onOpened?: () => void; onClosed?: () => void; onCleared?: () => void; onBlur?: () => void;
}
interface Row { option: any; group?: boolean; }
export function Select({ options, value, onChange, kind = 'dropdown', optionLabel: labelKey = '', optionValue: valueKey = '',
  group = false, disabled = false, inputId, ariaLabel, ariaLabelledBy, filter = false, filterBy = 'label', filterPlaceholder = '',
  placeholder = '', defaultLabel = '', selectedItemsLabel = '{0} selecionados', showClear = false, showToggleAll = true,
  resetFilterOnHide = false, autoDisplayFirst = true, autofocus = false, scrollHeight = '200px', className = '', panelClassName = '',
  emptyFilterMessage = 'Nenhum resultado encontrado', virtualScroll = false, virtualScrollItemSize = 38,
  optionGroupLabel = 'label', optionGroupChildren = ['items'], renderItem, renderSelected, renderGroup, renderFilterIcon,
  onOpened, onClosed, onCleared, onBlur, optionFilter, ref }: SelectProps) {
  const id = `ui-select-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const multi = kind === 'multiselect';
  const cascade = kind === 'cascadeselect';
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const viewport = useRef<VirtualListHandle>(null);
  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number | undefined>();
  useImperativeHandle(ref, () => ({ setPanelWidth(width) { setPanelWidth(width); } }), []);
  const [query, setQuery] = useState('');
  const previousQuery = useRef(query);
  const [active, setActive] = useState(-1);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [path, setPath] = useState<any[]>([]);
  const labelOf = (option: any) => optionLabel(option, labelKey);
  const valueOf = (option: any) => optionValue(option, valueKey, labelKey);
  const selected = (option: any) => multi ? (value ?? []).includes(valueOf(option)) : value === valueOf(option);
  const childrenOf = (option: any, depth: number): any[] => option?.[optionGroupChildren[depth] ?? optionGroupChildren[optionGroupChildren.length - 1] ?? 'items'] ?? [];
  const leaves = useMemo(() => {
    const collect = (entries: any[], depth = 0): any[] => entries.flatMap(option => cascade && childrenOf(option, depth).length ? collect(childrenOf(option, depth), depth + 1) : [option]);
    return group ? options.flatMap(option => option.items ?? []) : collect(options);
  }, [options, group, cascade, optionGroupChildren.join(',')]);
  const rows = useMemo<Row[]>(() => filteredRows(options, query, group, filterBy, labelKey, optionFilter), [options, query, group, filterBy, labelKey, optionFilter]);
  const selectedOption = leaves.find(selected) ?? (!multi && !placeholder && autoDisplayFirst && value == null ? leaves[0] : null);
  useLayoutEffect(() => {
    if (previousQuery.current === query) return;
    previousQuery.current = query;
    setActive(rows.findIndex(row => !row.group && !row.option?.disabled));
  }, [query, rows]);
  const selectedLeaves = multi ? leaves.filter(selected) : [];
  const label = multi ? selectedLeaves.length > 3 ? selectedItemsLabel.replace('{0}', String(selectedLeaves.length)) : selectedLeaves.length ? selectedLeaves.map(labelOf).join(', ') : placeholder || defaultLabel || '\u00a0'
    : selectedOption != null ? labelOf(selectedOption) : placeholder || '\u00a0';
  const hasValue = multi ? !!value?.length : value != null;
  const hide = (restore = false) => {
    if (!open) return;
    setOpen(false);
    if (resetFilterOnHide) setQuery('');
    onBlur?.();
    if (restore) trigger.current?.focus({ preventScroll: true });
    onClosed?.();
  };
  const show = () => {
    if (open || disabled) return;
    setPath([]); setKeyboardActive(false);
    const current = rows.findIndex(row => !row.group && selected(row.option));
    setActive(current < 0 ? rows.findIndex(row => !row.group && !row.option?.disabled) : current);
    setOpen(true);
  };
  const choose = (option: any, event: SyntheticEvent) => {
    if (disabled || option?.disabled) return;
    onChange(chooseSelection(value, option, multi, false, disabled, valueKey, labelKey), event);
    if (!multi) hide(true);
  };
  const onKey = (event: KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); hide(true); return; }
    if (event.key === 'Tab') { hide(true); return; }
    const editing = (event.target as HTMLElement).tagName === 'INPUT';
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key) || (!editing && event.key === ' ')) {
      event.preventDefault(); event.stopPropagation();
      if (!open) { show(); return; }
      if (cascade) { panel.current?.querySelector<HTMLButtonElement>('.ui-cascadeselect-item-content')?.focus(); return; }
      if (event.key === 'Enter' || event.key === ' ') { const row = rows[active]; if (row && !row.group) choose(row.option, event); return; }
      const enabled = rows.map((row, index) => !row.group && !row.option?.disabled ? index : -1).filter(index => index >= 0);
      const at = enabled.indexOf(active);
      setKeyboardActive(true);
      setActive(event.key === 'Home' ? enabled[0] ?? -1 : event.key === 'End' ? enabled[enabled.length - 1] ?? -1 : enabled[Math.max(0, Math.min(enabled.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))] ?? -1);
    } else if (!editing && event.key.length === 1) {
      const next = rows.findIndex(row => !row.group && !row.option?.disabled && labelOf(row.option).toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (next >= 0) { setActive(next); if (!open && !multi && !cascade) choose(rows[next].option, event); }
    }
  };
  useLayoutEffect(() => {
    if (!autofocus) return;
    trigger.current?.focus();
  }, [autofocus]);
  useLayoutEffect(() => { if (disabled && open) hide(); }, [disabled, open]);
  useLayoutEffect(() => {
    if (!open) return undefined;
    // The portal's mount needs a render before its search field exists.
    let alive = true;
    const frame = requestAnimationFrame(() => {
      if (!alive) return;
      panel.current?.querySelector<HTMLInputElement>('.ui-dropdown-filter')?.focus({ preventScroll: true });
      onOpened?.();
    });
    return () => { alive = false; cancelAnimationFrame(frame); };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    viewport.current?.scrollToIndex(Math.max(0, active));
    panel.current?.querySelector<HTMLElement>(`#${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, id]);
  useLayoutEffect(() => {
    panel.current?.querySelectorAll<HTMLElement>('.ui-cascadeselect-sublist').forEach(list => {
      list.style.left = '100%'; list.style.right = 'auto'; list.style.top = '0'; list.style.maxHeight = `${window.innerHeight - 16}px`;
      const rect = list.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) { list.style.left = 'auto'; list.style.right = '100%'; }
      if (rect.bottom > window.innerHeight - 8) list.style.top = `${Math.max(8 - rect.top, window.innerHeight - 8 - rect.bottom)}px`;
    });
  }, [path]);
  const expand = (option: any, depth: number) => { if (!option?.disabled) setPath(previous => [...previous.slice(0, depth), option]); };
  const treeKey = (option: any, depth: number, event: KeyboardEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    if (event.key === 'ArrowRight' && childrenOf(option, depth).length) {
      event.preventDefault(); expand(option, depth);
      requestAnimationFrame(() => button.parentElement?.querySelector<HTMLElement>(':scope > ul > li > button:not(:disabled)')?.focus());
    } else if (event.key === 'ArrowLeft' && depth > 0) {
      event.preventDefault(); const parent = button.closest('ul')?.parentElement;
      setPath(previous => previous.slice(0, depth - 1)); parent?.querySelector<HTMLElement>('button')?.focus();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const siblings = Array.from(button.closest('ul')?.querySelectorAll<HTMLButtonElement>(':scope > li > button:not(:disabled)') ?? []);
      const at = siblings.indexOf(button);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? siblings.length - 1 : Math.max(0, Math.min(siblings.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)));
      siblings[next]?.focus();
    } else if (event.key === 'Escape') { event.preventDefault(); hide(true); }
    event.stopPropagation();
  };
  const tree = (entries: any[], depth = 0): ReactNode => <ul className={`ui-cascadeselect-items ${depth > 0 ? 'ui-cascadeselect-sublist' : ''}`} role="listbox" id={depth === 0 ? `${id}-list` : undefined}>
    {entries.map((option, index) => <li key={index} className={`ui-cascadeselect-item ${path[depth] === option ? 'ui-highlight' : ''}`} role="option" aria-selected={selected(option)}
      // Hover previews a branch for a mouse only. By touch (or pen) the button's click below
      // is what opens it, so a tap never depends on a compatibility mouseenter.
      onPointerEnter={event => { if (event.pointerType === 'mouse') expand(option, depth); }}>
      <button type="button" className="ui-cascadeselect-item-content ui-link" disabled={option.disabled}
        aria-expanded={childrenOf(option, depth).length ? path[depth] === option : undefined}
        onClick={event => childrenOf(option, depth).length ? expand(option, depth) : choose(option, event)} onKeyDown={event => treeKey(option, depth, event)}>
        {option[optionGroupLabel] || labelOf(option)}{childrenOf(option, depth).length > 0 && <Icon name="chevron-right" />}
      </button>{path[depth] === option && childrenOf(option, depth).length > 0 && tree(childrenOf(option, depth), depth + 1)}
    </li>)}
  </ul>;
  const rowView = (row: Row, index: number) => row.group
    ? <li className={`ui-select-item-group ui-${kind}-item-group`} style={virtualScroll ? { height: virtualScrollItemSize } : undefined} role="presentation">{renderGroup ? renderGroup(row.option) : row.option.label}</li>
    : <li className={`ui-select-item ui-${kind}-item ${selected(row.option) ? 'ui-highlight' : ''} ${keyboardActive && active === index ? 'ui-focus' : ''} ${row.option?.disabled ? 'ui-disabled' : ''}`}
      style={virtualScroll ? { height: virtualScrollItemSize } : undefined} id={`${id}-option-${index}`} role="option" tabIndex={-1}
      aria-selected={selected(row.option)} aria-disabled={!!row.option?.disabled} onClick={event => choose(row.option, event)}
      onKeyDown={event => { if (event.key === 'Enter') choose(row.option, event); }}>
      {multi && <span className={`ui-checkbox-box ${selected(row.option) ? 'ui-highlight' : ''}`}>{selected(row.option) && <Icon name="check" />}</span>}
      {renderItem ? <InsideOption.Provider value>{renderItem(row.option)}</InsideOption.Provider> : labelOf(row.option)}
    </li>;
  const control = <>
    <div className={`ui-component ui-${kind} ${className} ${disabled ? 'ui-disabled' : ''} ${open ? 'ui-focus' : ''}`}
      onClick={event => { if (!disabled && event.target === event.currentTarget) { trigger.current?.focus(); open ? hide() : show(); } }}>
      <button ref={trigger} type="button" className={`ui-inputtext ui-select-trigger ui-${kind}-label ${(multi ? !hasValue : selectedOption == null) ? 'ui-placeholder' : ''}`}
        role="combobox" id={inputId || id} disabled={disabled} aria-label={ariaLabel || placeholder || defaultLabel || undefined}
        aria-labelledby={ariaLabelledBy} aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined} aria-haspopup="listbox"
        onClick={() => open ? hide() : show()} onKeyDown={onKey} onBlur={onBlur}>
        {!multi && renderSelected && selectedOption != null ? <InsideOption.Provider value>{renderSelected(selectedOption)}</InsideOption.Provider> : label}
      </button>
      {showClear && hasValue && <button type="button" className={`ui-select-clear ui-link ui-${kind}-clear-icon`} aria-label="Limpar seleção" disabled={disabled}
        onClick={event => { event.stopPropagation(); onChange(multi ? [] : null, event); onCleared?.(); }}><Icon name="times" /></button>}
      <button type="button" className={`ui-select-chevron ui-link ui-${kind}-trigger`} tabIndex={-1} disabled={disabled} aria-label="Abrir opções" onClick={() => open ? hide() : show()}><Icon name="chevron-down" /></button>
    </div>
    {open && <Portal anchor={trigger.current?.parentElement} origin={trigger.current?.parentElement} width={panelWidth} panelClass={`ui-select-pane ${panelClassName}`}
      minWidth={trigger.current?.parentElement?.getBoundingClientRect().width} onDismiss={() => hide(true)} onOutside={() => hide()}>
      <div ref={panel} className={`ui-component ui-${kind}-panel ${panelClassName}`} tabIndex={-1} onKeyDown={onKey}>
        {(filter || multi && showToggleAll) && <div className={`ui-select-header ui-${kind}-header`}>
          {multi && showToggleAll && <button type="button" className="ui-link ui-select-all" aria-label="Selecionar todos" onClick={event => {
            onChange(toggleAllSelection(value, rows, valueKey, labelKey), event);
          }}><Icon name="check" /></button>}
          {filter && <div className="ui-dropdown-filter-container"><input type="search" className="ui-inputtext ui-dropdown-filter"
            value={query} placeholder={filterPlaceholder} aria-label="Filtrar opções" aria-controls={`${id}-list`}
            aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined} name="ui-option-search" autoComplete="off"
            data-lpignore="true" data-1p-ignore data-bwignore="true" data-form-type="other" onChange={event => {
              setQuery(event.target.value); setKeyboardActive(false); setActive(-1);
            }} onKeyDown={event => { if (event.key === 'Tab' && query && !event.shiftKey) event.stopPropagation(); }} />{query ? <button type="button" className="ui-link ui-dropdown-filter-icon" aria-label="Limpar busca"
              onKeyDown={event => { if (['Enter', ' ', 'Tab'].includes(event.key)) event.stopPropagation(); }}
              onClick={() => { setQuery(''); panel.current?.querySelector('input')?.focus(); }}><Icon name="times" /></button>
              : renderFilterIcon ? renderFilterIcon() : <Icon className="ui-dropdown-filter-icon" name="search" />}</div>}
          {multi && <button type="button" className="ui-link" aria-label="Fechar opções" onClick={() => hide(true)}><Icon name="times" /></button>}
        </div>}
        {cascade ? tree(options) : virtualScroll && rows.length > 0
          ? <VirtualList ref={viewport} items={rows} itemSize={virtualScrollItemSize} height={Math.min(parseFloat(scrollHeight) || 200, rows.length * virtualScrollItemSize)}
            className="ui-select-viewport" role="listbox" id={`${id}-list`} multiselectable={multi} renderItem={rowView} />
          : <div className={`ui-select-items-wrapper ui-${kind}-items-wrapper`} style={{ maxHeight: scrollHeight }}><ul className={`ui-select-items ui-${kind}-items`} role="listbox" id={`${id}-list`} aria-multiselectable={multi}>
            {rows.map((row, index) => <Fragment key={index}>{rowView(row, index)}</Fragment>)}
            {!rows.length && <li className="ui-dropdown-empty-message">{emptyFilterMessage}</li>}
          </ul></div>}
      </div>
    </Portal>}
  </>;
  return createElement(`app-ui-${kind === 'multiselect' ? 'multi-select' : kind === 'cascadeselect' ? 'cascade-select' : 'dropdown'}`, null, control);
}
