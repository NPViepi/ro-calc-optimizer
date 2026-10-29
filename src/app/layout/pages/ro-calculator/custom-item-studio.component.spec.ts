
import { describe, expect, it, vi } from 'vitest';

import { CustomItemStudioComponent } from '../../../../react/controllers/custom-item-studio';
import { CustomItems as CustomItemLibraryService } from '../../../../react/services/custom-items';
import { ItemPicker as ItemPickerService } from '../../../../react/services/pickers';
import { createMainModel } from 'src/app/utils/create-main-model';
import { Mechanic } from 'src/app/jobs';
import { CUSTOM_ITEM_MIN_ID, validateCustomItems } from 'src/app/core/custom-items';
import { DEFAULT_CATALOG, TextKey } from 'src/app/i18n';
import { TextParams, translate } from 'src/app/core/i18n';

/** The studio names its chips through a translator; pt-BR is the source catalog. */
const text = (key: TextKey, params?: TextParams) => translate(DEFAULT_CATALOG, key, params);

function studio() {
  const picker = { open: vi.fn().mockReturnValue(Promise.resolve({ committed: true, value: 'atk:10' })), close: vi.fn() };
  const component = new CustomItemStudioComponent({ items: [] } as unknown as CustomItemLibraryService, picker as unknown as ItemPickerService, text);
  component.openCreate();
  return { component, picker };
}

