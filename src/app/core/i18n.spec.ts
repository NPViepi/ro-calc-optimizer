import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_NAMES, fill, isLocale, textRuns, translate } from './i18n';

describe('isLocale', () => {
  it('rejects anything that is not a shipped locale, including junk from storage', () => {
    expect(isLocale('pt-BR')).toBe(true);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('pt')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(7)).toBe(false);
  });
});

describe('LOCALE_NAMES', () => {
  it('names every shipped locale, so the selector can never show a blank row', () => {
    expect(LOCALES.filter(locale => !LOCALE_NAMES[locale])).toEqual([]);
  });
});

describe('fill', () => {
  it('replaces named placeholders', () => {
    expect(fill('{n} de {total}', { n: 3, total: 9 })).toBe('3 de 9');
  });

  it('leaves a placeholder written out when its value is missing', () => {
    expect(fill('{n} itens', { other: 1 })).toBe('{n} itens');
  });

  it('fills the same placeholder everywhere it appears', () => {
    expect(fill('{n} de {n}', { n: 2 })).toBe('2 de 2');
  });
});

describe('translate', () => {
  const catalog = { greeting: 'Olá', count: '{n} itens' };

  it('looks a key up', () => {
    expect(translate(catalog, 'greeting')).toBe('Olá');
  });

  it('interpolates named placeholders', () => {
    expect(translate(catalog, 'count', { n: 3 })).toBe('3 itens');
  });

  it('answers the key itself when the catalog has not got it, rather than throwing', () => {
    expect(translate(catalog, 'absent.key')).toBe('absent.key');
  });
});

describe('textRuns', () => {
  it('keeps a plain sentence as a single run', () => {
    expect(textRuns('O ciclo fecha em 4s')).toEqual([{ text: 'O ciclo fecha em 4s', emphasis: false }]);
  });

  it('splits the emphasis out of the middle of a clause', () => {
    expect(textRuns('limita o Hab./s a *2,5* por segundo')).toEqual([
      { text: 'limita o Hab./s a ', emphasis: false },
      { text: '2,5', emphasis: true },
      { text: ' por segundo', emphasis: false },
    ]);
  });

  it('handles emphasis at either end and several in one entry', () => {
    expect(textRuns('*Prévias*: itens e *habilidades*')).toEqual([
      { text: 'Prévias', emphasis: true },
      { text: ': itens e ', emphasis: false },
      { text: 'habilidades', emphasis: true },
    ]);
  });

  // The left-hand ATK note is written with three asterisks, and it has to survive.
  it('leaves unpaired asterisks as written', () => {
    const note = '*** ATK da mão esquerda ainda não calculado';
    expect(textRuns(note)).toEqual([{ text: note, emphasis: false }]);
  });

  it('marks a backtick run as code', () => {
    expect(textRuns('a redução global (`fctPercent`) usa o maior valor')).toEqual([
      { text: 'a redução global (', emphasis: false },
      { text: 'fctPercent', emphasis: false, code: true },
      { text: ') usa o maior valor', emphasis: false },
    ]);
  });

  it('mixes emphasis and code in one entry', () => {
    expect(textRuns('*Formatar JSON* organiza `0.3`')).toEqual([
      { text: 'Formatar JSON', emphasis: true },
      { text: ' organiza ', emphasis: false },
      { text: '0.3', emphasis: false, code: true },
    ]);
  });

  it('answers nothing for an empty entry', () => {
    expect(textRuns('')).toEqual([]);
  });
});
