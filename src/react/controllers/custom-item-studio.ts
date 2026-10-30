import { ViewState } from '../state/view-state';
import { CalculatorLayout } from '../services/calculator-services';
import { Events } from '../services/events';
import { environment } from 'src/environments/environment';
import { ItemModel, itemBonusScriptEntries } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { MonsterModel } from 'src/app/models/monster.model';
import { Calculator } from 'src/app/core/calculator';
import { ensureCustomAttachment } from 'src/app/core/custom-attachments';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { isEquipmentEnchant } from 'src/app/constants/enchant_item';
import { CardPosition } from 'src/app/constants/card-position.enum';
import { bonusKeyLabel } from 'src/app/core/bonus-key-label';
import { createRawTotalBonus } from 'src/app/utils/create-raw-total-bonus';
import { createNumberDropdownList } from 'src/app/utils/create-number-dropdown-list';
import { getGradeList } from 'src/app/utils/to-grade-list';
import {
  CUSTOM_KINDS, CUSTOM_KIND_LABELS, CustomItemDefinition, CustomItemDraft, CustomKind,
  CUSTOM_ITEM_MAX_BYTES, customDefinitionsForBuild, customItemDescription, customItemDescriptionHtml, customItemId, validateCustomItems,
  cardFitsCustomKind, customIconCandidates, customKindIsEquipment, customKindIsShadow, inferCustomIcon,
} from 'src/app/core/custom-items';
import { CustomItems as CustomItemLibraryService } from '../services/custom-items';
import { encodeCustomBundle } from 'src/app/core/custom-item-library';
import { createExtraOptionList, ExtraOptionMap } from 'src/app/utils/create-extra-option-list';
import { WEAPON_SUBTYPE_LABEL_PT_BR, WeaponSubTypeNameMapById, WeaponTypeNameMapBySubTypeId } from 'src/app/constants/weapon-type-mapper';
import { ItemSlotLabelKey } from 'src/app/constants/item-slot-i18n';
import { TextKey, Translate, resolveText } from 'src/app/i18n';
import { VALID_SKILL_IDS, resolveSkillById } from 'src/app/skills';
import { compileVisualItemRule, readVisualItemRule, VisualCondition, VisualConditionKind, VisualItemRule as Rule } from 'src/app/core/custom-item-visual-script';
import { ItemSubTypeId } from 'src/app/constants/item-sub-type.enum';
import { selectLoyaltyLines } from 'src/app/constants/pet-loyalty';
import { ElementType } from 'src/app/constants/element-type.const';
import { elementPtBr } from 'src/app/constants/monster-i18n';
import { CLASS_CTOR_BY_ID, getClassDropdownList } from 'src/app/jobs/_class-list';
import { DropdownModel } from 'src/app/models/dropdown.model';
import { ItemPicker as ItemPickerService } from '../services/pickers';
import { PickerRequest } from '../../app/layout/pages/ro-calculator/item-picker/item-picker.model';
import { ChipView } from '../../app/layout/pages/ro-calculator/equipment-grid/chip-view.model';
import { itemFailureMessages, itemValidationMessage, jsonSyntaxMessage } from '../../app/layout/pages/ro-calculator/custom-item-feedback';
import { itemDescPopoverHtml } from 'src/app/utils';
import { shortenUrl } from 'src/app/core/shorten-url';

interface CreateContext { slot: string; compare: boolean }
interface RuleConditionOption {
  value: VisualConditionKind;
  label: string;
  input?: 'number' | 'select' | 'item' | 'text' | 'date';
  options?: DropdownModel[];
  valueLabel?: string;
  example?: string;
  help?: string;
  extraLabel?: string;
  extraExample?: string;
}
type AttachmentField = 'defaultCards' | 'defaultEnchants' | 'defaultBas';
type PreviewField = 'refine' | 'grade';
const INTERNAL_ITEM_FIELDS = new Set(['refine', 'weight']);


export class CustomItemStudioComponent extends ViewState {
   items: Record<number, ItemModel> = {};
   currentModel?: MainModel;
   currentMonster?: MonsterModel;
   saved = new Events<{ item: CustomItemDefinition; context?: CreateContext }>();
   deleted = new Events<number>();

  visible = false;
  libraryMode = true;
  mcpVisible = false;
  scriptHelpVisible = false;
  mode: 'visual' | 'json' = 'visual';
  mobileView: 'editor' | 'preview' = 'editor';
  section: 'item' | 'sockets' | 'bonuses' = 'item';
  draft: CustomItemDraft = this.blank('weapon');
  rawScript = '{}';
  private rawError = '';
  private visualErrors: string[] = [];
  rules: Rule[] = [];
  importQuery = '';
  importOpen = false;
  libraryQuery = '';
  libraryKind = '';
  importedBackup: { raw: string; script: CustomItemDraft['script']; rules: Rule[]; rawError: string; visualErrors: string[] } | null = null;
  diagnostics: string[] = [];
  context?: CreateContext;
  copied = false;
  cardOptions: DropdownModel[] = [];
  enchantOptions: DropdownModel[] = [];
  attachmentRows: { field: AttachmentField; label: string; views: ChipView[] }[] = [];
  private catalogRows: ItemModel[] = [];
  conditionItemOptions: DropdownModel[] = [];
  previewIcon = 1101;
  iconQuery = '';
  iconOptions: ItemModel[] = [];
  iconFilteredOptions: ItemModel[] = [];
  visibleIcons: ItemModel[] = [];
  private readonly unavailableIconIds = new Set<number>();
  previewRefine = 0;
  previewGrade = '';
  previewLoyalty = 4;
  previewControls: { field: PreviewField; view: ChipView }[] = [];
  previewBonuses: { label: string; value: number }[] = [];
  previewRules: { label: string; reason: string; active: boolean; value: number }[] = [];
  previewText = '';
  private previewItem?: CustomItemDefinition;
  capacityNotice = '';

