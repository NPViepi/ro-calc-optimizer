import { Children, Fragment, ReactNode, createContext, createElement, isValidElement, useCallback, useContext, useState, useSyncExternalStore } from 'react';
import { useServices } from '../services/application';
import { useText } from '../state/use-text';
import { missingIcon } from '../services/assets';
import { Accordion } from '../ui/accordion';
import { Block } from '../ui/block';
import { Dialog } from '../ui/dialog';
import { keyActivate } from '../ui/key-activate';
import { Listbox } from '../ui/listbox';
import { ConfirmDialog, Toast } from '../ui/notifications';
import { Popover } from '../ui/popover';
import { PopoverHandle } from '../ui/popover-handle';
import { Button, Card, Checkbox, Chip, Icon, Input, Switch, Tag } from '../ui/primitives';
import { useReorder } from '../ui/reorder';
import { InsideOption, Select } from '../ui/select';
import { InsideControl, SelectButton } from '../ui/select-button';
import { Table } from '../ui/table';
import { useTooltip } from '../ui/tooltip';
import { VirtualList } from '../ui/virtual-list';
import { BattleEffects } from './battle-effects';
import { BattleMonsterCard } from './battle-monster-card';
import { CalcValue } from './calc-value';
import { EquipmentChip } from './equipment-chip';
import { StatusInput } from './status-input';
import { normalizeStyle } from './template-values';
export { displayPipe, interpolate, classNames, parseStyle, normalizeStyle, identityKey } from './template-values';

