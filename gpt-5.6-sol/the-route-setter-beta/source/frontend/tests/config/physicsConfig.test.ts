import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PHYSICS_CONFIG,
  HOLD_PENETRATION_TOLERANCE_METERS,
  loadPhysicsConfig,
  parsePhysicsConfig,
} from '../../src/config/physicsConfig';

const validationMessage = 'Configurazione fisica non valida: la tolleranza parete deve essere un numero tra 1 e 10 mm.';
const loadingMessage = 'Impossibile leggere la configurazione fisica. Verificare il file physics-config.json e ricaricare la pagina.';

describe('parsePhysicsConfig', () => {
  it('usa 5 mm come default parete e mantiene separata la tolleranza prese di 1 mm', () => {
    expect(DEFAULT_PHYSICS_CONFIG).toEqual({ wallPenetrationToleranceMm: 5 });
    expect(parsePhysicsConfig(DEFAULT_PHYSICS_CONFIG)).toEqual({ wallPenetrationToleranceMm: 5 });
    expect(HOLD_PENETRATION_TOLERANCE_METERS).toBe(0.001);
  });

  it.each([1, 3, 5, 7.5, 10])('accetta %s mm senza arrotondare o modificare il default', (value) => {
    expect(parsePhysicsConfig({ wallPenetrationToleranceMm: value }))
      .toEqual({ wallPenetrationToleranceMm: value });
    expect(DEFAULT_PHYSICS_CONFIG.wallPenetrationToleranceMm).toBe(5);
    expect(HOLD_PENETRATION_TOLERANCE_METERS).toBe(0.001);
  });

  it.each([
    ['zero', { wallPenetrationToleranceMm: 0 }],
    ['negativo', { wallPenetrationToleranceMm: -1 }],
    ['sotto il minimo', { wallPenetrationToleranceMm: 0.5 }],
    ['sopra il massimo', { wallPenetrationToleranceMm: 10.1 }],
    ['stringa numerica', { wallPenetrationToleranceMm: '5' }],
    ['NaN', { wallPenetrationToleranceMm: NaN }],
    ['Infinity', { wallPenetrationToleranceMm: Infinity }],
    ['-Infinity', { wallPenetrationToleranceMm: -Infinity }],
    ['valore null', { wallPenetrationToleranceMm: null }],
    ['valore undefined', { wallPenetrationToleranceMm: undefined }],
    ['valore booleano', { wallPenetrationToleranceMm: true }],
    ['valore array', { wallPenetrationToleranceMm: [5] }],
    ['valore oggetto', { wallPenetrationToleranceMm: {} }],
    ['documento null', null],
    ['documento undefined', undefined],
    ['documento numerico', 5],
    ['documento stringa', '5'],
    ['documento booleano', true],
    ['array vuoto', []],
    ['array di configurazioni', [{ wallPenetrationToleranceMm: 5 }]],
    ['chiave mancante', {}],
    ['chiave sconosciuta', { wallPenetrationToleranceMm: 5, extra: true }],
    ['tolleranza prese non configurabile', { wallPenetrationToleranceMm: 5, holdPenetrationToleranceMm: 3 }],
    ['nome chiave errato', { wallToleranceMm: 5 }],
  ])('rifiuta %s con un messaggio leggibile', (_name, value) => {
    expect(() => parsePhysicsConfig(value)).toThrowError(new Error(validationMessage));
  });
});

describe('loadPhysicsConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(['/', '/route-setter/'])('richiede una volta il file pubblico con base %s e cache no-store', async (baseUrl) => {
    vi.stubEnv('BASE_URL', baseUrl);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"wallPenetrationToleranceMm":7.5}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPhysicsConfig()).resolves.toEqual({ wallPenetrationToleranceMm: 7.5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}physics-config.json`, { cache: 'no-store' });
  });

  it.each([404, 500])('rifiuta HTTP %s senza ripiegare sul default o esporre la risposta', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"wallPenetrationToleranceMm":5}', {
      status,
      statusText: 'RAW_HTTP_DETAILS',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPhysicsConfig()).rejects.toThrowError(new Error(loadingMessage));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['file vuoto', ''],
    ['JSON troncato', '{"wallPenetrationToleranceMm":'],
    ['commento', '{"wallPenetrationToleranceMm":5 /* comment */}'],
    ['virgola finale', '{"wallPenetrationToleranceMm":5,}'],
    ['chiave senza virgolette', '{wallPenetrationToleranceMm:5}'],
    ['apici singoli', "{'wallPenetrationToleranceMm':5}"],
    ['NaN non JSON', '{"wallPenetrationToleranceMm":NaN}'],
    ['Infinity non JSON', '{"wallPenetrationToleranceMm":Infinity}'],
  ])('accetta solo JSON stretto: rifiuta %s senza esporre errori del parser', async (_name, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));

    await expect(loadPhysicsConfig()).rejects.toThrowError(new Error(loadingMessage));
  });

  it('non espone dettagli grezzi degli errori di parsing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockRejectedValue(new SyntaxError('RAW_PARSE_DETAILS: private file contents')),
    }));

    await expect(loadPhysicsConfig()).rejects.toThrowError(new Error(loadingMessage));
  });

  it('non espone dettagli grezzi degli errori di rete e non ritenta la richiesta', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('RAW_NETWORK_DETAILS: internal host'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPhysicsConfig()).rejects.toThrowError(new Error(loadingMessage));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    '{"wallPenetrationToleranceMm":0.5}',
    '{"wallPenetrationToleranceMm":"5"}',
    '{"wallPenetrationToleranceMm":1e400}',
    '{"wallPenetrationToleranceMm":5,"extra":true}',
    '{}',
    'null',
    '[]',
  ])('valida il documento ricevuto senza usare il default: %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));

    await expect(loadPhysicsConfig()).rejects.toThrowError(new Error(validationMessage));
  });
});