  // Off-hand is an equip destination; the weapon itself uses the same category.
  readonly kinds = CUSTOM_KINDS.filter((kind) => kind !== 'leftWeapon');
  readonly kindOptions = this.kinds.map((value) => ({ value, label: CUSTOM_KIND_LABELS[value] }));
  get libraryKindOptions() { return [{ value: '', label: this.text('cis.allCategories') }, ...this.kindOptions]; }
  readonly kindLabels = CUSTOM_KIND_LABELS;
  readonly baOptions = createExtraOptionList();
  // Every list below names itself through the catalog, so each is read on render: the
  // controller is built once and outlives a language switch, and a field initializer
  // would keep whichever language was on screen at the time.
  get sections() {
    return [{ label: this.text('cis.secItem'), value: 'item' },
      { label: this.text('cis.secSockets'), value: 'sockets' }, { label: this.text('cis.secScript'), value: 'bonuses' }];
  }
  get availableSections() {
    const sections = this.sections;
    return this.isEquipment(this.draft.kind) ? sections : sections.filter((section) => section.value !== 'sockets');
  }
  get modes() { return [{ label: this.text('cis.modeVisual'), value: 'visual' }, { label: this.text('cis.modeJson'), value: 'json' }]; }
  get yesNoOptions() { return [{ label: this.text('cis.yes'), value: true }, { label: this.text('cis.no'), value: false }]; }
  readonly scriptHelpExample = JSON.stringify({ atk: ['10', '7===20'], cri: ['2---5'] }, null, 2);
  get mobileViews() { return [{ label: this.text('cis.viewEditor'), value: 'editor' }, { label: this.text('cis.viewPreview'), value: 'preview' }]; }
  readonly counts = createNumberDropdownList({ from: 0, to: 4 });
  readonly baCounts = createNumberDropdownList({ from: 0, to: 5 });
  cardCounts = this.counts;
  enchantCounts = this.counts;
  readonly elements = Object.values(ElementType).map((value) => ({ value, label: elementPtBr(value) }));
  readonly classes = getClassDropdownList().map(({ label, icon, instant }) => ({ label, icon, value: instant.className }));
  readonly grades = getGradeList();
  readonly previewRefines = createNumberDropdownList({ from: 0, to: 18, prefixLabel: '+ ' });
  readonly previewShadowRefines = createNumberDropdownList({ from: 0, to: 10, prefixLabel: '+ ' });
  readonly loyaltyOptions = [{ value: 1, label: 'Baixa' }, { value: 2, label: 'Nenhuma' }, { value: 3, label: 'Normal' }, { value: 4, label: 'Alta' }];
  readonly weaponSubtypes = Object.entries(WeaponSubTypeNameMapById).map(([id, label]) => ({
    id: Number(id), label: (WEAPON_SUBTYPE_LABEL_PT_BR as Record<string, string>)[label] ?? label,
  }));
  readonly ammoSubtypes = [ItemSubTypeId.Arrow, ItemSubTypeId.Cannonball, ItemSubTypeId.Kunai,
    ItemSubTypeId.Bullet, ItemSubTypeId.ThrowingDagger].map((id) => ({ id, label: ({
      [ItemSubTypeId.Arrow]: 'Flecha', [ItemSubTypeId.Cannonball]: 'Bala de canhão',
      [ItemSubTypeId.Kunai]: 'Kunai', [ItemSubTypeId.Bullet]: 'Projétil',
      [ItemSubTypeId.ThrowingDagger]: 'Adaga de arremesso',
    } as Record<number, string>)[id] }));
  get cardPositions() { return ([
    ['itemSlot.weapon', CardPosition.Weapon], ['cis.cardPosHead', CardPosition.Head],
    ['itemSlot.shield', CardPosition.Shield], ['itemSlot.armor', CardPosition.Armor],
    ['itemSlot.garment', CardPosition.Garment], ['cis.cardPosBoot', CardPosition.Boot],
    ['cis.cardPosAcc', CardPosition.Acc], ['cis.cardPosAccLeft', CardPosition.AccL],
    ['cis.cardPosAccRight', CardPosition.AccR], ['cis.anyPosition', CardPosition.All],
    ] as [TextKey, CardPosition][]).map(([key, value]) => ({ label: this.text(key), value }));
  }
  readonly isEquipment = customKindIsEquipment;
  readonly trackIcon = (_: number, item: ItemModel) => item.id;
  readonly mcpUrl = environment.mcpUrl;
  readonly bonusKeys = Object.keys(createRawTotalBonus()).filter((key) => !INTERNAL_ITEM_FIELDS.has(key))
    .map((key) => ({ key, label: bonusKeyLabel(key) }));
  readonly bonusLabel = bonusKeyLabel;
  get attributeOptions(): DropdownModel[] { return ([
    ['str', 'stat.str'], ['agi', 'stat.agi'], ['vit', 'stat.vit'], ['int', 'stat.int'], ['dex', 'stat.dex'], ['luk', 'stat.luk'],
    ['level', 'cis.baseLevel'], ['jobLevel', 'cis.jobLevel'],
    ] as [string, TextKey][]).map(([value, key]) => ({ value, label: this.text(key) }));
  }
  readonly conditionSkills: DropdownModel[] = [...VALID_SKILL_IDS].map((id) => {
    const skill = resolveSkillById(id);
    return { value: id, label: skill?.name ?? this.text('cis.skillPlaceholder', { id }), icon: id, iconType: skill?.iconType ?? 'skill' };
  });
  get conditionWeaponTypes(): DropdownModel[] {
    return [...new Map(this.weaponSubtypes.map(({ id, label }) =>
      [WeaponTypeNameMapBySubTypeId[id], { value: WeaponTypeNameMapBySubTypeId[id], label: id >= 273 && id <= 277 ? this.text('cis.firearm') : label }])).values()];
  }
  /**
   * Rebuilt only when the language changed: the view asks for it once per condition on
   * every render, and the list carries the whole class and skill catalogs. The first
   * entry's text is the cache key — a cheap stand-in for the locale, which a plain
   * `Translate` does not carry.
   */
  get conditionOptions(): RuleConditionOption[] {
    const stamp = this.text('cis.condNone');
    if (this.conditionOptionsStamp !== stamp) {
      this.conditionOptionsStamp = stamp;
      this.conditionOptionsCache = this.buildConditionOptions();
    }
    return this.conditionOptionsCache;
  }