type Props = Record<string, any>;
const RowSelectionContext = createContext<Props | null>(null);
type View = (props: Props) => ReactNode;
const featureViews = new Map<string, View>();
/** Static feature composition, installed once by the application entry. */
export function registerViews(views: Record<string, View>): void {
  for (const [name, view] of Object.entries(views)) featureViews.set(name, view);
}
const eventNames: Record<string, string> = { click: 'onClick', dblclick: 'onDoubleClick', keydown: 'onKeyDown', keyup: 'onKeyUp', blur: 'onBlur', focus: 'onFocus', focusout: 'onBlur', input: 'onInput', change: 'onChange', error: 'onError', load: 'onLoad', scroll: 'onScroll', pointerdown: 'onPointerDown', mouseenter: 'onMouseEnter', mouseleave: 'onMouseLeave', submit: 'onSubmit', paste: 'onPaste', contextmenu: 'onContextMenu', dragover: 'onDragOver', dragleave: 'onDragLeave', drop: 'onDrop' };
function mergeProps(...entries: Props[]): Props {
  const result: Props = {};
  for (const props of entries) for (const [key, value] of Object.entries(props)) {
    const previous = result[key];
    result[key] = key.startsWith('on') && typeof previous === 'function' && typeof value === 'function'
      ? (...args: any[]) => { previous(...args); value(...args); } : value;
  }
  return result;
}
function ManagedPopover({ handle, props, children }: { handle: PopoverHandle; props: Props; children: ReactNode }) {
  const anchor = useSyncExternalStore(handle.subscribe, handle.getSnapshot);
  const containerRef = useCallback((element: HTMLDivElement | null) => { handle.container = element; }, [handle]);
  return <Popover anchor={anchor} onClose={() => { handle.hide(); props['onHide']?.(); }} className={props['styleClass'] ?? props['className']}
    centered={props['centered']} ariaLabel={props['ariaLabel']} containerRef={containerRef}>{children}</Popover>;
}
function PopoverView({ props, reference, children }: { props: Props; reference?: (value: any) => void; children?: ReactNode }) {
  const [popover] = useState(() => new PopoverHandle());
  const handle = props['handle'] ?? popover;
  reference?.(handle);
  return <ManagedPopover handle={handle} props={props}>{children}</ManagedPopover>;
}
interface RenderProps { tag: string; props: Props; children?: ReactNode; }
interface RenderContext { services: ReturnType<typeof useServices>; rowSelection: Props | null; }
// Elements that take focus and a tap on their own; any other tooltip anchor is given a
// tab stop so its tip opens from the keyboard and by touch, not only under a mouse.
const FOCUSABLE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea']);
function InteractiveRender({ input, context }: { input: RenderProps; context: RenderContext }) {
  const t = useText();
  const { tooltip: options, reorderIndex, reorderDisabled, reordered } = input.props;
  // A click that `activateWithKeys: false` marks as dormant (the row is not clickable
  // right now) is no action, so a tap is free to open the tip.
  const ownAction = typeof input.props['click'] === 'function' && !('activateWithKeys' in input.props && !input.props['activateWithKeys']);
  const insideOption = useContext(InsideOption);
  const insideControl = useContext(InsideControl);
  const { triggerProps, tooltip, openFor } = useTooltip({ ...(options ?? { text: '' }), tap: !ownAction && !insideOption });
  const reorder = useReorder(reorderIndex ?? 0, reordered ?? (() => {}), reorderIndex == null || reorderDisabled);
  const informative = !!options?.text && !options.disabled;
  // Inside an option or a button that row or button is the focus stop; elsewhere the anchor needs one.
  const focusProps: Props = !informative || insideOption || insideControl || FOCUSABLE_TAGS.has(input.tag) || input.props['tabIndex'] != null ? {}
    : input.tag === 'app-icon' ? { tabIndex: 0, role: 'img', 'aria-hidden': 'false', 'aria-label': options.escape === false ? undefined : options.text }
    : { tabIndex: 0 };
  // A scrollable item description has no touch equivalent when a tap on its anchor
  // already does something else (picks a list option, opens a picker). The info button
  // opens the same description without that action; CSS shows it only without hover.
  const describes = informative && (ownAction || insideOption) && String(options?.className ?? '').includes('item_desc_tooltip');
  return <>{renderElement(input, context, { ...triggerProps, ...focusProps }, reorder)}
    {describes && <button type="button" className={`tip-info ${ownAction ? 'tip-info--action' : ''}`} aria-label={t('ui.viewDescription')}
      onClick={event => { event.preventDefault(); event.stopPropagation(); openFor(event.currentTarget.previousElementSibling as HTMLElement | null); }}>ⓘ</button>}
    {tooltip}</>;
}
/** Binds local React primitives; calculation and feature logic live in their views. */
export function Render(input: RenderProps) {
  const services = useServices();
  const rowSelection = useContext(RowSelectionContext);
  const context = { services, rowSelection };
  // Plain elements and controls need no tooltip timers, drag effects or popover
  // stores. Keep hooks in a separate component so optional bindings stay legal.
  return input.props['tooltip'] || input.props['reorderIndex'] != null
    ? <InteractiveRender input={input} context={context} /> : renderElement(input, context);
}
function renderElement({ tag, props: original, children }: RenderProps, { services, rowSelection }: RenderContext,
  triggerProps: Props = {}, reorder?: (event: any) => void): ReactNode {
  const { tooltip: tooltipOptions, activateWithKeys, reorderIndex, reorderDisabled, reordered, reference,
    missingIcon: hideBrokenIcon, button, inputText, badge, ...props } = original;
  const attach = reference ? (element: any) => reference(element) : undefined;
  const attachIcon = reference ? (element: HTMLElement | null) => reference(element ? { nativeElement: element } : null) : undefined;
  const mappedProps = Object.fromEntries(Object.entries(props).map(([key, value]) => [eventNames[key] ?? key, value]));
  const modelChange = (value: any, event: any) => { props['onModelChange']?.(value, event); props['onChange']?.({ originalEvent: event, value }); };
  const template = (name: string) => props[`template_${name}`];
  const selection = {
    ...props, options: props['options'] ?? [], listStyle: normalizeStyle(props['listStyle']), className: props['styleClass'] ?? props['className'], onChange: modelChange,
    renderItem: template('item') ? (item: any) => template('item')({ $implicit: item }) : undefined,
    renderSelected: template('selectedItem') ? (item: any) => template('selectedItem')({ $implicit: item }) : undefined,
    renderGroup: template('group') ? (item: any) => template('group')({ $implicit: item }) : undefined,
    onOpened: props['opened'] ?? props['onShow'], onClosed: props['closed'] ?? props['onHide'], onCleared: props['cleared'] ?? props['onClear'],
  };
  let rendered: ReactNode;
  switch (tag) {
    case 'app-icon': rendered = <Icon {...mergeProps(mappedProps, triggerProps, activateWithKeys ? keyActivate(activateWithKeys) : {}, reorderIndex == null ? {} : { onPointerDown: reorder }) as any}
      className={`${props['className'] ?? ''} ${badge ? 'ui-overlay-badge' : ''}`} ref={attachIcon}>
      {badge && <span className={`ui-badge ui-component ui-badge-${props['severity'] ?? ''}${String(props['value']).length === 1 ? ' ui-badge-single' : ''}`}>{props['value']}</span>}
    </Icon>; break;
    case 'app-ui-card': rendered = <Card className={props['styleClass'] ?? props['className']}>{children}</Card>; break;
    // A tag with a click (the rotation's element tag) is a button: the click is wired and Enter / Space press it.
    case 'app-ui-tag': rendered = <Tag {...mergeProps(mappedProps, triggerProps, typeof props['click'] === 'function' ? keyActivate(activateWithKeys ?? true) : {}) as any}
      className={props['styleClass'] ?? props['className']} />; break;
    case 'app-ui-chip': rendered = <Chip {...props as any} />; break;
    case 'app-ui-dropdown': case 'app-ui-multi-select': case 'app-ui-multiselect': case 'app-ui-cascade-select': case 'app-ui-cascadeselect':
      rendered = <Select {...selection as any} ref={attach} kind={tag === 'app-ui-dropdown' ? 'dropdown' : tag === 'app-ui-multiselect' || tag === 'app-ui-multi-select' ? 'multiselect' : 'cascadeselect'} />; break;
    case 'app-ui-select-button': case 'app-ui-selectbutton': rendered = <SelectButton {...selection as any} />; break;
    case 'app-ui-listbox': rendered = <Listbox {...selection as any} />; break;
    case 'app-ui-checkbox': rendered = <Checkbox {...props as any} onChange={modelChange} />; break;
    case 'app-ui-input-switch': case 'app-ui-switch': rendered = <Switch {...props as any} onChange={modelChange} />; break;
    case 'app-ui-dialog': rendered = <Dialog {...props as any} header={template('header')?.({}) ?? props['header']}
      footer={template('footer')?.({})} contentStyle={normalizeStyle(props['contentStyle'])} className={props['styleClass'] ?? props['className']} onVisibleChange={props['visibleChange']} onClosed={props['onHide']}>{children}</Dialog>; break;
    case 'app-ui-popover':
      rendered = <PopoverView props={props} reference={reference}>{children}</PopoverView>; break;
    case 'app-ui-block': rendered = <Block blocked={props['blocked']} />; break;
    case 'app-ui-toast': rendered = <Toast service={services.messages} />; break;
    case 'app-ui-confirm-dialog': rendered = <ConfirmDialog service={services.confirmations} />; break;
    case 'app-virtual-list': case 'app-ui-virtual-list': rendered = <VirtualList {...props as any} height={Number.parseFloat(props['height'] ?? props['style']?.height ?? '300')}
      getKey={props['trackBy'] ? (item: any, index: number) => props['trackBy'](index, item) : undefined}
      ref={attach} renderItem={(item: any, index: number) => template('item')({ $implicit: item, index })} />; break;
    case 'app-ui-table': rendered = <Table {...props as any} value={props['value'] ?? []} tableStyle={normalizeStyle(props['tableStyle'])} className={props['styleClass'] ?? props['className']}
      header={template('header')?.({})} renderRow={(row: any, index: number, selectionProps) => <RowSelectionContext.Provider key={index} value={selectionProps}>
        {template('body')?.({ $implicit: row, rowIndex: index })}</RowSelectionContext.Provider>}
      emptyMessage={template('emptymessage')?.({})} onFirstChange={props['firstChange']} onSelectionChange={props['selectionChange']}
      onRowSelected={props['onRowSelect']} onRowUnselected={props['onRowUnselect']} />; break;
    case 'app-ui-accordion': {
      const tabs: any[] = [];
      const collect = (nodes: ReactNode) => Children.forEach(nodes, child => {
        if (!isValidElement<Props>(child)) return;
        if (child.type === Fragment) collect((child as React.ReactElement<Props>).props['children']);
        else if ((child as React.ReactElement<Props>).props['tag'] === 'app-ui-accordion-tab') {
          const tab = (child as React.ReactElement<Props>).props['props'];
          tabs.push({ key: String(child.key ?? tabs.length), header: tab.template_header?.({}) ?? tab.header, className: tab.className, style: tab.style, children: (child as React.ReactElement<Props>).props['children'] });
        }
      });
      collect(children);
      rendered = <Accordion {...props as any} tabs={tabs} onActiveIndexChange={props['activeIndexChange']}
        onTabOpened={props['tabOpened'] ?? props['onOpen']} onTabClosed={props['tabClosed'] ?? props['onClose']} />; break;
    }
    case 'app-calc-value': rendered = <CalcValue {...props as any} />; break;
    case 'app-status-input': rendered = <StatusInput {...props as any} onChange={props['valueChange'] ?? modelChange} onExtraClick={props['extraClick']} onCompareExtraClick={props['compareExtraClick']} />; break;
    case 'app-equipment-chip': rendered = <EquipmentChip {...props as any} descriptions={services.data.descriptions}
      customIcon={id => services.customItems.iconFor(id)} onPick={props['pick']} onEdit={props['edit']} onClear={props['clear']} />; break;
    case 'app-battle-effects': rendered = <BattleEffects {...props as any} onChange={props['selectedChancesChange']}
      onCompareChange={props['selectedChances2Change']} customIcon={id => services.customItems.iconFor(id)} />; break;
    case 'app-battle-monster-card': rendered = <BattleMonsterCard {...props as any} onRelieveLevelChange={props['relieveLevelChange']}
      onBetelgeuseHpChange={props['betelgeuseHpChange']}
      onIncomingReductionClick={props['incomingReductionClick']}
      onShowElementTable={props['showElementTableClick']} onReductionRowClick={props['reductionRowClick']} />; break;
    default: {
      const feature = featureViews.get(tag);
      if (feature) { rendered = createElement(feature, { ...props, reference, children }); break; }
      if (tag.startsWith('app-')) throw new Error(`Unregistered React view: ${tag}`);
      const native: Props = {};
      for (const [key, value] of Object.entries(props)) {
        if (key.startsWith('template_') || ['onModelChange', 'ngSwitch', 'tooltipPosition', 'tooltipStyleClass', 'appSelectableRow'].includes(key)) continue;
        native[eventNames[key] ?? key] = value;
      }
      if (props['onModelChange']) {
        if (tag === 'input' && props['type'] === 'checkbox') { native['checked'] = !!props['value']; delete native['value']; }
        else native['value'] = props['value'] ?? '';
        native['onChange'] = (event: React.ChangeEvent<HTMLInputElement>) => modelChange(props['type'] === 'checkbox' ? event.target.checked : props['type'] === 'number' ? event.target.value === '' ? null : Number(event.target.value) : event.target.value, event);
      }
      if ('appSelectableRow' in props && rowSelection) {
        Object.assign(native, mergeProps(native, rowSelection));
        native['className'] = [props['className'], rowSelection['className']].filter(Boolean).join(' ');
      }
      const decorated = mergeProps(native, triggerProps, activateWithKeys ? keyActivate(activateWithKeys) : {}, hideBrokenIcon ? missingIcon : {}, reorderIndex == null ? {} : { onPointerDown: reorder }, { ref: attach });
      if (button && tag === 'button') rendered = <Button {...decorated}>{children}</Button>;
      else if (button && tag === 'a') {
        const { icon, label, iconPos = 'left', ...anchorProps } = decorated;
        rendered = <a {...anchorProps} className={`ui-button ui-component ${props['className'] ?? ''}`}>
          {icon && <Icon name={icon} className={`ui-button-icon ui-button-icon-${iconPos}`} />}
          {children}{label && <span className="ui-button-label">{label}</span>}
        </a>;
      }
      else if (inputText && tag === 'input') rendered = <Input {...decorated} />;
      else rendered = createElement(tag, decorated, children);
    }
  }
  return rendered;
}
