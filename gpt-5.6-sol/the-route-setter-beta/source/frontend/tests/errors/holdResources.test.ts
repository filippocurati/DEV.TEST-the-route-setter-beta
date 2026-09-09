import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, type LoadingManager } from 'three';
import type { HoldManifest } from '../../src/api/holdApi';
import { AppError } from '../../src/errors/AppError';
import { loadHoldModel } from '../../src/holds/holdResources';

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    constructor(private readonly manager: LoadingManager) {}
    parseAsync(bytes: ArrayBuffer, path: string) { return parse(this.manager, bytes, path); }
  },
}));
const definition: HoldManifest = { id: 'HoldTest', previewUrl: null, modelUrl: '/api/holds/HoldTest/model',
  colliderUrl: null, colliderStatus: 'Ready', optionalAssetUrls: [] };

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('caricamento modello sicuro CON02', () => {
  it('conserva gli errori HTTP e permette di ritentare dopo un parsing fallito', async () => {
    vi.stubGlobal('window', { location: { href: 'http://localhost/' } });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]))));
    vi.stubGlobal('fetch', fetchMock);
    parse.mockRejectedValueOnce(new SyntaxError('RAW_GLB https://private/?token=secret'));
    await expect(loadHoldModel(definition)).rejects.toMatchObject({
      name: 'AppError', publicMessage: 'Impossibile leggere il modello della presa.', category: 'AssetLoad',
    });
    const template = new Group();
    parse.mockResolvedValueOnce({ scene: template });
    const resource = await loadHoldModel(definition);
    expect(resource.template).toBe(template);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[0][2]).toBe('/api/holds/HoldTest/assets/');
    resource.dispose();
  });

  it('rifiuta risorse secondarie fallite anche quando il loader risolve', async () => {
    vi.stubGlobal('window', { location: { href: 'http://localhost/' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))));
    parse.mockImplementationOnce(async (manager: LoadingManager) => {
      manager.onError('https://private/texture?token=secret');
      return { scene: new Group() };
    });
    await expect(loadHoldModel(definition)).rejects.toMatchObject({
      publicMessage: 'Impossibile caricare le risorse del modello della presa.', category: 'AssetLoad',
    });
  });

  it('non perde la correlazione della richiesta del GLB', async () => {
    const errorId = '12345678123412341234123456789abc';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'RAW', errorId, requestId: 'model-request',
    }), { status: 500 })));
    await expect(loadHoldModel(definition)).rejects.toBeInstanceOf(AppError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'RAW', errorId, requestId: 'model-request',
    }), { status: 500 })));
    await expect(loadHoldModel(definition)).rejects.toMatchObject({ errorId, requestId: 'model-request' });
    expect(parse).not.toHaveBeenCalled();
  });
});
