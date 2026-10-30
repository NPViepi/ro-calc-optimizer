import { DataClient, DescriptionStore } from './data-client';
import { DataManifest } from '../../app/core/data-manifest';
import { skillDescHtml } from '../../app/utils/pretty-item-desc';
import { SKILL_DESC_BY_ID } from '../../app/skills';
import { PREVIEW_275_REFERENCE } from '../../app/skills/preview-275-reference';

describe('React data loading', () => {
  it('provides English descriptions for every preview without waiting for client prose', () => {
    for (const skill of PREVIEW_275_REFERENCE) {
      const html = skillDescHtml(skill.id);
      expect(html).toContain(`${skill.name} (Prévia)<br>Max level: ${skill.maxLevel}<br>`);
      expect(html).toContain('Preview kRO 275/60.');
      expect(html).not.toContain('undefined');
    }
    expect(skillDescHtml(6515)).toContain('5 hits around the target and 3 around the caster');
    expect(skillDescHtml(5505)).toContain('+15000 Max HP, +3 P.Atk and +3 S.Matk per skill level');
  });
  it('adopts preload promises without issuing duplicate requests', async () => {
    const items = Promise.resolve({ 1: { name: 'Item' } });
    const fetcher = vi.fn();
    const client = new DataClient({ inFlight: { itemsCore: items } }, undefined, fetcher);
    expect(client.load('itemsCore')).toBe(items);
    expect(client.load('itemsCore')).toBe(items);
    await expect(client.load('itemsCore')).resolves.toEqual({ 1: { name: 'Item' } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not start descriptions until core resolves and preserves custom descriptions', async () => {
    let finish!: (value: unknown) => void;
    const items = new Promise(resolve => { finish = resolve; });
    const manifest = { base: 'assets/data/', files: { itemsDesc: 'descriptions.json' } } as unknown as DataManifest;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ '1': 'Official' })));
    const descriptions = new DescriptionStore();
    descriptions.upsert(1_000_000_000_001, 'Custom');
    const client = new DataClient({ manifest, inFlight: { itemsCore: items } }, descriptions, fetcher);
    const loading = client.loadDescriptions('pt-BR');
    expect(fetcher).not.toHaveBeenCalled();
    finish({});
    await loading;
    expect(client.loadDescriptions('pt-BR')).toBe(loading);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('assets/data/descriptions.json');
    expect(descriptions.get(1)).toBe('Official');
    expect(descriptions.get(1_000_000_000_001)).toBe('Custom');
    expect(descriptions.getSnapshot()).toBe(2);
  });
  it('fetches the descriptions of the language the reader chose', async () => {
    const manifest = { base: 'assets/data/', files: { itemsDesc: 'pt.json', itemsDescEn: 'en.json' } } as unknown as DataManifest;
    const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify({ '1': url.includes('en') ? 'Official' : 'Oficial' })));
    const descriptions = new DescriptionStore();
    const client = new DataClient({ manifest, inFlight: { itemsCore: Promise.resolve({}) } }, descriptions, fetcher as unknown as typeof fetch);

    await client.loadDescriptions('en');
    expect(fetcher).toHaveBeenCalledWith('assets/data/en.json');
    expect(descriptions.get(1)).toBe('Official');
  });

  it('republishes the descriptions of a language the reader comes back to', async () => {
    const manifest = { base: 'assets/data/', files: { itemsDesc: 'pt.json', itemsDescEn: 'en.json' } } as unknown as DataManifest;
    const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify({ '1': url.includes('en') ? 'Official' : 'Oficial' })));
    const descriptions = new DescriptionStore();
    const client = new DataClient({ manifest, inFlight: { itemsCore: Promise.resolve({}) } }, descriptions, fetcher as unknown as typeof fetch);

    await client.loadDescriptions('en');
    await client.loadDescriptions('pt-BR');
    expect(descriptions.get(1)).toBe('Oficial');
    await client.loadDescriptions('en');
    // Back to English: the file is already cached, but the store still has to be
    // repopulated — the second visit must not leave Portuguese prose on screen.
    expect(descriptions.get(1)).toBe('Official');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('leaves the language on screen alone when a switch is superseded mid-flight', async () => {
    const manifest = { base: 'assets/data/', files: { itemsDescEs: 'es.json', itemsDescEn: 'en.json' } } as unknown as DataManifest;
    const release: Array<() => void> = [];
    const fetcher = vi.fn((url: string) => new Promise<Response>(resolve => {
      release.push(() => resolve(new Response(JSON.stringify({ '1': url.includes('en') ? 'Official' : 'Oficial' }))));
    }));
    const descriptions = new DescriptionStore();
    const client = new DataClient({ manifest, inFlight: { itemsCore: Promise.resolve({}) } }, descriptions, fetcher as unknown as typeof fetch);

    const spanish = client.loadDescriptions('es');
    const english = client.loadDescriptions('en');
    // Both wait on itemsCore first, so neither request is out yet on this tick.
    await vi.waitFor(() => expect(release).toHaveLength(2));
    // English answers first on purpose: the stale Spanish reply lands over it.
    release.reverse().forEach(resolve => resolve());
    await Promise.all([spanish, english]);
    expect(descriptions.get(1)).toBe('Official');
  });

  it('asks for no name overlay at all in Portuguese', async () => {
    const fetcher = vi.fn();
    const client = new DataClient({}, undefined, fetcher as unknown as typeof fetch);
    await expect(client.loadItemNames('pt-BR')).resolves.toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('serves the name overlay for a translated language', async () => {
    const manifest = { base: 'assets/data/', files: { itemNamesEs: 'names-es.json' } } as unknown as DataManifest;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ '1101': 'Espada' })));
    const client = new DataClient({ manifest }, undefined, fetcher as unknown as typeof fetch);
    await expect(client.loadItemNames('es')).resolves.toEqual({ '1101': 'Espada' });
    expect(fetcher).toHaveBeenCalledWith('assets/data/names-es.json');
  });

  it('rejects an HTTP error instead of presenting it as a dataset', async () => {
    const client = new DataClient({}, undefined, async () => new Response('failure', { status: 503 }));
    await expect(client.load('itemsCore')).rejects.toThrow('HTTP 503');
  });
  it('refreshes descriptions once and does not keep a skill tooltip cached as empty', async () => {
    const id = 999_999;
    expect(skillDescHtml(id)).toBe('');
    const manifest = { base: 'assets/data/', files: { skillDescriptions: 'skills.json' } } as unknown as DataManifest;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ [id]: 'Descrição da habilidade' })));
    const descriptions = new DescriptionStore();
    const changed = vi.fn();
    descriptions.subscribe(changed);
    const client = new DataClient({ manifest }, descriptions, fetcher);
    const loading = client.loadSkillDescriptions();
    expect(client.loadSkillDescriptions()).toBe(loading);
    await loading;
    expect(skillDescHtml(id)).toBe('Descrição da habilidade');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    delete SKILL_DESC_BY_ID[id];
  });
  it('allows a failed manifest request to be retried', async () => {
    const manifest = { base: 'assets/data/', files: { itemsCore: 'items.json' } } as unknown as DataManifest;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('failure', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: 'loaded' })));
    const client = new DataClient({}, undefined, fetcher);
    await expect(client.load('itemsCore')).rejects.toThrow('HTTP 503');
    await expect(client.load('itemsCore')).resolves.toEqual({ item: 'loaded' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
