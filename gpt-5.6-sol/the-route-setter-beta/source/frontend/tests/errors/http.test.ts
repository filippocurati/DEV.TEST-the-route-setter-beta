import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBytes, fetchJson } from '../../src/api/http';
import { fetchBinaryAsset, fetchHoldCollider, fetchHoldManifest } from '../../src/api/holdApi';
import { fetchWallModel } from '../../src/api/wallApi';
import { AppError } from '../../src/errors/AppError';

const errorId = '12345678123412341234123456789abc';
const requestId = 'request-123:01';
const safeMessage = 'Impossibile completare la richiesta.';
const collider = {
  sourceHash: `sha256:${'a'.repeat(64)}`,
  vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  indices: [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('trasporto sicuro CON02', () => {
  it('inoltra opzioni e restituisce JSON e byte senza inviare log', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"ok":true}'))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetchMock);
    const init = { signal: new AbortController().signal, cache: 'no-store' as const };
    await expect(fetchJson('/api/test', safeMessage, init)).resolves.toEqual({ ok: true });
    expect(new Uint8Array(await fetchBytes('/api/bytes', safeMessage))).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledWith('/api/test', init);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([fetchJson, fetchBytes])('preserva gli ID senza fidarsi del messaggio remoto', async (load) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errorId, requestId, message: 'RAW_SECRET https://private/?token=abc', stack: 'RAW_STACK',
    }), { status: 500, headers: { 'X-Request-Id': 'header-id' } })));
    await expect(load('/api/test', safeMessage)).rejects.toMatchObject({
      publicMessage: safeMessage, errorId, requestId, category: 'Http', context: { status: '500' },
    });
  });

  it.each(['<html>RAW_SECRET</html>', 'null', '[]', '{"requestId":"forged"}', '{"message":"x","requestId":"https://secret","errorId":"bad"}'])
    ('scarta corpi non conformi e usa la correlazione HTTP: %s', async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, {
        status: 404, headers: { 'X-Request-Id': requestId },
      })));
      await expect(fetchJson('/api/test', safeMessage)).rejects.toMatchObject({
        publicMessage: safeMessage, errorId: undefined, requestId,
      });
    });

  it('conserva requestId anche senza errorId nel contratto backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ requestId, message: 'RAW' }), { status: 400 })));
    await expect(fetchJson('/api/test', safeMessage)).rejects.toMatchObject({ errorId: undefined, requestId });
  });

  it('rende sicuri errori di rete, annullamento e parsing', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('RAW_NETWORK https://private'))
      .mockRejectedValueOnce(new DOMException('RAW_ABORT', 'AbortError'))
      .mockResolvedValueOnce(new Response('RAW_JSON', { headers: { 'X-Request-Id': requestId } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchBytes('/api/test', safeMessage)).rejects.toMatchObject({ publicMessage: safeMessage, category: 'Network' });
    await expect(fetchJson('/api/test', safeMessage)).rejects.toBeInstanceOf(AppError);
    await expect(fetchJson('/api/test', safeMessage)).rejects.toMatchObject({ publicMessage: safeMessage, category: 'Parsing', requestId });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gestisce il fallimento durante la lettura del corpo binario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, headers: new Headers({ 'X-Request-Id': requestId }),
      arrayBuffer: () => Promise.reject(new Error('RAW_STREAM')),
    }));
    await expect(fetchBytes('/api/test', safeMessage)).rejects.toMatchObject({ publicMessage: safeMessage, requestId });
  });

  it.each([
    () => fetchHoldManifest(), () => fetchWallModel(),
    () => fetchBinaryAsset('/api/model'), () => fetchHoldCollider('/api/collider'),
  ])('i wrapper conservano la correlazione e non registrano autonomamente', async (load) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errorId, requestId, message: 'RAW' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(load()).rejects.toMatchObject({ errorId, requestId });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('schema collider CON02', () => {
  it('accetta un collider completo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(collider))));
    await expect(fetchHoldCollider('/api/collider')).resolves.toEqual(collider);
  });

  it.each([
    null, [], {}, { ...collider, sourceHash: 2 }, { ...collider, sourceHash: 'sha256:x' },
    { ...collider, indices: undefined }, { ...collider, vertices: undefined },
    { ...collider, vertices: 'not-an-array' }, { ...collider, vertices: [0, 0, 0] },
    { ...collider, vertices: [...collider.vertices, 0] },
    { ...collider, vertices: collider.vertices.map((v, i) => i === 0 ? null : v) },
    { ...collider, vertices: collider.vertices.map((v, i) => i === 0 ? '0' : v) },
    { ...collider, vertices: collider.vertices.map((v, i) => i === 0 ? 1e100 : v) },
    { ...collider, indices: [] }, { ...collider, indices: [...collider.indices, 0] },
    ...[-1, 4, 0.5, '0', null].map(index => ({ ...collider, indices: [index, ...collider.indices.slice(1)] })),
  ])('rifiuta documenti malformati senza TypeError: %s', async (document) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(document))));
    await expect(fetchHoldCollider('/api/collider')).rejects.toMatchObject({
      name: 'AppError', publicMessage: 'La geometria fisica della presa non e valida.', category: 'Parsing',
    });
  });

  it('rifiuta numeri non finiti nel JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(collider).replace('[0,0,0', '[1e400,0,0'))));
    await expect(fetchHoldCollider('/api/collider')).rejects.toBeInstanceOf(AppError);
  });
});
