import { describe, expect, it } from 'vitest';
import { AppError, GENERIC_PUBLIC_MESSAGE, toAppError } from '../../src/errors/AppError';
import { parsePhysicsConfig } from '../../src/config/physicsConfig';

describe('AppError CON02', () => {
  it('conserva solo messaggi dichiarati sicuri e correlazioni valide', () => {
    const error = new AppError('Impossibile completare il caricamento.', {
      category: 'AssetLoad', errorId: '12345678-1234-1234-1234-123456789abc', requestId: 'request-1:01',
      context: { operation: 'load', status: '500', stack: 'RAW_STACK', resource: 'https://host/?token=secret' },
    });
    expect(toAppError(error)).toBe(error);
    expect(error.message).toBe(error.publicMessage);
    expect(error.context).toEqual({ operation: 'load', status: '500', resource: '[REDACTED]' });
    expect(error.errorId).toBe('12345678-1234-1234-1234-123456789abc');
    expect(error.requestId).toBe('request-1:01');
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.context)).toBe(true);
  });

  it.each([
    new Error('RAW_STACK https://private/?token=secret'),
    'RAW_REJECTION', null, undefined,
    { publicMessage: 'RAW_PUBLIC_MESSAGE', message: 'RAW_MESSAGE', errorId: 'bad' },
  ])('non considera affidabili errori o oggetti sconosciuti: %s', (value) => {
    const error = toAppError(value);
    expect(error.publicMessage).toBe(GENERIC_PUBLIC_MESSAGE);
    expect(JSON.stringify(error)).not.toMatch(/RAW_|private|secret/);
  });

  it('contiene anche proxy ostili', () => {
    const value = new Proxy({}, { getPrototypeOf: () => { throw new Error('RAW_PROXY'); } });
    expect(toAppError(value).publicMessage).toBe(GENERIC_PUBLIC_MESSAGE);
  });

  it('non legge getter sconosciuti e riporta solo la classe nota', () => {
    const error = new TypeError();
    Object.defineProperty(error, 'message', { get: () => { throw new Error('Non leggere'); } });
    expect(toAppError(error, 'Operazione non riuscita.').context).toEqual({ errorClass: 'TypeError' });
    expect(new AppError('Errore', { errorId: 'not-a-guid', requestId: 'https://secret' })).toMatchObject({
      errorId: undefined, requestId: undefined,
    });
  });

  it('mantiene il messaggio dettagliato noto della configurazione', () => {
    try {
      parsePhysicsConfig({ wallPenetrationToleranceMm: 11 });
      expect.fail('La configurazione deve essere rifiutata');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(toAppError(error).publicMessage).toContain('numero tra 1 e 10 mm');
    }
  });
});