  private conditionOptionsStamp = '';
  private conditionOptionsCache: RuleConditionOption[] = [];

  private buildConditionOptions(): RuleConditionOption[] {
    return [
    { value: 'none', label: this.text('cis.condNone') },
    {
      value: 'refine', label: this.text('cis.condRefine'), input: 'number', valueLabel: this.text('cis.condRefine'), example: '7',
      help: this.text('cis.condRefineHelp'),
    },
    {
      value: 'refineStep', label: this.text('cis.condRefineStep'), input: 'number', valueLabel: this.text('cis.condRefineStepValue'), example: '2',
      help: this.text('cis.condRefineStepHelp'),
    },
    {
      value: 'grade', label: this.text('cis.condGrade'), input: 'select', options: this.grades.filter(({ value }) => !!value), valueLabel: this.text('cis.condGradeValue'),
      help: this.text('cis.condGradeHelp'),
    },
    {
      value: 'level', label: this.text('cis.condLevel'), input: 'number', valueLabel: this.text('cis.condLevelValue'), example: '100',
      help: this.text('cis.condLevelHelp'),
    },
    {
      value: 'stat', label: this.text('cis.condStat'), input: 'select', options: this.attributeOptions, valueLabel: this.text('cis.condStatValue'),
      extraLabel: this.text('cis.condStatExtra'), extraExample: '10',
      help: this.text('cis.condStatHelp'),
    },
    {
      value: 'statMin', label: this.text('cis.condStatMin'), input: 'select', options: this.attributeOptions, valueLabel: this.text('cis.condStatValue'),
      extraLabel: this.text('cis.condStatMinExtra'), extraExample: '120', help: this.text('cis.condStatMinHelp'),
    },
    {
      value: 'equip', label: this.text('cis.condEquip'), input: 'item', valueLabel: this.text('cis.condEquipValue'),
      help: this.text('cis.condEquipHelp'),
    },
    {
      value: 'class', label: this.text('cis.condClass'), input: 'select', options: this.classes.map((job) => ({ ...job, iconType: 'job' })), valueLabel: this.text('cis.condClassValue'),
      help: this.text('cis.condClassHelp'),
    },
    {
      value: 'skill', label: this.text('cis.condSkill'), input: 'select', options: this.conditionSkills, valueLabel: this.text('cis.condSkill'),
      extraLabel: this.text('cis.condSkillExtra'), extraExample: '5',
      help: this.text('cis.condSkillHelp'),
    },
    {
      value: 'activeSkill', label: this.text('cis.condActiveSkill'), input: 'select', options: this.conditionSkills, valueLabel: this.text('cis.condActiveSkill'),
      help: this.text('cis.condActiveSkillHelp'),
    },
    {
      value: 'loyalty', label: this.text('cis.condLoyalty'), input: 'select', options: this.loyaltyOptions, valueLabel: this.text('cis.condLoyaltyValue'),
      help: this.text('cis.condLoyaltyHelp'),
    },
    {
      value: 'weaponType', label: this.text('cis.weaponType'), input: 'select', options: this.conditionWeaponTypes, valueLabel: this.text('cis.weaponType'),
      help: this.text('cis.condWeaponHelp'),
    },
    {
      value: 'ammoType', label: this.text('cis.condAmmoType'), input: 'select', options: this.ammoSubtypes.map(({ id, label }) => ({ value: id, label })), valueLabel: this.text('cis.condAmmoType'),
      help: this.text('cis.condAmmoHelp'),
    },
    {
      value: 'position', label: this.text('cis.condPosition'), input: 'select', options: Object.entries(ItemSlotLabelKey).map(([value, key]) => ({ value, label: this.text(key) })), valueLabel: this.text('cis.condPositionValue'),
      help: this.text('cis.condPositionHelp'),
    },
    {
      value: 'spawn', label: this.text('cis.condSpawn'), input: 'text', valueLabel: this.text('cis.condSpawnValue'), example: 'tur_d03_i',
      help: this.text('cis.condSpawnHelp'),
    },
    {
      value: 'until', label: this.text('cis.condUntil'), input: 'date', valueLabel: this.text('cis.condUntilValue'),
      help: this.text('cis.condUntilHelp'),
    },
    ];
  }

