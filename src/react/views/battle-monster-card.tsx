import { createElement, useState } from 'react';
import { monsterDamageReductionTooltip } from '../../app/constants/monster-damage-reduction';
import { elementPtBr, monsterTypePtBr, racePtBr, sizePtBr } from '../../app/constants/monster-i18n';
import { elementTagClass } from '../../app/layout/pages/ro-calculator/battle-hud/battle-hud.logic';
import { ReductionCategory, ReductionRow, reductionRowClickable } from '../../app/layout/pages/ro-calculator/reduction-breakdown';
import { DropdownModel } from '../../app/models/dropdown.model';
import { getMonsterOffensiveSkills } from '../../app/constants/monster-offensive-skills';
import { IncomingDamageStep } from '../../app/core/monster-damage-taken';
import { formatNumber } from '../../app/utils/format-number';
import { missingIcon, monsterSpriteUrl } from '../services/assets';
import { keyActivate } from '../ui/key-activate';
import { Popover } from '../ui/popover';
import { Card, Icon, Tag } from '../ui/primitives';
import { Select } from '../ui/select';
import { useTooltip } from '../ui/tooltip';
import { useText } from '../state/use-text';
import './battle-monster-card.css';
import './battle-hud.css';
import { BattleDamageTakenCard } from './battle-damage-taken-card';

