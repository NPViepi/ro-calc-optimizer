import { LOCALES, LOCALE_NAMES } from '../../app/core/i18n';
import { useServices } from '../services/application';
import { useLocale, useText } from '../state/use-text';
import { Select } from '../ui/select';

/**
 * The interface language, in the top bar.
 *
 * Each language names itself — Português, Español, English — rather than being named
 * in the language currently on screen: someone who opens the simulator in a language
 * they don't read has to be able to find their own in the list. `LOCALE_NAMES` is
 * where those names live, outside the catalogs, so they cannot be translated.
 */
const OPTIONS = LOCALES.map(value => ({ value, label: LOCALE_NAMES[value] }));

export function LocaleSelect() {
  const services = useServices();
  const t = useText();
  const locale = useLocale();
  return <Select inputId="topbar-locale" ariaLabel={t('locale.label')} className="topbar-locale"
    options={OPTIONS} optionLabel="label" optionValue="value" value={locale}
    onChange={value => { void services.locale.select(value); }} />;
}