  conditionHelp(kind: VisualConditionKind): RuleConditionOption {
    return this.conditionOptions.find((option) => option.value === kind)!;
  }

  constructor(public readonly library: CustomItemLibraryService, private readonly picker: ItemPickerService,
    private readonly text: Translate, private readonly layout?: CalculatorLayout) { super();}

  blank(kind: CustomKind): CustomItemDraft {
    return {
      name: '', kind, script: {}, cardCapacity: 0, enchantCapacity: 0, baCapacity: 0,
      defaultCards: [], defaultEnchants: [], defaultBas: [],
      isRefinable: ['weapon', 'leftWeapon', 'headUpper', 'armor', 'shield', 'garment', 'boot'].includes(kind) || kind.startsWith('shadow'),
      canGrade: ['weapon', 'leftWeapon', 'headUpper', 'armor', 'shield', 'garment', 'boot'].includes(kind),
      itemLevel: kind === 'weapon' || kind === 'leftWeapon' ? 5 : null,
      itemSubTypeId: kind === 'weapon' || kind === 'leftWeapon' ? 257 : kind === 'ammo' ? ItemSubTypeId.Arrow : undefined,
      attack: 0, baseMatk: 0, defense: 0, weight: 0,
    };
  }

  openLibrary(): void {
    this.visible = true; this.libraryMode = true; this.context = undefined;
    this.diagnostics = []; this.copied = false;

    this.publish();
}

  closePickers(): void { this.picker.close(); }

  openCreate(kind: string = 'weapon', context?: CreateContext): void {
    const selected = kind === 'leftWeapon' ? 'weapon' : CUSTOM_KINDS.includes(kind as CustomKind) ? kind as CustomKind : 'weapon';
    this.catalogRows = [...new Map(Object.values(this.items).filter(item =>
      this.layout?.previews.getSnapshot() !== false || !item.preRelease).map((item) => [item.id, item])).values()];
    this.conditionItemOptions = this.catalogRows.map((item) => ({ label: item.name, value: item.id }));
    this.enchantOptions = this.catalogRows.filter(isEquipmentEnchant).map((item) => ({ label: item.name, value: item.id }));
    this.setCardOptions(selected);
    this.draft = this.blank(selected);
    this.refreshIconOptions();
    this.previewIcon = inferCustomIcon(selected, this.draft.itemSubTypeId, this.items);
    this.rawScript = '{}'; this.rules = []; this.mode = 'visual'; this.section = 'item';
    this.mobileView = 'editor';
    this.diagnostics = []; this.rawError = ''; this.visualErrors = []; this.importedBackup = null; this.context = context;
    this.previewRefine = 0; this.previewGrade = ''; this.previewLoyalty = 4; this.previewBonuses = []; this.previewRules = [];
    this.previewText = ''; this.previewItem = undefined;
    this.capacityNotice = '';
    this.importQuery = ''; this.importOpen = false;
    this.visible = true; this.libraryMode = false;
    this.refreshAttachments();
    this.updatePreview();

    this.publish();
}

  edit(item: CustomItemDefinition): void {
    this.openCreate(item.kind);
    this.draft = structuredClone(item);
    if (this.draft.kind === 'leftWeapon') this.draft.kind = 'weapon';
    this.refreshIconOptions();
    this.rawScript = JSON.stringify(item.script ?? {}, null, 2);
    this.readRules();
    this.validate();

    this.publish();
}

  duplicate(item: CustomItemDefinition): void {
    this.edit(item);
    this.draft.id = undefined;
    this.draft.name = `${item.name} (cópia)`;
  }

  selectKind(kind: CustomKind): void {
    if (!this.isEquipment(kind) && this.section === 'sockets') this.section = 'item';
    const fresh = this.blank(kind);
    this.draft = { ...this.draft, kind, cardCapacity: fresh.cardCapacity, enchantCapacity: fresh.enchantCapacity,
      baCapacity: fresh.baCapacity, isRefinable: fresh.isRefinable, canGrade: fresh.canGrade,
      itemSubTypeId: fresh.itemSubTypeId, iconItemId: undefined, itemLevel: fresh.itemLevel,
      location: undefined, locations: undefined };
    this.setCardOptions(kind);
    this.changeCapacity('cardCapacity', 0);
    this.refreshIconOptions();
  }

