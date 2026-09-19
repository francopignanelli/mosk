// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import atlas from '../public/data/malecns-v1.0-atlas.json';
import { ConnectomeAtlas } from '../src/ui/ConnectomeAtlas';

describe('MaleCNS source attribution and sampling', () => {
  it('pins the real annotation release and source counts without calling every row a neuron', () => {
    expect(atlas.source.sha256).toBe(
      '2177e246113e4cfbf1e7772ec37c6da1955ff22e8063d0b1f833101f99a9a3b2',
    );
    expect(atlas.source.bytes).toBe(14483314);
    expect(atlas.source.annotationRows).toBe(211577);
    expect(Object.values(atlas.source.statusCounts).reduce((sum, count) => sum + count, 0)).toBe(
      211577,
    );
    expect(atlas.source.statusCounts.Glia).toBe(11864);
    expect(atlas.source.license).toBe('CC BY 4.0');
    expect(atlas.source.attribution).toContain('Google Research');
    expect(atlas.groups.map((group) => [group.id, group.totalMatches])).toEqual([
      ['olfactory', 2639],
      ['alpn', 686],
      ['kenyon', 4064],
      ['dan', 340],
      ['mbon', 97],
      ['descending', 1314],
      ['gustatory', 1428],
      ['visual', 9201],
    ]);
  });

  it('preserves original IDs and source classes in the deterministic 96-cell subset', () => {
    const ids = new Set<string>();
    for (const group of atlas.groups) {
      expect(group.cells.length).toBe(12);
      expect(group.sampledCount).toBe(12);
      expect(group.totalMatches).toBeGreaterThanOrEqual(group.eligibleTracedTypedMatches);
      expect(group.eligibleTracedTypedMatches).toBeGreaterThanOrEqual(group.sampledCount);
      let lastId = 0;
      for (const cell of group.cells) {
        expect(cell.status).toBe('Traced');
        expect(cell.type).not.toBe('');
        expect(cell[group.annotationField as 'class' | 'superclass']).toBe(group.annotationValue);
        expect(Number(cell.bodyId)).toBeGreaterThan(lastId);
        expect(ids.has(cell.bodyId)).toBe(false);
        ids.add(cell.bodyId);
        lastId = Number(cell.bodyId);
      }
    }
    expect(ids.size).toBe(atlas.sampledRows);
    expect(atlas.groups.find((group) => group.id === 'descending')!.cells[0]).toMatchObject({
      bodyId: '10001',
      type: 'DNp01',
      instance: 'DNp01(GF)_R',
      somaSide: 'R',
    });
    expect(atlas.groups.find((group) => group.id === 'mbon')!.cells[0]).toMatchObject({
      bodyId: '10013',
      type: 'MBON01',
      class: 'MBON',
    });
  });
});

describe('MaleCNS reference atlas', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it('loads the actual sample, separates anatomy from activity, and browses source groups', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => atlas }));
    await act(async () => root.render(<ConnectomeAtlas />));
    expect(host.textContent).toContain('96 sampled cells');
    expect(host.textContent).toContain('cells do not control the fly');
    expect(host.textContent).toContain('4,064 traced, typed entries');
    const descending = [
      ...host.querySelectorAll<HTMLButtonElement>('.atlas-group-list button'),
    ].find((button) => button.textContent === 'Descending neurons')!;
    await act(async () => descending.click());
    expect(descending.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('tbody')?.textContent).toContain('DNp01(GF)_R');
    expect(host.querySelector('tbody')?.textContent).toContain('10001');
    expect(host.textContent).toContain('1,314 rows labeled');
    expect(host.querySelector('a[href="https://male-cns.janelia.org/download/"]')).not.toBeNull();
  });

  it('searches across groups by real body ID without claiming a full-connectome query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => atlas }));
    await act(async () => root.render(<ConnectomeAtlas />));
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        '10013',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.querySelector('tbody')?.textContent).toContain('MBON01');
    expect(host.querySelectorAll('tbody tr').length).toBe(1);
    expect(host.textContent).toContain('does not query the full connectome');
  });

  it('reports fetch failure and allows a successful retry without inventing cells', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => atlas });
    vi.stubGlobal('fetch', fetcher);
    await act(async () => root.render(<ConnectomeAtlas />));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    expect(host.querySelector('table')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(host.textContent).toContain('96 sampled cells');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
