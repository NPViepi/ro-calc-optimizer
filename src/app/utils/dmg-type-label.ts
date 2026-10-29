// Display-only labels for the skill damage type (the raw value still drives logic
// elsewhere, e.g. Magical-only chips/[hidden] gates). Melee and Range share their entries
// with the damage-taken table, which names the same two in the same words.
import { TextKey, Translate } from '../i18n';

const DMG_TYPE_KEYS: Record<string, TextKey> = {
  Melee: 'taken.melee',
  Range: 'taken.ranged',
  Magical: 'ss.groupMagic',
};

export function dmgTypeLabel(type: string, text: Translate): string {
  const key = DMG_TYPE_KEYS[type];
  return key ? text(key) : type;
}