  onSubtypeChange(): void {
    this.draft.iconItemId = undefined;
    this.refreshIconOptions();
    this.validate();
  }

  private refreshIconOptions(): void {
    this.iconQuery = '';
    this.iconOptions = customIconCandidates(this.draft.kind, this.draft.itemSubTypeId, this.items)
      .filter((item) => !this.unavailableIconIds.has(item.id));
    this.filterIconOptions();
  }

  filterIconOptions(): void {
    const query = this.fold(this.iconQuery);
    this.iconFilteredOptions = query
      ? this.iconOptions.filter((item) => this.fold(`${item.name} ${item.id}`).includes(query))
      : this.iconOptions;
    this.visibleIcons = this.iconFilteredOptions.slice(0, 90);
  }

  loadMoreIcons(event: Event): void {
    const viewport = event.target as HTMLElement;
    if (this.visibleIcons.length >= this.iconFilteredOptions.length
      || viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > 160) return;
    this.visibleIcons = this.iconFilteredOptions.slice(0, this.visibleIcons.length + 90);
  }

  iconLoadFailed(id: number): void {
    this.unavailableIconIds.add(id);
    this.iconOptions = this.iconOptions.filter((item) => item.id !== id);
    this.iconFilteredOptions = this.iconFilteredOptions.filter((item) => item.id !== id);
    this.visibleIcons = this.iconFilteredOptions.slice(0, Math.max(90, this.visibleIcons.length));
  }

  selectIcon(id?: number): void {
    this.draft.iconItemId = id;
    this.validate();
  }

  get sourceResults(): ItemModel[] {
    const query = this.fold(this.importQuery);
    if (!query) return [];
    const rows = this.catalogRows.filter((item) => item.script && typeof item.script === 'object'
      && (this.layout?.previews.getSnapshot() !== false || !item.preRelease));
    return rows.filter((item) => this.fold(`${item.name} ${item.id} ${item.aegisName}`).includes(query))
      .sort((a, b) => Number(b.id === Number(query)) - Number(a.id === Number(query)) || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 60);
  }

  sourceCategory(item: ItemModel): string {
    if (item.custom) return this.kindLabels[(item as CustomItemDefinition).kind];
    const key = ({ 1: 'cis.typeWeapon', 2: 'cis.typeEquip', 3: 'cis.typeConsumable', 4: 'cis.typeAmmo',
      6: 'cis.typeCard', 11: 'cis.typeEnchant' } as Record<number, TextKey>)[item.itemTypeId];
    return this.text(key ?? 'cis.secItem');
  }

  closeImportOutside(event: FocusEvent, source: HTMLElement): void {
    if (!source.contains(event.relatedTarget as Node | null)) this.importOpen = false;
  }

