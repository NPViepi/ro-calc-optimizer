import { useState } from 'react';
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, LOCALE_PROMPTS, Locale } from '../../app/core/i18n';
import { useServices } from '../services/application';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/primitives';
import { Select } from '../ui/select';

const OPTIONS = LOCALES.map(value => ({ value, label: LOCALE_NAMES[value] }));

/**
 * Asks for the interface language, once, on the first visit.
 *
 * Everything about it is written for a reader whose language is still unknown: the
 * question appears three times, the options name themselves, and the only control is
 * an OK. There is no close button, no Escape and no dismissable backdrop — a dialog
 * that can be waved away would leave the choice unmade and come back on the next
 * visit, which is the one thing it must never do.
 *
 * It opens from storage, not from the current locale: Portuguese is both the default
 * and a legitimate answer, so only a recorded choice can tell the two apart. Pressing
 * OK writes it even when it is the language already on screen — see
 * `LocalePreferences.select`.
 */
export function LocaleFirstRun() {
  const services = useServices();
  const [asked, setAsked] = useState(() => services.locale.chosen);
  const [choice, setChoice] = useState<Locale>(DEFAULT_LOCALE);
  if (asked) return null;
  const confirm = () => {
    void services.locale.select(choice);
    setAsked(true);
  };
  return <Dialog visible modal closable={false} closeOnEscape={false} onVisibleChange={() => undefined}
    className="locale-first-run" style={{ width: '22rem', maxWidth: '92vw' }}
    header={<div className="locale-first-run-prompts">
      {LOCALES.map(locale => <span key={locale} lang={locale}>{LOCALE_PROMPTS[locale]}</span>)}
    </div>}
    footer={<Button label="OK" className="locale-first-run-ok" onClick={confirm} autoFocus />}>
    <Select inputId="locale-first-run" ariaLabel={LOCALE_PROMPTS[choice]} options={OPTIONS}
      optionLabel="label" optionValue="value" value={choice} onChange={setChoice} />
  </Dialog>;
}
