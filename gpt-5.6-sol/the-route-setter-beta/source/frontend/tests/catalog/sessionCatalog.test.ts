import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
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
});