  private fold(s: string): string { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

  get libraryItems(): CustomItemDefinition[] {
    const q = this.fold(this.libraryQuery);
    return this.library.items.filter((item) => (!this.libraryKind || item.kind === this.libraryKind)
      && (!q || this.fold(`${item.name} ${item.id}`).includes(q)));
  }

  descriptionTooltip(item: CustomItemDefinition): string {
    return itemDescPopoverHtml(item, customItemDescriptionHtml(item));
  }

  importScript(source: ItemModel): void {
    this.importedBackup = { raw: this.rawScript, script: structuredClone(this.draft.script ?? {}), rules: structuredClone(this.rules), rawError: this.rawError, visualErrors: [...this.visualErrors] };
    this.draft.script = structuredClone(source.script);
    this.rawScript = JSON.stringify(this.draft.script, null, 2);
    this.rawError = ''; this.visualErrors = [];
    this.readRules();
    this.importOpen = false;
    this.importQuery = '';
    this.validate();
  }

  undoImport(): void {
    if (!this.importedBackup) return;
    this.rawScript = this.importedBackup.raw;
    this.draft.script = this.importedBackup.script;
    this.rules = this.importedBackup.rules;
    this.rawError = this.importedBackup.rawError;
    this.visualErrors = this.importedBackup.visualErrors;
    this.importedBackup = null;
    this.validate();
  }

  private setCardOptions(kind: CustomKind): void {
    this.cardOptions = this.catalogRows.filter((item) => item.itemTypeId === 6 && item.presentInLatam
      && cardFitsCustomKind(item, kind)).map((item) => ({ label: item.name, value: item.id, cardPrefix: item.cardPrefix }));
  }

  get headOccupancy(): string[] {
    const defaultLocation = this.draft.kind.endsWith('Middle') ? 'Middle'
      : this.draft.kind.endsWith('Lower') ? 'Lower' : 'Upper';
    return this.draft.locations ?? [this.draft.location ?? defaultLocation];
  }
  toggleHeadLocation(location: string, checked: boolean): void {
    const existing = new Set(this.headOccupancy);
    if (checked) existing.add(location); else existing.delete(location);
    this.draft.locations = [...existing];
    this.draft.location = this.draft.locations[0] ?? null;
    this.validate();
  }

  changeCapacity(field: 'cardCapacity' | 'enchantCapacity' | 'baCapacity', value: number): void {
    const max = field === 'baCapacity' ? 5 : 4 - Number(this.draft[field === 'cardCapacity' ? 'enchantCapacity' : 'cardCapacity'] ?? 0);
    this.draft[field] = Math.max(0, Math.min(max, Math.trunc(Number(value) || 0)));
    const removed: string[] = [];
    for (const [capacity, defaults] of [
      ['cardCapacity', 'defaultCards'], ['enchantCapacity', 'defaultEnchants'], ['baCapacity', 'defaultBas'],
    ] as const) {
      const list = this.draft[defaults] ?? [];
      const limit = Math.max(0, Number(this.draft[capacity]) || 0);
      if (list.length > limit) {
        removed.push(this.text(defaults === 'defaultBas' ? 'cis.countBas'
          : defaults === 'defaultCards' ? 'cis.countCards' : 'cis.countEnchants', { n: list.length - limit }));
        (this.draft as any)[defaults] = list.slice(0, limit);
      }
    }
    this.capacityNotice = removed.length ? this.text('cis.capacityNotice', { removed: removed.join(', ') }) : '';
    this.validate();
  }

  private refreshAttachments(): void {
    this.cardCounts = this.counts.filter(({ value }) => Number(value) <= 4 - Number(this.draft.enchantCapacity ?? 0));
    this.enchantCounts = this.counts.filter(({ value }) => Number(value) <= 4 - Number(this.draft.cardCapacity ?? 0));
    this.attachmentRows = ([
      ['defaultCards', this.text('cis.initialCards'), 'card', this.draft.cardCapacity, 'chip.cardNumber'],
      ['defaultEnchants', this.text('cis.initialEnchants'), 'enchant', this.draft.enchantCapacity, 'studio.enchantNumber'],
      ['defaultBas', this.text('cis.initialBas'), 'option', this.draft.baCapacity, 'studio.baNumber'],
    ] as const).map(([field, label, kind, capacity, placeholderKey]) => ({
      field, label, views: Array.from({ length: capacity ?? 0 }, (_, index): ChipView => {
        const value = this.draft[field]?.[index];
        const item = kind !== 'option' && value ? this.items[Number(value)] : undefined;
        const placeholder = { key: placeholderKey, params: { number: index + 1 } };
        return {
          chip: { kind, index, slotKey: this.draft.kind as ItemTypeEnum, placeholder },
          text: item?.name ?? (value ? ExtraOptionMap.get(String(value)) ?? String(value) : resolveText(this.text, placeholder)),
          filled: !!value, icon: item?.id ?? null, descId: item?.id ?? null,
          elementClass: null, primary: false, preRelease: !!item?.preRelease,
        };
      }),
    }));
  }

  pickAttachment(field: AttachmentField, view: ChipView, anchor: HTMLElement): void {
    const base = { anchor, title: resolveText(this.text, view.chip.placeholder), value: this.draft[field]?.[view.chip.index] };
    const request: PickerRequest = field === 'defaultBas'
      ? { ...base, value: String(base.value ?? ''), mode: 'tree', roots: this.baOptions, leafIndex: ExtraOptionMap }
      : { ...base, mode: 'flat', options: field === 'defaultCards' ? this.cardOptions : this.enchantOptions,
        filterKeys: ['label', 'value', 'cardPrefix'], iconKey: 'value', items: this.items };
    this.picker.open(request).then((result) => { if (this.lifetime.active) this.action(() => {
      if (result.committed) this.setAttachment(field, view.chip.index, result.value);
    }); });
  }

  setAttachment(field: AttachmentField, index: number, value: string | number | null | undefined): void {
    if (field === 'defaultBas') {
      const values = [...(this.draft.defaultBas ?? [])];
      if (value) values[index] = String(value); else values.splice(index, 1);
      this.draft.defaultBas = values.filter(Boolean);
    } else {
      const values = [...(this.draft[field] ?? [])];
      if (value) values[index] = Number(value); else values.splice(index, 1);
      this.draft[field] = values.filter(Boolean);
    }
    this.validate();
  }

  addRule(): void { this.rules.push({ key: 'atk', value: 1, conditions: [] }); this.writeRules(); }
  removeRule(index: number): void { this.rules.splice(index, 1); this.writeRules(); }

  addCondition(rule: Rule): void {
    rule.conditions.push({ kind: 'none', value: null });
    this.writeRules();
  }

  changeCondition(condition: VisualCondition, kind: VisualConditionKind): void {
    condition.kind = kind;
    condition.value = null;
    condition.extra = this.conditionHelp(kind).extraLabel ? 1 : undefined;
    this.writeRules();
  }

  removeCondition(rule: Rule, index: number): void {
    rule.conditions.splice(index, 1);
    this.writeRules();
  }

  pickConditionItem(condition: VisualCondition, anchor: HTMLElement): void {
    this.picker.open({ mode: 'flat', anchor, title: this.text('cis.pickRequiredItem'), value: condition.value,
      options: this.conditionItemOptions, filterKeys: ['label', 'value'], iconKey: 'value', items: this.items,
    }).then((result) => { if (this.lifetime.active) this.action(() => {
      if (!result.committed) return;
      condition.value = result.value == null ? null : Number(result.value);
      this.writeRules();
    }); });
  }

  conditionItemName(condition: VisualCondition): string {
    return this.items[Number(condition.value)]?.name
      ?? (condition.value ? this.text('cis.itemNumber', { id: condition.value }) : this.text('cis.pickItem'));
  }

  private readRules(): void {
    this.visualErrors = [];
    this.rules = itemBonusScriptEntries(this.draft.script).flatMap(([key, values]) => values.map((expression) => {
      const rule = readVisualItemRule(key, expression);
      if (INTERNAL_ITEM_FIELDS.has(key) || rule.conditions.some((condition) => {
        const options = this.conditionHelp(condition.kind).options;
        return options && !options.some((option) => option.value === condition.value);
      })) rule.readOnly = true;
      if (rule.readOnly) rule.description = customItemDescription({ script: { [key]: [expression] } });
      if (!INTERNAL_ITEM_FIELDS.has(key) && !this.bonusKeys.some((option) => option.key === key)) {
        this.bonusKeys.push({ key, label: bonusKeyLabel(key) });
      }
      return rule;
    }));
  }

  writeRules(): void {
    const bonusKeys = new Set(itemBonusScriptEntries(this.draft.script).map(([key]) => key));
    const script = Object.fromEntries(Object.entries(this.draft.script ?? {}).filter(([key]) => !bonusKeys.has(key)));
    this.visualErrors = [];
    this.rules.forEach((rule, index) => {
      const result = compileVisualItemRule(rule);
      this.visualErrors.push(...result.errors.map((error) => this.text('cis.bonusError', { n: index + 1, message: error })));
      if (result.expression != null) {
        const values = script[rule.key] ?? [];
        if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
          this.visualErrors.push(this.text('cis.bonusIncompatible', { n: index + 1 }));
        } else script[rule.key] = [...values as string[], result.expression];
      }
    });
    if (this.visualErrors.length) { this.validate(); return; }
    this.draft.script = script;
    this.rawScript = JSON.stringify(script, null, 2);
    this.rawError = '';
    this.validate();
  }

