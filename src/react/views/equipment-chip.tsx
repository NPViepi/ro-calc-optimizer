import { createElement, useRef, useSyncExternalStore } from 'react';
import { ChipView } from '../../app/layout/pages/ro-calculator/equipment-grid/chip-view.model';
import { ItemModel } from '../../app/models/item.model';
import { itemDescPopoverHtml } from '../../app/utils/pretty-item-desc';
import { DescriptionStore } from '../services/data-client';
import { iconUrl, missingIcon } from '../services/assets';
import { useTooltip } from '../ui/tooltip';
import './equipment-chip.css';

export interface EquipmentChipProps {
  view: ChipView; items?: Record<number, ItemModel>; descriptions: DescriptionStore; compare?: boolean;
  customIcon?: (id: number) => number | undefined;
  onPick: (anchor: HTMLElement) => void; onEdit?: (id: number) => void; onClear?: () => void;
}
export function EquipmentChip({ view, items, descriptions, compare = false, customIcon, onPick, onEdit, onClear }: EquipmentChipProps) {
  useSyncExternalStore(descriptions.subscribe, descriptions.getSnapshot);
  const description = view.descId && items ? itemDescPopoverHtml(items[view.descId], descriptions.get(view.descId)) : '';
  // A tap on the chip opens the picker, so none of these tips opens by tap. The item
  // description, the one tip that holds information, has its own info button instead.
  const rich = useTooltip({ text: description, escape: false, className: 'item_desc_tooltip', position: 'top', showDelay: 350, tap: false });
  const plain = useTooltip({ text: view.descId ? '' : view.text, position: 'top', showDelay: 350, tap: false });
  const previewNote = 'Prévia: item ainda não lançado no LATAM — nome e descrição em inglês, do kRO/iRO (divine-pride).';
  const preview = useTooltip({ text: previewNote, position: 'top', showDelay: 300, tap: false });
  // What the info button opens: the description, led by the preview note that a mouse
  // reads from the "Prévia" tag's own tip.
  const info = useTooltip({ text: view.preRelease && description ? `<p>${previewNote}</p>${description}` : description,
    escape: false, className: 'item_desc_tooltip', position: 'top', tap: false });
  const clear = useTooltip({ text: 'Remover', position: 'top', showDelay: 300, tap: false });
  const edit = useTooltip({ text: 'Item customizado. Clique para editar.', position: 'top', showDelay: 300, tap: false });
  const picker = useRef<HTMLButtonElement>(null);
  return createElement('app-equipment-chip', null, <>
    <span className="eq-chip__picker"><button {...rich.triggerProps} ref={picker} type="button"
      className={`eq-chip ${view.filled ? 'eq-chip--filled' : ''} ${view.primary ? 'eq-chip--primary' : ''} ${compare ? 'eq-chip--compare' : ''} ${view.elementClass ? 'eq-chip--element' : ''} ${view.elementClass ?? ''}`}
      aria-description={view.preRelease ? previewNote : undefined} onClick={event => onPick(event.currentTarget)}>
      {view.icon && <img className="eq-chip__icon" src={iconUrl(view.icon, 'item', customIcon)} alt="" loading="lazy" {...missingIcon} />}
      <span {...plain.triggerProps} className="eq-chip__text">{view.text}</span>
      {view.preRelease && <span {...preview.triggerProps} className="pre_release_tag">Prévia</span>}
    </button>
      {view.filled && view.chip.clearable !== false && <button {...clear.triggerProps} type="button" className="eq-chip__clear" aria-label={`Remover ${view.text}`} onClick={onClear}>✕</button>}
      {description && <button type="button" className="tip-info tip-info--action" aria-label={`Ver descrição: ${view.text}`}
        onClick={event => {
          // The tap that opens the sheet must not reach the sheet's outside-click listener.
          event.preventDefault(); event.stopPropagation(); info.openFor(picker.current);
        }}>ⓘ</button>}
    </span>
    {view.descId && items?.[view.descId]?.custom && <button {...edit.triggerProps} type="button" className={`eq-chip__custom ui-tag ${view.primary ? 'eq-chip__custom--primary' : ''}`}
      aria-label={`Editar item customizado: ${view.text}`} onClick={() => onEdit?.(view.descId!)}>Customizado</button>}
    {rich.tooltip}{info.tooltip}{plain.tooltip}{view.preRelease && preview.tooltip}{clear.tooltip}{edit.tooltip}
  </>);
}
