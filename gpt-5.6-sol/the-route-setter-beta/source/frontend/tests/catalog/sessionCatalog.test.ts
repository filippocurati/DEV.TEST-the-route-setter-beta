import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColliderStatus, HoldManifest, HoldReadiness } from '../../src/api/holdApi';
import { SessionCatalog } from '../../src/catalog/sessionCatalog';

const manifest = [
  {
    id: 'Hold1',
    previewUrl: '/api/holds/Hold1/preview',
    modelUrl: '/api/holds/Hold1/model',
    colliderUrl: '/api/holds/Hold1/collider',
    colliderStatus: 'Ready' as const,
    optionalAssetUrls: [],
  },
  {
    id: 'Hold2',
    previewUrl: null,
    modelUrl: '/api/holds/Hold2/model',
    colliderUrl: null,
    colliderStatus: 'Pending' as const,
    optionalAssetUrls: [],
  },
];

describe('catalogo di sessione', () => {
  it('conserva il MIME delle anteprime SVG', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
      headers: { 'Content-Type': 'image/svg+xml' },
    })));
    const create = vi.fn(() => 'blob:svg');
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
    const catalog = new SessionCatalog();
    await catalog.loadPreview(manifest[0]);
    expect((create.mock.calls as unknown as [Blob][])[0][0].type).toBe('image/svg+xml');
    await catalog.dispose();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('richiede manifest e preview una sola volta', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url === '/api/holds') {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      return new Response(new Blob(['preview']), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });
    const catalog = new SessionCatalog();

    await Promise.all([catalog.loadManifest(), catalog.loadManifest()]);
    await Promise.all([catalog.loadPreview(manifest[0]), catalog.loadPreview(manifest[0])]);

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/holds')).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/holds/Hold1/preview')).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalledWith('/api/holds/Hold1/model');
  });

  it('garantisce unicita e transizione catalogo scena', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest), { status: 200 })));
    const catalog = new SessionCatalog();

    expect(catalog.use('Hold1')).toBe(true);
    expect(catalog.use('Hold1')).toBe(false);
    expect((await catalog.availableHolds()).map((hold) => hold.id)).toEqual(['Hold2']);

    catalog.release('Hold1');

    expect(catalog.isUsed('Hold1')).toBe(false);
    expect((await catalog.availableHolds()).map((hold) => hold.id)).toEqual(['Hold1', 'Hold2']);
  });

  describe('aggiornamento readiness', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:preview'),
        revokeObjectURL: vi.fn(),
      });
    });

    it.each([
      ['Pending', 'Ready'],
      ['Pending', 'Failed'],
      ['Missing', 'Ready'],
      ['Missing', 'Failed'],
    ] as const)('aggiorna %s -> %s senza ricaricare metadati o asset e arresta il polling', async (initial, terminal) => {
      const { holds, fetchMock, fetchStatus } = mockReadiness(initial);
      const catalog = new SessionCatalog();
      const onChange = vi.fn(async () => {
        for (const hold of await catalog.availableHolds()) await catalog.loadPreview(hold);
      });
      const cachedManifest = catalog.loadManifest();
      await cachedManifest;
      await catalog.loadPreview(holds[0]);
      await catalog.watchReadiness(onChange);
      await catalog.watchReadiness(onChange);

      await vi.advanceTimersByTimeAsync(999);
      expect(fetchStatus).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
      expect(fetchStatus).toHaveBeenLastCalledWith(expect.objectContaining({
        cache: 'no-store', signal: expect.any(AbortSignal),
      }));
      expect(onChange).not.toHaveBeenCalled();

      const state: HoldReadiness = {
        id: 'Hold1', colliderStatus: terminal,
        colliderUrl: terminal === 'Ready' ? '/api/holds/Hold1/collider' : null,
      };
      fetchStatus.mockResolvedValueOnce(Response.json([state]));
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(await catalog.availableHolds()).toEqual([{ ...holds[0], ...state }]);
      expect(catalog.loadManifest()).toBe(cachedManifest);
      expect(await cachedManifest).toEqual(holds);
      expect((await cachedManifest)[0].colliderStatus).toBe(initial);
      expect(await catalog.loadPreview((await catalog.availableHolds())[0])).toBe('blob:preview');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchStatus).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        '/api/holds', '/api/holds/Hold1/preview', '/api/holds/status', '/api/holds/status',
      ]);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      await catalog.dispose();
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    });

    it.each(['Ready', 'Failed'] as const)('non avvia il polling per un manifest gia %s', async status => {
      const { fetchStatus } = mockReadiness(status);
      const catalog = new SessionCatalog();
      const onChange = vi.fn();
      await catalog.watchReadiness(onChange);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchStatus).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      await catalog.dispose();
    });

    it('segnala errori temporanei, limita il backoff a 30 secondi e ripristina il secondo dopo il recupero', async () => {
      const { holds, fetchMock, fetchStatus } = mockReadiness();
      fetchStatus.mockImplementation(async () => Response.json({}, { status: 503 }));
      const onError = vi.fn();
      const onChange = vi.fn();
      const catalog = new SessionCatalog(onError);
      await catalog.loadPreview(holds[0]);
      await catalog.watchReadiness(onChange);

      let calls = 0;
      for (const delay of [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]) {
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(fetchStatus).toHaveBeenCalledTimes(calls);
        await vi.advanceTimersByTimeAsync(1);
        calls += 1;
        expect(fetchStatus).toHaveBeenCalledTimes(calls);
        expect(onError).toHaveBeenCalledTimes(calls);
        expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({
          category: 'Http', context: { status: '503' },
        }));
        expect(onChange).not.toHaveBeenCalled();
        expect(await catalog.availableHolds()).toEqual(holds);
      }

      fetchStatus.mockResolvedValueOnce(Response.json([
        { id: 'Hold1', colliderStatus: 'Pending', colliderUrl: null },
      ]));
      await vi.advanceTimersByTimeAsync(29_999);
      expect(fetchStatus).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchStatus).toHaveBeenCalledTimes(calls + 1);
      expect(onChange).not.toHaveBeenCalled();

      fetchStatus.mockResolvedValueOnce(Response.json([
        { id: 'Hold1', colliderStatus: 'Ready', colliderUrl: '/api/holds/Hold1/collider' },
      ]));
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchStatus).toHaveBeenCalledTimes(calls + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchStatus).toHaveBeenCalledTimes(calls + 2);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect((await catalog.availableHolds())[0].colliderStatus).toBe('Ready');
      expect(onError).toHaveBeenCalledTimes(calls);
      await catalog.loadPreview((await catalog.availableHolds())[0]);
      expect(fetchMock.mock.calls.filter(([url]) => url === '/api/holds')).toHaveLength(1);
      expect(fetchMock.mock.calls.filter(([url]) => url === holds[0].previewUrl)).toHaveLength(1);
      expect(fetchMock.mock.calls.filter(([url]) => url.toString().endsWith('/model'))).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchStatus).toHaveBeenCalledTimes(calls + 2);
      expect(vi.getTimerCount()).toBe(0);
      await catalog.dispose();
    });

    it('preserva use e release mentre aggiorna una presa temporaneamente fuori dal catalogo', async () => {
      const { holds, fetchStatus } = mockReadiness();
      const catalog = new SessionCatalog();
      const onChange = vi.fn();
      await catalog.watchReadiness(onChange);
      expect(catalog.use('Hold1')).toBe(true);
      expect(catalog.use('Hold1')).toBe(false);
      expect(await catalog.availableHolds()).toEqual([]);
      fetchStatus.mockResolvedValueOnce(Response.json([
        { id: 'Hold1', colliderStatus: 'Ready', colliderUrl: '/api/holds/Hold1/collider' },
      ]));
      await vi.advanceTimersByTimeAsync(1000);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(catalog.isUsed('Hold1')).toBe(true);
      expect(catalog.use('Hold1')).toBe(false);
      expect(await catalog.availableHolds()).toEqual([]);

      catalog.release('Hold1');
      expect(catalog.isUsed('Hold1')).toBe(false);
      expect(await catalog.availableHolds()).toEqual([{
        ...holds[0], colliderStatus: 'Ready', colliderUrl: '/api/holds/Hold1/collider',
      }]);
      expect(catalog.use('Hold1')).toBe(true);
      await catalog.dispose();
    });

    it('annulla il timer e non riavvia il watcher dopo dispose', async () => {
      const { fetchStatus } = mockReadiness();
      const catalog = new SessionCatalog();
      const onChange = vi.fn();
      await catalog.watchReadiness(onChange);
      await vi.advanceTimersByTimeAsync(999);
      await catalog.dispose();
      expect(vi.getTimerCount()).toBe(0);
      await catalog.watchReadiness(onChange);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchStatus).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each(['risposta', 'errore'] as const)('ignora %s dopo dispose, abortisce la richiesta e rilascia le preview', async outcome => {
      const { holds, fetchStatus } = mockReadiness();
      let resolve!: (response: Response) => void;
      let reject!: (error: unknown) => void;
      let signal: AbortSignal | null | undefined;
      fetchStatus.mockImplementationOnce(init => {
        signal = init?.signal;
        // Il trasporto ignora abort per simulare una risposta ormai in arrivo.
        return new Promise<Response>((res, rej) => { resolve = res; reject = rej; });
      });
      const onError = vi.fn();
      const onChange = vi.fn();
      const catalog = new SessionCatalog(onError);
      await catalog.loadPreview(holds[0]);
      await catalog.watchReadiness(onChange);
      await vi.advanceTimersByTimeAsync(1000);
      expect(signal?.aborted).toBe(false);
      await catalog.dispose();
      expect(signal?.aborted).toBe(true);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');

      if (outcome === 'risposta') {
        resolve(Response.json([{ id: 'Hold1', colliderStatus: 'Ready', colliderUrl: '/api/holds/Hold1/collider' }]));
      } else {
        reject(new TypeError('late network failure'));
      }
      await vi.advanceTimersByTimeAsync(60_000);
      expect(await catalog.availableHolds()).toEqual(holds);
      expect(onChange).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(fetchStatus).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('non crea object URL per una preview completata dopo dispose', async () => {
      const { holds, fetchMock } = mockReadiness();
      let resolve!: (response: Response) => void;
      fetchMock.mockImplementationOnce(() => new Promise<Response>(res => { resolve = res; }));
      const catalog = new SessionCatalog();
      const preview = catalog.loadPreview(holds[0]);
      const disposal = catalog.dispose();
      resolve(new Response('preview'));
      expect(await preview).toBeNull();
      await disposal;
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it('mantiene una sola richiesta in volo, abortisce dopo 10 secondi e recupera con backoff', async () => {
      const { fetchStatus } = mockReadiness();
      let signal: AbortSignal | null | undefined;
      fetchStatus.mockImplementationOnce(init => {
        signal = init?.signal;
        return new Promise<Response>((_, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      });
      const onError = vi.fn();
      const onChange = vi.fn();
      const catalog = new SessionCatalog(onError);
      await catalog.watchReadiness(onChange);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(9999);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
      expect(signal?.aborted).toBe(false);
      expect(onError).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(signal?.aborted).toBe(true);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();

      fetchStatus.mockResolvedValueOnce(Response.json([
        { id: 'Hold1', colliderStatus: 'Ready', colliderUrl: '/api/holds/Hold1/collider' },
      ]));
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchStatus).toHaveBeenCalledTimes(2);
      expect(fetchStatus.mock.calls[1][0]?.signal).not.toBe(signal);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      await catalog.dispose();
    });
  });
});

function mockReadiness(colliderStatus: ColliderStatus = 'Pending') {
  const holds: readonly HoldManifest[] = [{
    ...manifest[0], colliderStatus,
    colliderUrl: colliderStatus === 'Ready' ? manifest[0].colliderUrl : null,
  }];
  const fetchStatus = vi.fn(async (_init?: RequestInit) => Response.json(holds.map(
    ({ id, colliderStatus, colliderUrl }): HoldReadiness => ({ id, colliderStatus, colliderUrl }),
  )));
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    if (url === '/api/holds') return Response.json(holds);
    if (url === '/api/holds/status') return fetchStatus(init);
    if (url === '/api/holds/Hold1/preview') return new Response('preview');
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { holds, fetchMock, fetchStatus };
}
