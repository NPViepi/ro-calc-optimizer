import { useMemo, useRef, useState } from 'react';
import { inferCustomIcon } from '../../../app/core/custom-items';
import type { ApplicationServices } from '../../services/application';
import type { ItemSearchComponent } from '../../controllers/item-search';
import { iconUrl, missingIcon } from '../../services/assets';
import { useText } from '../../state/use-text';
import { Dialog } from '../../ui/dialog';
import { Popover } from '../../ui/popover';
import { Button, Checkbox, Icon, Input } from '../../ui/primitives';
import { Select } from '../../ui/select';
import { SelectButton } from '../../ui/select-button';
import { Table } from '../../ui/table';
import { hoverless, useViewportBand } from '../../ui/viewport';
import { sanitizeHtml } from '../../ui/sanitize-html';

export function Content({ vm, services }: { vm: ItemSearchComponent; services: ApplicationServices }) {
  const t = useText();
  // On a phone the filter box shows its fields and the first bonus before it scrolls, so
  // the level checkbox follows the bonuses there (in the markup, to keep the Tab order).
  const phone = useViewportBand() === 'phone';
  // A phone has no room for the filters and a usable list at once: a search folds the
  // filters away behind their heading, which reopens them.
  const [filtersFolded, setFiltersFolded] = useState(false);
  const folded = phone && filtersFolded;
  const filtersToggle = useRef<HTMLButtonElement>(null);
  // A phone has no room for the description beside or under the list: a tapped result
  // opens it in a popover by its row.
  const [detailAnchor, setDetailAnchor] = useState<HTMLElement | null>(null);
  const action = (fn: () => void) => vm.action(fn);
  const levelFilter = <div className="item-search-level">
    <Checkbox label={t('itemSearch.onlyCurrentLevel', { level: vm.currentLevel })}
      value={vm.onlyCurrentLevel} onChange={value => action(() => { vm.onlyCurrentLevel = value; })} />
  </div>;
  // Catalog scans for filter icons belong to opening search, not calculator startup —
  // and not to a language change either, which is why the icons are memoized apart
  // from the labels that `t` does affect.
  const typeIcons = useMemo(() => !vm.isShowSearchDialog ? [] : vm.itemPositions.map(option => ({
    value: option.value, icon: inferCustomIcon(option.iconKind, null, vm.items ?? {}),
  })), [vm.isShowSearchDialog, vm.itemPositions, vm.items]);
  const typeOptions = useMemo(() => typeIcons.map(option => ({
    ...option, label: t(`itemPosition.${option.value}`),
  })), [typeIcons, t]);
  const yesNoOptions = useMemo(() => [{ label: t('common.yes'), value: true }, { label: t('common.no'), value: false }], [t]);
  const renderFilterOption = (option: { label: string; icon?: number }, type: 'item' | 'skill') =>
    <span className="item-search-filter-option">
      {option.icon != null && <img className={'item-search-filter-icon item-search-filter-icon-' + type}
        src={iconUrl(option.icon, type)} alt="" {...missingIcon} />}
      <span>{option.label}</span>
    </span>;
  const itemIcon = (id: number) => iconUrl(id, 'item', customId => services.customItems.iconFor(customId));
  const equipTargets = vm.equipTargetOptions;
  const description = <div className="item-description-card" role="region" aria-label={t('itemSearch.itemDescription')} tabIndex={0}>
    {!vm.activeFilteredItem ? <div className="item-description-empty">
      <Icon name="arrow-circle-left" />
      <p><span className="where-beside">{t('itemSearch.selectPrompt')}</span><span className="where-above">{t('itemSearch.selectPromptAbove')}</span></p>
    </div> : <>
      <div className="item-description-meta">
        <img className="item-description-icon" src={itemIcon(vm.activeFilteredItem.id)} alt="" {...missingIcon} />
        <div className="item-description-links">
          <strong>{vm.activeItem?.name}</strong>
          {vm.activeItem?.custom ? <span>{t('itemSearch.customItem', { id: vm.activeFilteredItem.id })}</span> : <div>
            <a href={vm.divinePrideItemUrl} target="_blank" rel="noopener noreferrer">{t('itemSearch.itemId', { id: vm.activeFilteredItem.id })}</a>
            <a href={vm.marketItemUrl} target="_blank" rel="noopener noreferrer"><Icon name="shopping-cart" /> {t('itemSearch.market')}</a>
          </div>}
        </div>
      </div>
      <div className="item-search-equip">
        {equipTargets.length > 0 ? <>
          {equipTargets.length > 1 && <div className="item-search-equip-target">
            <label className="calc-field-label" htmlFor="item-search-equip-target">{t('itemSearch.equipTarget')}</label>
            <Select inputId="item-search-equip-target" ariaLabel={t('itemSearch.equipTarget')} options={equipTargets}
              optionLabel="label" optionValue="value" value={vm.equipTargetValue}
              onChange={value => action(() => { vm.selectedEquipTarget = value; })} />
          </div>}
          <Button icon="check" label={vm.equipInComparison ? t('itemSearch.equipInComparison') : t('itemSearch.equip')}
            onClick={() => action(() => vm.equipSelectedItem())} />
        </> : <span>{t('itemSearch.noCompatibleSlot')}</span>}
      </div>
      <div className="item-description-body">
        <div className="item-description-text">
          {!vm.activeItem?.custom && <img className="item-search-collection" alt="" {...missingIcon}
            src={'https://www.divine-pride.net/img/items/collection/thROG/' + vm.activeFilteredItem.id} />}
          <div className="item-search-description" dangerouslySetInnerHTML={{ __html: sanitizeHtml(vm.activeFilteredItemDesc) }} />
        </div>
      </div>
    </>}
  </div>;
  return <Dialog visible={vm.isShowSearchDialog} onVisibleChange={visible => action(() => { vm.isShowSearchDialog = visible; })}
    modal className="item-search-dialog"
    header={<><strong>{t('itemSearch.title')}</strong><span className="item-search-class">{vm.className || vm.selectedCharacter?.className}</span></>}>
    <div className="item-search-workspace">
      <form className="item-search-filters"
        onSubmit={event => { event.preventDefault(); action(() => vm.onItemSearchFilterChange()); if (phone) {
          // The focused field is about to be hidden: keep focus in the dialog, on the heading
          // that reopens the filters.
          setFiltersFolded(true);
          requestAnimationFrame(() => filtersToggle.current?.focus());
        } }}>
        {phone && <button ref={filtersToggle} type="button" className="item-search-filters-toggle" aria-expanded={!folded} aria-controls="item-search-filter-controls"
          onClick={() => setFiltersFolded(!folded)}>
          <Icon name={folded ? 'chevron-right' : 'chevron-down'} /><span>{t('itemSearch.filters')}</span>
        </button>}
        <div className="item-search-filter-controls" id="item-search-filter-controls" hidden={folded}>
          {!phone && <div className="calc-section-heading"><span>{t('itemSearch.filters')}</span></div>}
          <div className="item-search-fields">
            <div className="item-search-field">
              <label className="calc-field-label" htmlFor="item-search-name">{t('itemSearch.name')}</label>
              <Input id="item-search-name" type="search" placeholder={t('itemSearch.namePlaceholder')} autoComplete="off"
                value={vm.searchName} onChange={event => action(() => { vm.searchName = event.target.value; })} />
            </div>
            <div className="item-search-field">
              <label className="calc-field-label" htmlFor="item-search-type">{t('itemSearch.type')}</label>
              <Select kind="multiselect" inputId="item-search-type" ariaLabel={t('itemSearch.type')} options={typeOptions}
                renderItem={option => renderFilterOption(option, 'item')}
                optionLabel="label" optionValue="value" placeholder={t('itemSearch.typePlaceholder')} filter showClear resetFilterOnHide
                value={vm.selectedItemPositions} onChange={value => action(() => { vm.selectedItemPositions = value; })} />
            </div>
            <div className="item-search-field">
              <label className="calc-field-label" htmlFor="item-search-skill">{t('itemSearch.skill')}</label>
              <Select kind="multiselect" inputId="item-search-skill" ariaLabel={t('itemSearch.skill')} options={vm.offensiveSkills}
                renderItem={option => renderFilterOption(option, 'skill')}
                optionLabel="label" optionValue="value" placeholder={t('itemSearch.skillPlaceholder')} filter showClear resetFilterOnHide
                value={vm.selectedOffensiveSkills} onChange={value => action(() => { vm.selectedOffensiveSkills = value; })} />
            </div>
            <div className="item-search-field">
              <label className="calc-field-label" htmlFor="item-search-server">{t('itemSearch.server')}</label>
              <Select inputId="item-search-server" ariaLabel={t('itemSearch.server')} options={vm.shopServerOptions} optionLabel="label" optionValue="value"
                value={vm.selectedShopServer} onChange={value => action(() => { vm.selectedShopServer = value; })} />
            </div>
          </div>
          {!phone && levelFilter}
          <div className="calc-section-heading item-search-bonus-heading">
            <span>{t('itemSearch.bonuses')}</span>
          </div>
          <div className="item-search-bonus-pickers">
            {vm.bonusPickers.map((picker, index) => <div key={picker.id} className="item-search-bonus-row">
              <Select inputId={'item-search-bonus-' + picker.id} ariaLabel={t('itemSearch.bonusNumber', { number: index + 1 })}
                options={vm.bonusNameList} optionLabel="label" optionValue="value" placeholder={t('itemSearch.bonusNumber', { number: index + 1 })}
                filter showClear resetFilterOnHide scrollHeight="260px" panelClassName="item-search-options"
                value={picker.value} onChange={value => action(() => { picker.value = value; })} />
              {index === vm.bonusPickers.length - 1 && <Button icon="plus" className="ui-button-text" aria-label={t('itemSearch.addBonus')}
                onClick={() => action(() => vm.addBonusPicker())} />}
              {vm.bonusPickers.length > 1 && <Button icon="minus" className="ui-button-text" aria-label={t('itemSearch.removeBonus', { number: index + 1 })}
                onClick={() => action(() => vm.removeBonusPicker(picker.id))} />}
            </div>)}
          </div>
          {phone && levelFilter}
        </div>
        <div className="item-search-actions" hidden={folded}>
          <div className="item-search-mode">
            <span id="item-search-mode-label">{t('itemSearch.matchAllBonuses')}</span>
            <SelectButton ariaLabelledBy="item-search-mode-label" options={yesNoOptions} optionLabel="label" optionValue="value"
              value={vm.matchAllBonuses} onChange={value => action(() => { vm.matchAllBonuses = value ?? vm.matchAllBonuses; })} />
          </div>
          <Button type="submit" icon="search" label={t('itemSearch.search')} className="ui-button-info" />
        </div>
      </form>
      <div className="item-search-results">
        <section className="item-search-list">
          <div className="calc-section-heading"><span>{t('itemSearch.results')}</span></div>
          {/* On touch the paginator's buttons are 44px: three page links keep them on one row in a list ~310px wide. */}
          <Table value={vm.filteredItems} header={null} dataKey="id" className="ui-datatable-sm"
            paginator rows={14} first={vm.itemSearchFirst} totalRecords={vm.totalFilteredItems} pageLinks={hoverless() ? 3 : 4}
            showCurrentPageReport currentPageReportTemplate={t('itemSearch.resultCount')}
            onFirstChange={first => action(() => { vm.itemSearchFirst = first; })}
            selection={vm.activeFilteredItem} onSelectionChange={item => action(() => { vm.activeFilteredItem = item; })}
            emptyMessage={<tr><td className="item-search-empty-list">{t('itemSearch.noResults')}</td></tr>}
            renderRow={(item, _index, selectionProps) => <tr key={item.id} {...selectionProps}
              onClick={event => { selectionProps.onClick?.(event); if (phone) setDetailAnchor(event.currentTarget); }}
              onKeyDown={event => { selectionProps.onKeyDown?.(event); if (phone && (event.key === 'Enter' || event.key === ' ')) setDetailAnchor(event.currentTarget); }}>
              <td><div className="item-search-result-row">
                <img src={itemIcon(item.id)} alt="" {...missingIcon} />
                <span>{item.label}</span>
              </div></td>
            </tr>} />
        </section>
        {!phone && <section className="item-search-detail">
          <div className="calc-section-heading"><span>{t('itemSearch.description')}</span></div>
          {description}
        </section>}
      </div>
    </div>
    {phone && <Popover anchor={vm.activeFilteredItem ? detailAnchor : null} onClose={() => setDetailAnchor(null)}
      ariaLabel={t('itemSearch.itemDescription')} className="item-search-detail-popover" centered>
      {description}
    </Popover>}
  </Dialog>;
}