describe('custom item creator editing', () => {
  it('shows Slots e BAs only for equipment categories', () => {
    const { component } = studio();
    expect(component.availableSections.map((section) => section.value)).toContain('sockets');

    component.section = 'sockets';
    component.selectKind('consumable');
    expect(component.section).toBe('item');
    expect(component.availableSections.map((section) => section.value)).toEqual(['item', 'bonuses']);

    component.selectKind('card');
    expect(component.availableSections.map((section) => section.value)).toEqual(['item', 'bonuses']);
    component.selectKind('armor');
    expect(component.availableSections.map((section) => section.value)).toContain('sockets');
  });

  it('keeps a selected icon through validation and editing, then resets it when the subtype changes', () => {
    const { component } = studio();
    component.selectIcon(1101);
    expect(component.draft.iconItemId).toBe(1101);
    component.draft.name = 'Espada';
    component.validate();
    const item = validateCustomItems([{ ...component.draft, id: CUSTOM_ITEM_MIN_ID + 40 }]).items[0];
    component.edit(item);
    expect(component.draft.iconItemId).toBe(1101);
    component.draft.itemSubTypeId = 259;
    component.onSubtypeChange();
    expect(component.draft.iconItemId).toBeUndefined();
  });

  it('removes icon images that fail to load from the picker', () => {
    const { component } = studio();
    component.items = {
      1101: { id: 1101, name: 'Espada', itemTypeId: 1, itemSubTypeId: 257, presentInLatam: true },
      1102: { id: 1102, name: 'Espada', itemTypeId: 1, itemSubTypeId: 257, presentInLatam: true },
    } as any;
    component.selectKind('weapon');
    expect(component.visibleIcons.map((item) => item.id)).toEqual([1101, 1102]);
    component.iconLoadFailed(1101);
    expect(component.visibleIcons.map((item) => item.id)).toEqual([1102]);
    component.onSubtypeChange();
    expect(component.visibleIcons.map((item) => item.id)).toEqual([1102]);
  });

  it('escapes a custom name in the library description tooltip', () => {
    const { component } = studio();
    const item = validateCustomItems([{ name: '<script>alert(1)</script>', kind: 'card', script: { cri: ['5'] } }]).items[0];
    expect(component.descriptionTooltip(item)).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('formats JSON without changing its script, including structured directives', () => {
    const { component } = studio();
    const script = { atk: ['10'], autoCastPending: [{ skillName: 'Teste', reason: 'Ainda sem cálculo' }] };
    component.rawScript = JSON.stringify(script);
    component.formatJson();
    expect(component.rawScript).toBe(JSON.stringify(script, null, 2));
    expect(component.draft.script).toEqual(script);
    component.setMode('visual');
    expect(component.mode).toBe('visual');
  });

  it('preserves incomplete JSON when formatting and reports the syntax error', () => {
    const { component } = studio();
    component.rawScript = '{"atk": [';
    component.formatJson();
    expect(component.rawScript).toBe('{"atk": [');
    expect(component.diagnostics[0]).toContain('JSON:');
  });

  it('can return to Visual with an unnamed item and keeps a parsed preview', () => {
    const { component } = studio();
    component.setMode('json');
    component.rawScript = '{"atk":["10"],"cri":["7===5"]}';
    component.setMode('visual');
    expect(component.mode).toBe('visual');
    expect(component.rules).toMatchObject([
      { key: 'atk', value: 10, conditions: [] },
      { key: 'cri', value: 5, conditions: [{ kind: 'refine', value: 7 }] },
    ]);
    expect(component.previewText).toContain('ATQ +10');
    expect(component.previewText).not.toContain('7===');
    expect(component.diagnostics).toContain('Dê um nome ao item.');
  });

  it('retains unfinished JSON until it can be represented visually', () => {
    const { component } = studio();
    component.setMode('json');
    component.rawScript = '{"atk": [';
    component.setMode('visual');
    expect(component.mode).toBe('json');
    expect(component.rawScript).toBe('{"atk": [');
    expect(component.diagnostics[0]).toContain('JSON:');
  });

  it('updates conditions automatically, replaces old thresholds, and keeps each bonus independent', () => {
    const { component } = studio();
    component.addRule();
    component.addRule();
    const first = component.rules[0];
    first.value = 10;
    first.conditions = [{ kind: 'refine', value: 7 }, { kind: 'grade', value: 'B' }];
    component.writeRules();
    expect(component.draft.script.atk).toEqual(['GRADE[me==B]REFINE[7]===10', '1']);
    first.conditions[0].value = 9;
    component.writeRules();
    expect(component.draft.script.atk).toEqual(['GRADE[me==B]REFINE[9]===10', '1']);
    component.removeCondition(first, 0);
    expect(component.draft.script.atk).toEqual(['GRADE[me==B]===10', '1']);
    component.setMode('json');
    component.setMode('visual');
    expect(component.rules[0]).toMatchObject({ value: 10, conditions: [{ kind: 'grade', value: 'B' }] });
    expect(component.rules[1].conditions).toEqual([]);
  });

  it('blocks saving or switching modes while a visual condition is unfinished', () => {
    const { component } = studio();
    component.draft.name = 'Teste';
    component.addRule();
    component.rules[0].conditions = [{ kind: 'refine', value: null }];
    component.writeRules();
    expect(component.diagnostics.join(' ')).toContain('Condição 1');
    component.setMode('json');
    expect(component.mode).toBe('visual');
    const saved = vi.fn();
    component.saved.subscribe(saved);
    component.save();
    expect(saved).not.toHaveBeenCalled();
    component.rules[0].conditions[0].value = 7;
    component.writeRules();
    expect(component.diagnostics).toEqual([]);
    expect(component.previewText).toContain('refino mínimo +7');
  });

  it('keeps advanced imported clauses and autocasts intact when a different visual rule changes', () => {
    const { component } = studio();
    const advanced = 'GRADE[me==A]REFINE[weapon,headUpper==2]---5';
    const directive = [{ skillName: 'Teste', reason: 'Ainda sem cálculo' }];
    component.setMode('json');
    component.rawScript = JSON.stringify({ atk: [advanced, '10'], autoCastPending: directive });
    component.setMode('visual');
    expect(component.rules[0].readOnly).toBe(true);
    expect(component.rules[0].description).toContain('A cada 2 refinos');
    expect(component.rules[0].description).not.toContain('REFINE[');
    component.rules[1].value = 20;
    component.writeRules();
    expect(component.draft.script).toEqual({ atk: [advanced, '20'], autoCastPending: directive });
  });

  it('restores an unfinished visual draft after undoing script import', () => {
    const { component } = studio();
    component.addRule();
    component.rules[0].conditions = [{ kind: 'refine', value: null }];
    component.writeRules();
    const errors = [...component.diagnostics];
    component.importScript({ script: { atk: ['30'] } } as any);
    component.undoImport();
    expect(component.rules[0].conditions).toEqual([{ kind: 'refine', value: null }]);
    expect(component.diagnostics).toEqual(errors);
  });

  it('previews learned and active skill requirements from the build without changing its selections', () => {
    const { component } = studio();
    const character = new Mechanic();
    component.currentModel = { ...createMainModel(), class: 10,
      passiveSkills: character.passiveSkills.map((skill) => skill.name === 'Mammonite' ? 5 : 0),
      activeSkills: character.activeSkills.map((skill) => skill.name === 'Crazy Uproar' ? 1 : 0),
    };
    component.draft.name = 'Teste';
    component.addRule();
    component.rules[0].conditions = [{ kind: 'skill', value: 42, extra: 5 }, { kind: 'activeSkill', value: 155 }];
    const original = structuredClone(component.currentModel);
    component.writeRules();
    expect(component.previewBonuses).toEqual([{ label: 'ATQ', value: 1 }]);
    expect(component.currentModel).toEqual(original);
    component.currentModel.passiveSkills.fill(0);
    component.updatePreview();
    expect(component.previewBonuses).toEqual([]);
    component.currentModel.passiveSkills = original.passiveSkills;
    component.currentModel.activeSkills.fill(0);
    component.updatePreview();
    expect(component.previewBonuses).toEqual([]);
  });

  it('uses the preview grade when editing an equipped custom item without changing its saved attachments', () => {
    const { component } = studio();
    component.openCreate('armor');
    component.draft.id = CUSTOM_ITEM_MIN_ID + 72;
    component.draft.name = 'Teste';
    component.currentModel = { ...createMainModel(), armor: component.draft.id,
      customAttachments: { armor: { itemId: component.draft.id, cards: [], enchants: [], bas: [], refine: 0, grade: '' } },
    };
    component.previewRefine = 7;
    component.previewGrade = 'B';
    component.addRule();
    component.rules[0].conditions = [{ kind: 'refine', value: 7 }, { kind: 'grade', value: 'B' }];
    component.writeRules();
    expect(component.previewBonuses).toEqual([{ label: 'ATQ', value: 1 }]);
    expect(component.currentModel.customAttachments.armor).toMatchObject({ refine: 0, grade: '' });
    component.previewGrade = 'C';
    component.updatePreview();
    expect(component.previewBonuses).toEqual([]);
  });

  it('enforces the shared socket budget and preserves unaffected defaults', () => {
    const { component } = studio();
    component.changeCapacity('cardCapacity', 1);
    component.changeCapacity('enchantCapacity', 3);
    expect(component.cardCounts.map((option) => option.value)).toEqual([0, 1]);
    expect(component.enchantCounts.map((option) => option.value)).toEqual([0, 1, 2, 3]);
    component.changeCapacity('cardCapacity', 4);
    expect(component.draft.cardCapacity).toBe(1);
    component.draft.defaultBas = ['atk:10', 'atk:20', 'atk:30', 'atk:40', 'atk:50'];
    component.changeCapacity('baCapacity', 5);
    expect(component.attachmentRows[2].views).toHaveLength(5);
    component.changeCapacity('baCapacity', 3);
    expect(component.draft.defaultBas).toEqual(['atk:10', 'atk:20', 'atk:30']);
    expect(component.capacityNotice).toContain('2 BA(s)');
    component.changeCapacity('enchantCapacity', 0);
    component.changeCapacity('cardCapacity', 4);
    expect(component.enchantCounts.map((option) => option.value)).toEqual([0]);
  });

  it('reuses the equipment tree picker for BAs', async () => {
    const { component, picker } = studio();
    component.changeCapacity('baCapacity', 1);
    component.pickAttachment('defaultBas', component.attachmentRows[2].views[0], {} as HTMLElement);
    expect(picker.open).toHaveBeenCalledWith(expect.objectContaining({ mode: 'tree', title: 'BA 1' }));
    await Promise.resolve();
    expect(component.draft.defaultBas).toEqual(['atk:10']);
    expect(component.attachmentRows[2].views[0].filled).toBe(true);
  });

  it('treats an off-hand request as a weapon while preserving its equip destination', () => {
    const { component } = studio();
    component.openCreate('leftWeapon', { slot: 'leftWeapon', compare: true });
    expect(component.draft.kind).toBe('weapon');
    expect(component.context).toEqual({ slot: 'leftWeapon', compare: true });
    expect(component.kindOptions.some((option) => option.value === 'leftWeapon')).toBe(false);
  });
});
