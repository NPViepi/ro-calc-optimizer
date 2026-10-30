import { useId, useState } from 'react';
import { ElementType } from '../../app/constants/element-type.const';
import { getMonsterOffensiveSkills } from '../../app/constants/monster-offensive-skills';
import { calculateMonsterDamageTaken, IncomingDamageProfile, IncomingDamageStep } from '../../app/core/monster-damage-taken';
import { ELE_PT } from '../../app/core/pvp';
import { formatNumber } from '../../app/utils/format-number';
import { Card, Icon } from '../ui/primitives';
import { Popover } from '../ui/popover';
import { Select } from '../ui/select';
import { useText } from '../state/use-text';
import './battle-damage-taken-card.css';

interface Props {
  profile: IncomingDamageProfile;
  disabled?: boolean;
  onReductionClick?: (step: IncomingDamageStep) => void;
}

export function BattleDamageTakenCard({ profile, disabled = false, onReductionClick }: Props) {
  const t = useText();
  const id = useId();
  const skills = getMonsterOffensiveSkills(profile.attacker.id);
  const [open, setOpen] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState<HTMLButtonElement | null>(null);
  const [skillId, setSkillId] = useState(skills[0]?.id);
  const [cometDistance, setCometDistance] = useState(0);
  const [earthquakeTargets, setEarthquakeTargets] = useState(1);
  const [meteors, setMeteors] = useState(1);
  const [attackerDistance, setAttackerDistance] = useState(1);
  const [armor, setArmor] = useState<ElementType | 'auto'>('auto');
  const result = calculateMonsterDamageTaken(profile, skillId, { cometDistance, earthquakeTargets, meteors, attackerDistance,
    armorElement: armor === 'auto' ? undefined : armor });
  if (!result) return null;
  const basicAttack = result.skill.formula === 'basic-attack';
  const range = (min: number, max: number) => min === max ? formatNumber(min) : `${formatNumber(min)} – ${formatNumber(max)}`;
  const skillOptions = skills.map(skill => ({ label: skill.formula === 'basic-attack' ? skill.name
    : t('taken.skillOption', { name: skill.name, level: skill.level }), value: skill.id }));
  const numbers = (max: number, cells = false) => Array.from({ length: max }, (_, index) =>
    ({ label: cells ? t('taken.cells', { count: index + 1 }) : String(index + 1), value: index + 1 }));
  const armorOptions = [{ label: t('taken.armorEquipped', { element: ELE_PT[profile.defender.armorElement.toLowerCase()] }), value: 'auto' },
    ...Object.values(ElementType).map(value => ({ label: t('taken.elementLevel', { element: ELE_PT[value.toLowerCase()] }), value }))];
  return <Card className="damage-taken-card">
    <button type="button" className="damage-taken-toggle" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => { setOpen(!open); setInfoAnchor(null); }}>
      <Icon name="shield" /><span>{t('taken.title')}</span><Icon name={open ? 'chevron-down' : 'chevron-right'} />
    </button>
    <div id={`${id}-content`} hidden={!open} role="region" aria-label={t('taken.title')} className="damage-taken-content">
      <label className="damage-taken-field"><span>{t('taken.attack')}</span>
        <Select ariaLabel={t('taken.attack')} options={skillOptions} optionLabel="label" optionValue="value" value={skillId} disabled={disabled} onChange={value => { setSkillId(value); setInfoAnchor(null); }} />
      </label>
      <div className="damage-taken-badges"><span>{t(result.skill.damageType === 'physical' ? 'misc.physical' : result.skill.damageType === 'fixed' ? 'taken.fixed' : 'misc.magical')}</span>
        <span>{basicAttack ? t('taken.noElement') : ELE_PT[result.skill.element.toLowerCase()]}</span>
        <span>{basicAttack ? t(profile.attacker.attackRange > 3 ? 'taken.ranged' : 'taken.melee') : t('taken.skillLevel', { level: result.skill.level })}</span></div>
      {!basicAttack && result.skill.formula !== 'killing-aura' && <label className="damage-taken-field"><span>{t('taken.armorElement')}</span>
        <Select ariaLabel={t('taken.armorElement')} options={armorOptions} optionLabel="label" optionValue="value" value={armor} disabled={disabled} onChange={setArmor} />
      </label>}
      {result.skill.formula === 'npc-comet' && <label className="damage-taken-field"><span>{t('taken.cometDistance')}</span>
        <Select ariaLabel={t('taken.cometDistance')} options={Array.from({ length: 10 }, (_, value) => ({ label: t('taken.cells', { count: value }), value }))}
          optionLabel="label" optionValue="value" value={cometDistance} disabled={disabled} onChange={setCometDistance} />
      </label>}
      {result.skill.formula === 'earthquake' && <label className="damage-taken-field"><span>{t('taken.earthquakeTargets')}</span>
        <Select ariaLabel={t('taken.earthquakeTargets')} options={numbers(30)} optionLabel="label" optionValue="value" value={earthquakeTargets} disabled={disabled} onChange={setEarthquakeTargets} />
      </label>}
      {result.skill.formula === 'meteor-storm' && <label className="damage-taken-field"><span>{t('taken.meteors')}</span>
        <Select ariaLabel={t('taken.meteors')} options={numbers(7)} optionLabel="label" optionValue="value" value={meteors} disabled={disabled} onChange={setMeteors} />
      </label>}
      {result.skill.formula === 'hell-judgement' && <label className="damage-taken-field"><span>{t('taken.monsterDistance')}</span>
        <Select ariaLabel={t('taken.monsterDistance')} options={numbers(14, true)} optionLabel="label" optionValue="value" value={attackerDistance} disabled={disabled} onChange={setAttackerDistance} />
      </label>}
      <div className="damage-taken-result" aria-live="polite">
        <div className="damage-taken-result-heading">
          <span>{t(result.skill.damageType === 'fixed' ? 'taken.perSecond' : basicAttack ? 'taken.perBasic' : 'taken.total')}</span>
          <button type="button" className="damage-taken-info" aria-label={t('taken.info')} title={t('taken.info')}
            aria-expanded={!!infoAnchor} aria-controls={`${id}-info`} onClick={event => setInfoAnchor(infoAnchor ? null : event.currentTarget)}>
            <Icon name="info-circle" />
          </button>
        </div>
        <strong>{range(result.min, result.max)}</strong>
        {result.hpPercent && <span>{t('taken.hpPercent', { percent: range(Math.round(result.hpPercent.min * 10) / 10, Math.round(result.hpPercent.max * 10) / 10) })}</span>}
        {result.hits > 1 && <span>{t('taken.perHit', { damage: range(result.perHit.min, result.perHit.max), hits: result.hits,
          unit: t(result.skill.formula === 'earthquake' ? 'taken.wave' : 'taken.hit'),
          units: t(result.skill.formula === 'earthquake' ? 'taken.waves' : 'taken.hits') })}</span>}
      </div>
      <Popover anchor={infoAnchor} onClose={() => setInfoAnchor(null)} ariaLabel={t('taken.info')} className="damage-taken-info-panel">
        <div id={`${id}-info`}>
          <p className="damage-taken-note">{result.skill.note}</p>
          <p className="damage-taken-note">{t('taken.estimateNote')}</p>
        </div>
      </Popover>
      <details className="damage-taken-formula"><summary>{t('taken.formulaDetails')}</summary>
        <dl>{result.steps.map((step, index) => <div key={index}>
          <dt>{step.keys.length && onReductionClick ? <button type="button" onClick={() => onReductionClick(step)}>{step.label}</button> : step.label}
            {step.factor != null && <small> ×{formatNumber(Math.round(step.factor * 10000) / 10000)}</small>}</dt>
          <dd>{range(step.min, step.max)}</dd>
        </div>)}</dl>
      </details>
      <a className="damage-taken-source" href={basicAttack ? `https://www.divine-pride.net/database/monster/${profile.attacker.id}` : `https://www.divine-pride.net/database/skill/${result.skill.id}`} target="_blank" rel="noopener noreferrer">{t(basicAttack ? 'taken.sourceMonster' : 'taken.sourceSkill')} <Icon name="external-link" /></a>
    </div>
  </Card>;
}
