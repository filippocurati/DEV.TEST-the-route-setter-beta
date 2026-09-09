import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, GENERIC_PUBLIC_MESSAGE } from '../../src/errors/AppError';
import { ERROR_REPORTER_DEFAULTS, ErrorReporter, type FrontendLogDto } from '../../src/errors/ErrorReporter';

const reporters: ErrorReporter[] = [];
const receipt = () => new Response(JSON.stringify({ requestId: 'log-request', errorId: 'abcdefabcdefabcdefabcdefabcdefab' }), { status: 202 });
const create = (transport = vi.fn().mockResolvedValue(receipt()), ui = vi.fn()) => {
  const reporter = new ErrorReporter(ui, { fetch: transport });
  reporters.push(reporter);
  return { reporter, transport, ui };
};
const dtoAt = (transport: ReturnType<typeof vi.fn>, index = 0): FrontendLogDto => JSON.parse(transport.mock.calls[index][1].body);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  reporters.splice(0).forEach(reporter => reporter.dispose());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ErrorReporter CON02', () => {
  it('usa limiti predefiniti e invia in modo asincrono un DTO sicuro con gli ID originali', async () => {
    expect(ERROR_REPORTER_DEFAULTS).toEqual({ maxQueue: 20, maxDedupe: 100, dedupeMs: 30_000, throttleMs: 1_000,
      maxAttempts: 3, retryBaseMs: 1_000, maxRetryMs: 8_000, timeoutMs: 5_000 });
    const { reporter, transport, ui } = create();
    const error = new AppError('Caricamento non riuscito.', { category: 'Http',
      errorId: '12345678-1234-1234-1234-123456789abc', requestId: 'original-request',
      context: { status: '500', operation: 'load', resource: 'https://private/?token=secret', stack: 'RAW_STACK' },
    });
    expect(reporter.report(error, 'Catalog')).toBe(error.publicMessage);
    expect(transport).not.toHaveBeenCalled();
    expect(ui).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(999);
    expect(transport).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(dtoAt(transport)).toEqual({ level: 'Error', category: 'Http', component: 'Catalog',
      message: error.publicMessage, errorId: error.errorId, requestId: error.requestId,
      context: { status: '500', operation: 'load', resource: '[REDACTED]' },
    });
    expect(transport.mock.calls[0][0]).toBe('/api/logs');
    expect(transport.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('scarta dettagli grezzi, URL, stack e contesto non dichiarato', async () => {
    const { reporter, transport } = create();
    reporter.report(new TypeError('RAW_STACK https://private/?token=secret'), 'https://private');
    await vi.runAllTimersAsync();
    expect(dtoAt(transport)).toEqual({ level: 'Error', category: 'Unknown', component: '[REDACTED]',
      message: GENERIC_PUBLIC_MESSAGE, context: { errorClass: 'TypeError' } });
  });

  it('deduplica raffiche e limita la coda inclusa la richiesta in corso', async () => {
    const { reporter, transport } = create();
    for (let i = 0; i < 1_000; i += 1) reporter.report(new Error(`RAW_${i}`), 'GlobalError');
    for (let i = 0; i < 100; i += 1) reporter.report(new Error(), `Component${i}`);
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(ERROR_REPORTER_DEFAULTS.maxQueue);
    expect(dtoAt(transport).component).toBe('GlobalError');
    reporter.report(new Error(), 'GlobalError');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(transport).toHaveBeenCalledTimes(20);
    await vi.advanceTimersByTimeAsync(30_000);
    reporter.report(new Error(), 'GlobalError');
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(21);
  });

  it('limita anche la memoria di deduplica', async () => {
    const transport = vi.fn().mockResolvedValue(receipt());
    const reporter = new ErrorReporter(() => {}, { fetch: transport, maxDedupe: 2, throttleMs: 1 });
    reporters.push(reporter);
    for (const component of ['A', 'B', 'C', 'A']) {
      reporter.report(null, component);
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it('ritenta in sequenza con attesa esponenziale limitata senza ricorsione', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('RAW_LOG_NETWORK'));
    const { reporter } = create(transport);
    reporter.report(new AppError('Primo errore.'), 'A');
    reporter.report(new AppError('Secondo errore.'), 'B');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(transport).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(transport).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(transport).toHaveBeenCalledTimes(3);
    expect(transport.mock.calls.slice(0, 3).map(call => call[1].body)).toEqual(Array(3).fill(transport.mock.calls[0][1].body));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(dtoAt(transport, 3).component).toBe('B');
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(6);
  });

  it.each([408, 429, 500, 503])('ritenta HTTP %s al massimo tre volte', async (status) => {
    const { reporter, transport } = create(vi.fn().mockImplementation(() => Promise.resolve(new Response('', { status }))));
    reporter.report(null, 'Catalog');
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 403, 404])('non ritenta HTTP %s', async (status) => {
    const { reporter, transport } = create(vi.fn().mockResolvedValue(new Response('', { status })));
    reporter.report(null, 'Catalog');
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('interrompe richieste bloccate e gestisce anche rigetti tardivi', async () => {
    let reject!: (error: unknown) => void;
    const { reporter, transport } = create(vi.fn().mockImplementation(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; })));
    reporter.report(null, 'Catalog');
    await vi.advanceTimersByTimeAsync(1_000);
    const signal = transport.mock.calls[0][1].signal as AbortSignal;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(signal.aborted).toBe(true);
    reject(new Error('RAW_LATE_REJECTION'));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(transport).toHaveBeenCalledTimes(2);
    reporter.dispose();
    expect((transport.mock.calls[1][1].signal as AbortSignal).aborted).toBe(true);
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dispose elimina invii pendenti e rende report privo di effetti', async () => {
    const { reporter, transport } = create();
    reporter.report(null, 'Catalog');
    reporter.dispose();
    reporter.dispose();
    expect(reporter.report(null, 'Catalog')).toBe(GENERIC_PUBLIC_MESSAGE);
    await vi.runAllTimersAsync();
    expect(transport).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('installa una sola coppia di handler, notifica la UI e non chiama preventDefault', async () => {
    const target = new EventTarget() as unknown as Window;
    const { reporter, transport, ui } = create();
    reporter.installGlobal(target);
    const uninstall = reporter.installGlobal(target);
    const error = new Event('error', { cancelable: true });
    Object.defineProperty(error, 'error', { value: new TypeError('RAW_GLOBAL') });
    target.dispatchEvent(error);
    const rejection = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(rejection, 'reason', { value: 'RAW_REJECTION' });
    target.dispatchEvent(rejection);
    expect(error.defaultPrevented).toBe(false);
    expect(rejection.defaultPrevented).toBe(false);
    expect(ui.mock.calls).toEqual([[GENERIC_PUBLIC_MESSAGE], [GENERIC_PUBLIC_MESSAGE]]);
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(2);
    uninstall();
    target.dispatchEvent(error);
    expect(ui).toHaveBeenCalledTimes(2);
    reporter.installGlobal(target);
    reporter.dispose();
    target.dispatchEvent(rejection);
    expect(ui).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])('contiene guasti del callback UI sincrono o asincrono: %s', async (asyncFailure) => {
    const target = new EventTarget() as unknown as Window;
    const ui = vi.fn(() => {
      target.dispatchEvent(new Event('error'));
      if (asyncFailure) return Promise.reject(new Error('RAW_UI'));
      throw new Error('RAW_UI');
    });
    const { reporter, transport } = create(undefined, ui);
    reporter.installGlobal(target);
    target.dispatchEvent(new Event('error'));
    await vi.runAllTimersAsync();
    expect(ui).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