export interface BattleMonsterCardProps {
  totalSummary: any; selectedMonster: number; selectedMonsterName: string;
  isInProcessingPreset?: boolean; isRelieveTarget?: boolean; relieveLevelOptions?: DropdownModel[];
  relieveLevel?: number; onRelieveLevelChange?: (value: number) => void;
  betelgeuseHp?: number; betelgeuseHpOptions?: DropdownModel[]; onBetelgeuseHpChange?: (value: number) => void;
  spriteUrlOverride?: string | null; spriteFallbackUrl?: string | null;
  reductionCategories?: ReductionCategory[]; reductionSources?: Record<string, any>;
  onShowElementTable?: () => void; onReductionRowClick?: (row: ReductionRow) => void;
  onIncomingReductionClick?: (step: IncomingDamageStep) => void;
}
export function BattleMonsterCard({ totalSummary, selectedMonster, selectedMonsterName, isInProcessingPreset = false,
  isRelieveTarget = false, relieveLevelOptions = [], relieveLevel = 0, onRelieveLevelChange,
  betelgeuseHp, betelgeuseHpOptions = [], onBetelgeuseHpChange,
  spriteUrlOverride, spriteFallbackUrl, reductionCategories = [], reductionSources = {},
  onShowElementTable, onReductionRowClick, onIncomingReductionClick }: BattleMonsterCardProps) {
  const t = useText();
  const monster = totalSummary?.monster;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const aura = useTooltip({ text: t('hud.auraTooltip'), position: 'top' });
  const reduction = useTooltip({ text: monster?.damageReduction > 0 ? monsterDamageReductionTooltip(monster.damageReduction) : '', position: 'top' });
  // The tag's click opens the table, so the tip only names that action: no tap.
  const element = useTooltip({ text: t('hud.elementTable'), position: 'top', tap: false });
  const relieve = useTooltip({ text: t('hud.relieveTooltip'), position: 'top' });
  // Angular's number pipe renders an absent value as an empty string.
  const number = (value: number | null | undefined) => value == null ? '' : formatNumber(value);
  return createElement('app-battle-monster-card', null, <div className="hud-card-col hud-card-col--monster"><Card className="hud-card">
    <div className="hud-monster-head"><div className={`sprite ${spriteUrlOverride ? 'sprite--doll' : ''}`}>
      {spriteUrlOverride ? <img src={spriteUrlOverride} onError={event => { if (spriteFallbackUrl) event.currentTarget.src = spriteFallbackUrl; }} alt=""
        style={{ imageRendering: 'pixelated', maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} /> :
        <img src={monsterSpriteUrl(selectedMonster)} alt="" {...missingIcon} />}
    </div><div className="hud-monster-info">
      <div className="np-name">{selectedMonsterName}</div><div className="np-badges">
        {monster?.typeUpper && <Tag severity="danger" value={monsterTypePtBr(monster.typeUpper)} />}
        {monster?.isMvp && <Tag severity="warning" value="MVP" />}
        {monster?.isRedAura && <Tag {...aura.triggerProps} tabIndex={0} className="tag-aura" value="AURA" />}
        {!!monster?.damageReduction && <Tag {...reduction.triggerProps} tabIndex={0} className="tag-map-reduction" value={t('hud.mapReduction', { percent: monster.damageReduction })} />}
      </div><div className="hud-hp-line">HP {number(monster?.hp)}</div>
      {selectedMonster === 20994 && !!betelgeuseHpOptions.length && <div className="hud-relieve">
        <span className="hud-relieve-label">{t('hud.difficulty')}</span>
        <Select className="hud-relieve-dd" ariaLabel={t('hud.betelgeuseDifficulty')} options={betelgeuseHpOptions}
          optionLabel="label" optionValue="value" disabled={isInProcessingPreset} value={betelgeuseHp}
          onChange={value => onBetelgeuseHpChange?.(value)} />
      </div>}
      {isRelieveTarget && <div className="hud-relieve"><span {...relieve.triggerProps} tabIndex={0} className="hud-relieve-label">{t('hud.relieve')}</span>
        <Select className="hud-relieve-dd" options={relieveLevelOptions} optionLabel="label" optionValue="value"
          disabled={isInProcessingPreset} value={relieveLevel} onChange={value => onRelieveLevelChange?.(value)} />
      </div>}
      {!!reductionCategories.length && <div className="hud-reduction">
        <span {...keyActivate()} className="reduction-label bonus_clickable" onClick={event => setAnchor(anchor ? null : event.currentTarget)}><Icon name="shield" /> {t('hud.damageReduction')}</span>
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="reduction-panel"><div className="reduction-pop">
          {reductionCategories.map((category, index) => <div key={index} className="reduction-cat"><div className="reduction-cat-title">{category.label}</div>
            {category.rows.map((row, rowIndex) => <div key={rowIndex} {...keyActivate()} className={`reduction-row ${reductionRowClickable(row, reductionSources) ? 'bonus_clickable' : ''}`}
              onClick={() => { if (reductionRowClickable(row, reductionSources)) onReductionRowClick?.(row); }}>
              <span className="reduction-row-label">{row.label}</span><span className={`reduction-val ${row.percent < 0 ? 'neg' : ''}`}>{row.percent}%</span>
            </div>)}
          </div>)}
        </div></Popover>
      </div>}
      {!!selectedMonster && <a className="monster_id_link" href={`https://www.divine-pride.net/database/monster/${selectedMonster}`} target="_blank" rel="noopener noreferrer">
        {t('hud.monsterId', { id: selectedMonster })}<Icon className="ml-1" style={{ fontSize: '.7rem' }} name="external-link" /></a>}
    </div></div>
    <div className="hud-band-right"><div className="hud-mstats">
      <div className="kv"><span>DEF</span><span className="v-def">{number(monster?.softDef)} + {number(monster?.def)}</span></div>
      <div className="kv"><span>DEFM</span><span className="v-def">{number(monster?.softMDef)} + {number(monster?.mdef)}</span></div>
      <div className="kv"><span>{t('hud.hitFor100')}</span><span className="v-def">{number(monster?.hitRequireFor100)}</span></div>
      <div className="kv"><span>TEN / TENM</span><span><span className="v-res">{number(monster?.res)}</span> / <span className="v-resm">{number(monster?.mres)}</span></span></div>
    </div><div className="hud-sub">
      <Tag {...element.triggerProps} {...keyActivate()} aria-label={`${elementPtBr(monster?.elementLevelUpper)}: ver tabela elemental`} className={`el-tag-clickable ${elementTagClass(monster?.elementUpper)}`} icon="search" value={elementPtBr(monster?.elementLevelUpper)}
        onClick={() => { if (!isInProcessingPreset) onShowElementTable?.(); }} />
      <span className="v-race">{racePtBr(monster?.raceUpper)}</span><span className="v-size">{sizePtBr(monster?.sizeFullUpper)}</span>
    </div><div className="hud-attrs">
      {([['stat.str', 'str', 'for'], ['stat.int', 'int', 'int'], ['stat.dex', 'dex', 'des'], ['stat.agi', 'agi', 'des'], ['stat.vit', 'vit', 'vit'], ['stat.luk', 'luk', 'vit']] as const)
        .map(([label, key, color]) => <div className="kv" key={key}><span>{t(label)}</span><span className={`v-${color}`}>{number(monster?.[key])}</span></div>)}
    </div></div>
    {monster?.isRedAura && aura.tooltip}{reduction.tooltip}{isRelieveTarget && relieve.tooltip}{element.tooltip}
  </Card>{totalSummary?.incomingDamage?.attacker.id === selectedMonster && !!getMonsterOffensiveSkills(selectedMonster).length &&
    <BattleDamageTakenCard key={selectedMonster} profile={totalSummary.incomingDamage} disabled={isInProcessingPreset} onReductionClick={onIncomingReductionClick} />}
  </div>);
}
