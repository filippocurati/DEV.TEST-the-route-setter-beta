import { AppError, toAppError, validErrorId, validRequestId } from '../errors/AppError';

/** Conserva solo la correlazione validata; la forma JSON non rende affidabile il testo remoto. */
async function checkedResponse(url: string, safeMessage: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw toAppError(error, safeMessage, { category: 'Network' });
  }
  if (response.ok) return response;

  let errorId: string | undefined;
  let requestId = validRequestId(response.headers.get('X-Request-Id'));
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && !Array.isArray(body)
      && 'message' in body && typeof body.message === 'string'
      && 'requestId' in body && validRequestId(body.requestId)) {
      requestId = validRequestId(body.requestId);
      if ('errorId' in body) errorId = validErrorId(body.errorId);
    }
  } catch {
    // HTML, risposte vuote e JSON malformato non diventano messaggi pubblici.
  }
  throw new AppError(safeMessage, {
    category: 'Http', errorId, requestId, context: { status: String(response.status) },
  });
}

/** Il chiamante valida lo schema del documento; questo livello gestisce trasporto e parsing JSON. */
export async function fetchJson<T = unknown>(url: string, safeMessage: string, init?: RequestInit): Promise<T> {
  const response = await checkedResponse(url, safeMessage, init);
  try {
    return await response.json() as T;
  } catch (error) {
    throw toAppError(error, safeMessage, {
      category: 'Parsing', requestId: validRequestId(response.headers.get('X-Request-Id')),
    });
  }
}

/** Legge il corpo binario e traduce i guasti di trasporto in errori pubblici correlati. */
export async function fetchBytes(url: string, safeMessage: string, init?: RequestInit): Promise<ArrayBuffer> {
  const response = await checkedResponse(url, safeMessage, init);
  try {
    return await response.arrayBuffer();
  } catch (error) {
    throw toAppError(error, safeMessage, {
      category: 'Network', requestId: validRequestId(response.headers.get('X-Request-Id')),
    });
  }
}

/** Mantiene il MIME originale delle anteprime, comprese immagini SVG. */
export async function fetchBlob(url: string, safeMessage: string, init?: RequestInit): Promise<Blob> {
  const response = await checkedResponse(url, safeMessage, init);
  try {
    return await response.blob();
  } catch (error) {
    throw toAppError(error, safeMessage, { category: 'Network', requestId: validRequestId(response.headers.get('X-Request-Id')) });
  }
}
