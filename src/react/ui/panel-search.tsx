import { ReactNode, useRef, useState } from 'react';
import { createFuzzyMatcher } from '../../app/utils/fuzzy-search';
import { TextKey } from '../../app/i18n';
import { useText } from '../state/use-text';
import { Icon } from './primitives';

/**
 * `what` names the panel being searched ("consumíveis", "habilidades e buffs") and is
 * a catalog key rather than the word itself: it is read inside "Buscar {what}", so the
 * noun has to follow the reader's language too.
 */
export function PanelSearch({ what, labels, children }: {
  what: TextKey;
  labels: string[];
  children: (matches: (text: string) => boolean) => ReactNode;
}) {
  const t = useText();
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const matches = createFuzzyMatcher(query);
  const hasResults = labels.some(matches);
  const search = t('ui.panelSearch.search', { what: t(what) });
  return <>
    <div className="calc-panel-search">
      <Icon name="search" />
      <input ref={input} type="search" className="ui-inputtext" aria-label={search}
        placeholder={search} value={query} autoComplete="off"
        onChange={event => setQuery(event.target.value)} />
      {query && <button type="button" className="ui-link" aria-label={t('ui.panelSearch.clear', { what: t(what) })}
        onClick={() => { setQuery(''); input.current?.focus(); }}><Icon name="times" /></button>}
    </div>
    {!hasResults && query.trim() ? <p className="calc-search-empty" role="status">{t('ui.panelSearch.empty')}</p> : children(matches)}
  </>;
}
