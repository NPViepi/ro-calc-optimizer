import { Children, isValidElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AutoCastHudComponent } from './auto-cast-hud';
import { DescriptionStore } from '../services/data-client';
import { Content } from '../views/content/auto-cast-hud';
import { AutoCastSimulation } from '../../app/core/auto-cast';
import { createMainModel } from '../../app/utils';
import { DEFAULT_CATALOG } from '../../app/i18n';
import { translate } from '../../app/core/i18n';

// The view reads its text through a hook; called as a plain function here, it needs the
// catalog handed to it directly. pt-BR is the source, so the assertions stay in pt-BR.
vi.mock('../state/use-text', () => ({
  useText: () => (key: string, params?: Record<string, string | number>) => translate(DEFAULT_CATALOG, key, params),
  useRichText: () => (key: string, params?: Record<string, string | number>) => translate(DEFAULT_CATALOG, key, params),
}));

// Inspect the real view's element tree and run its ref callbacks without a browser.
vi.mock('../views/render', async () => ({
  ...await import('../views/template-values'),
  Render: () => null,
}));

function references(tree: ReactNode): any[] {
  const found: any[] = [];
  Children.forEach(tree, child => {
    if (!isValidElement<any>(child)) return;
    if (child.props.props?.reference) found.push(child.props.props);
    found.push(...references(child.props.children));
  });
  return found;
}

function hud() {
  const vm = new AutoCastHudComponent(new DescriptionStore(), (key, params) => translate(DEFAULT_CATALOG, key, params));
  vm.model = createMainModel();
  vm.summary = { dmg: { basicMinDamage: 100, basicMaxDamage: 100 } };
  vm.simulation = {
    attacksPerSecond: 4, basicHitsPerAttack: 1, basicHitsPerSecond: 4,
    fearBreezeLevel: 0, normalHitRate: 100, criticalRate: 0,
    effectiveHitRate: 100, eligibleAttacksPerSecond: 4,
    basicAttackDps: 400, autoCastDps: 1280, totalDps: 1680,
    timeToKillSeconds: 6, slots: [], blockedSources: [],
    sources: [{
      source: { key: 'hawk-rush', sourceName: 'Mergulho Aéreo', skillId: 5326,
        skillLevel: 5, chance: 32, trigger: 'ranged-physical-hit' },
      name: 'Mergulho Aéreo', icon: 5326, activationsPerSecond: 1.28,
      triggerAttacksPerSecond: 4, expectedDamagePerActivation: 1000,
      damageRanges: [{ kind: 'flat', label: 'Dano', min: 1000, max: 1000 }],
      dps: 1280, contributionPercent: 1280 / 1680 * 100,
      summary: {}, canCrit: false, criticalRate: 0,
    }],
  } as AutoCastSimulation;
  return vm;
}

describe('Auto-cast HUD references (tracker Rsz5Q3EJQ8Hy9hawE3zC)', () => {
  it.each([48, 2234])('uses the basic-attack damage breakdown for extra-hit skill %i', (skillId) => {
    const vm = hud();
    const result = vm.simulation!.sources[0];
    Object.assign(result.source, { kind: 'extra-hit', skillId });
    const source = vm.dpsSources.find((entry) => !entry.isBasic)!;
    const open = vi.fn();
    vi.spyOn(vm as any, 'sourceAnchor').mockReturnValue(null);
    vm.openDamage(source, 'nocri', {} as Event, { open });
    expect(open.mock.calls[0][2].entry.isBasic).toBe(true);
    expect(open.mock.calls[0][2].summary).toBe(vm.summary);
  });
  it.each([false, true])('renders again after mounting details icons, comparing=%s', comparing => {
    const vm = hud();
    vm.isComparing = comparing;
    vm.simulation2 = comparing ? { ...vm.simulation!, totalDps: 2000 } : null;
    const tree = Content({ vm, services: {} });
    const icons = references(tree).filter(props => props.label?.startsWith('Detalhes de '));
    expect(icons).toHaveLength(2); // basic attack and Mergulho Aéreo
    for (const icon of icons) icon.reference({ nativeElement: { id: icon['data-auto-source'] } });
    expect(() => Content({ vm, services: {} })).not.toThrow();
    expect(vm.dpsSources.find(source => source.key === 'hawk-rush').dps).toBe(1280);
    expect(typeof vm.sourceInfo).toBe('function');

    const open = vi.spyOn(vm, 'openDetails').mockImplementation(() => {});
    const event = {} as Event;
    icons[1].click(event);
    expect(open.mock.calls[0][3]).toEqual({ id: 'hawk-rush' });
    for (const icon of icons) icon.reference(null);
    expect(() => Content({ vm, services: {} })).not.toThrow();
  });
});