  onRawScript(): void {
    try { this.draft.script = JSON.parse(this.rawScript); }
    catch (error) {
      this.rawError = jsonSyntaxMessage(error, this.rawScript);
      this.diagnostics = [this.rawError];
      return;
    }
    this.rawError = ''; this.visualErrors = [];
    this.validate();
  }

  formatJson(): void {
    this.onRawScript();
    if (!this.rawError) this.rawScript = JSON.stringify(this.draft.script, null, 2);
  }

  setMode(mode: 'visual' | 'json'): void {
    if (!mode || mode === this.mode) return;
    if (mode === 'json' && this.visualErrors.length) return;
    if (mode === 'visual') {
      this.onRawScript();
      if (this.rawError || !this.draft.script || typeof this.draft.script !== 'object' || Array.isArray(this.draft.script)) return;
      this.readRules();
    }
    this.mode = mode;
  }

  validate(): void {
    const input = { ...this.draft, id: this.draft.id ?? customItemId() };
    const result = validateCustomItems([input], this.items);
    this.diagnostics = [...(this.rawError ? [this.rawError] : []), ...this.visualErrors, ...result.errors.map((error) => itemValidationMessage(error))];
    this.previewItem = this.visualErrors.length ? undefined : result.items[0] ?? (!this.rawError && !input.name.trim()
      ? validateCustomItems([{ ...input, name: this.text('cis.newItem') }], this.items).items[0] : undefined);
    this.previewIcon = Number(this.previewItem?.iconItemId
      || inferCustomIcon(this.draft.kind, this.draft.itemSubTypeId, this.items));
    this.previewText = this.previewItem ? customItemDescription(this.previewItem) : this.text('cis.descriptionError');
    this.refreshAttachments();
    this.updatePreview();
  }

  pickPreview(field: PreviewField, anchor: HTMLElement): void {
    this.picker.open({
      mode: 'flat', anchor, title: this.text(field === 'refine' ? 'eq.pickRefine' : 'eq.pickGrade'),
      value: field === 'refine' ? this.previewRefine : this.previewGrade,
      options: field === 'refine'
        ? customKindIsShadow(this.draft.kind) ? this.previewShadowRefines : this.previewRefines
        : this.grades.filter(({ value }) => value !== ''),
      filterKeys: ['label'],
    }).then((result) => { if (this.lifetime.active) this.action(() => {
      if (result.committed) this.setPreviewValue(field, result.value);
    }); });
  }

  setPreviewValue(field: PreviewField, value: string | number | null | undefined): void {
    if (field === 'refine') this.previewRefine = Number(value) || 0;
    else this.previewGrade = String(value ?? '');
    this.updatePreview();
  }

