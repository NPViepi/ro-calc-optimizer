import { createElement } from 'react';
import { iconUrl, missingIcon } from '../services/assets';
import { SelectButton } from '../ui/select-button';
import { useTooltip } from '../ui/tooltip';
import './battle-effects.css';

export interface BattleEffect { name: string; label: string; label2?: string; itemId?: number; }
function Effect({ item, customIcon }: { item: BattleEffect; customIcon?: (id: number) => number | undefined }) {
  const tip = useTooltip({ text: (item.label2 || '').replace(/^\s*\[\s*/, '').replace(/\s*\]\s*$/, ''), position: 'top' });
  return <><span {...tip.triggerProps} tabIndex={item.label2 ? 0 : undefined} className="hud-buff-item">
    {item.itemId && <img src={iconUrl(item.itemId, 'item', customIcon)} alt="" className="hud-buff-icon" {...missingIcon} />}{item.label}
  </span>{tip.tooltip}</>;
}
export interface BattleEffectsProps {
  chanceList: BattleEffect[]; selectedChances: string[]; onChange: (selected: string[]) => void;
  chanceList2?: BattleEffect[]; selectedChances2?: string[]; onCompareChange?: (selected: string[]) => void;
  isComparing?: boolean; customIcon?: (id: number) => number | undefined;
}
export function BattleEffects({ chanceList, selectedChances, onChange, chanceList2 = [], selectedChances2 = [],
  onCompareChange, isComparing = false, customIcon }: BattleEffectsProps) {
  return createElement('app-battle-effects', null, <div className="battle-effects">
    {!!chanceList.length && <div className="hud-buffs"><span className="cap">Efeitos</span>
      <SelectButton options={chanceList} optionValue="name" multiple value={selectedChances} onChange={onChange}
        className="hud-buffs-select" renderItem={item => <Effect item={item} customIcon={customIcon} />} />
    </div>}
    {isComparing && !!chanceList2.length && <div className="hud-buffs"><span className="cap cap--cmp">Efeitos - comparação</span>
      <SelectButton options={chanceList2} optionValue="name" multiple value={selectedChances2} onChange={selected => onCompareChange?.(selected)}
        className="hud-buffs-select" renderItem={item => <Effect item={item} customIcon={customIcon} />} />
    </div>}
  </div>);
}