  updatePreview(): void {
    if (!this.draft.isRefinable) this.previewRefine = 0;
    else this.previewRefine = Math.min(this.previewRefine, customKindIsShadow(this.draft.kind) ? 10 : 18);
    if (!this.draft.canGrade) this.previewGrade = '';
    this.previewControls = (['refine', 'grade'] as const)
      .filter((field) => field === 'refine' ? this.draft.isRefinable : this.draft.canGrade)
      .map((field) => ({ field, view: {
        chip: { kind: field, index: 0, slotKey: this.draft.kind as ItemTypeEnum, placeholder: { key: field === 'refine' ? 'chip.refine' : 'chip.grade' } },
        text: field === 'refine' ? `+ ${this.previewRefine}`
          : this.previewGrade ? this.text('eq.gradeValue', { grade: this.previewGrade }) : this.text('chip.grade'),
        filled: field === 'refine' ? this.previewRefine > 0 : !!this.previewGrade,
        icon: null, descId: null, elementClass: null, primary: false, preRelease: false,
      } }));
    this.previewBonuses = [];
    this.previewRules = [];
    if (!this.currentModel || !this.previewItem) return;
    const Character = CLASS_CTOR_BY_ID[this.currentModel.class];
    if (!Character) return;
    try {
      const item = this.previewItem;
      const id = item.id;
      const model = structuredClone(this.currentModel) as Record<string, any>;
      const slot = item.kind === 'card' ? 'weaponCard1' : item.kind === 'enchant' ? 'weaponEnchant1'
        : item.kind === 'accessory' ? 'accLeft' : item.kind;
      if (slot !== 'consumable') model[slot] = id;
      model[`${slot}Refine`] = this.previewRefine;
      model[`${slot}Grade`] = this.previewGrade;
      model['petLoyalty'] = this.previewLoyalty;
      if (this.isEquipment(item.kind)) {
        const attachments = ensureCustomAttachment(model, slot, item)!;
        attachments.refine = this.previewRefine;
        attachments.grade = this.previewGrade;
      }
      const character = new Character().setLearnSkills({
        activeSkillIds: this.currentModel.activeSkills,
        passiveSkillIds: this.currentModel.passiveSkills,
      });
      const { activeSkillNames, learnedSkillMap } = character.getSkillBonusAndName();
      const calc = new Calculator().setMasterItems({ ...this.items, [id]: item }).setClass(character)
        .loadItemFromModel(model).setUsedSkillNames(activeSkillNames).setLearnedSkills(learnedSkillMap);
      if (this.currentMonster) calc.setMonster(this.currentMonster);
      this.previewBonuses = Object.entries(calc.evaluateItemScript(slot as ItemTypeEnum, item, this.previewRefine))
        .filter(([, value]) => Number.isFinite(value) && value !== 0)
        .map(([key, value]) => ({ label: bonusKeyLabel(key), value }));
      this.previewRules = itemBonusScriptEntries(item.script).flatMap(([key, lines]) => {
        const selected = selectLoyaltyLines(lines, this.previewLoyalty);
        return lines.map((line) => {
          const replaced = !selected.includes(line);
          const result = replaced ? { active: false, value: 0 } : calc.evaluateItemRule(slot as ItemTypeEnum, line, this.previewRefine);
          return { label: bonusKeyLabel(key), reason: this.text(replaced ? 'cis.reasonReplaced'
            : result.active ? 'cis.reasonActive' : 'cis.reasonInactive'),
            ...result };
        });
      });
    } catch { this.previewBonuses = []; this.previewRules = []; }
  }

  save(): void {
    if (this.mode === 'visual') this.writeRules(); else this.onRawScript();
    if (this.diagnostics.length) return;
    const draft = { ...this.draft, id: this.draft.id ?? customItemId(), revision: (this.draft.revision ?? 0) + 1 };
    const result = validateCustomItems([draft], this.items);
    if (result.errors.length) { this.diagnostics = result.errors.map((error) => itemValidationMessage(error)); return; }
    try {
      this.library.save(result.items[0]);
      this.saved.emit({ item: result.items[0], context: this.context });
      this.visible = false;
    } catch (error) { this.diagnostics = itemFailureMessages(error, this.text('cis.saveFailed')); }
  }

  remove(item: CustomItemDefinition): void {
    if (!window.confirm(this.text('cis.deleteConfirm', { name: item.name }))) return;
    try { this.library.remove(item.id); this.deleted.emit(item.id); }
    catch (error) { this.diagnostics = itemFailureMessages(error, this.text('cis.deleteFailed')); }
  }

  async share(item: CustomItemDefinition): Promise<void> {
    try {
      const dependencies = customDefinitionsForBuild([{ item: item.id }], this.items);
      const url = `${location.origin}/#/?customItem=${encodeCustomBundle(dependencies)}`;
      await navigator.clipboard.writeText(await shortenUrl(url, environment.shortenerUrl));
      this.copied = true;
    }
    catch (error) { this.diagnostics = itemFailureMessages(error, this.text('cis.copyFailed')); }
  }

  exportJson(): void {
    const blob = new Blob([JSON.stringify({ version: 1, items: this.library.items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'meus-itens.json'; link.click();
    URL.revokeObjectURL(url);
  }

  async importJson(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    let source = '';
    try {
      if (file.size > CUSTOM_ITEM_MAX_BYTES) throw new Error(this.text('cis.fileTooBig'));
      source = await file.text();
      const parsed = JSON.parse(source);
      if (parsed?.version !== 1) throw new Error(this.text('cis.fileVersion'));
      this.library.store.import(parsed.items, this.items);
      this.library.refresh();
      for (const item of this.library.items) this.saved.emit({ item });
    } catch (error) { this.diagnostics = itemFailureMessages(error, this.text('cis.importFailed'), source); }
  }
}
