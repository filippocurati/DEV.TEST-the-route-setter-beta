import { fetchBytes } from './http';

/** Scarica il modello GLB della parete senza interpretarlo nel livello API. */
export async function fetchWallModel(signal?: AbortSignal): Promise<ArrayBuffer> {
  return fetchBytes('/api/wall', 'Impossibile caricare il modello della parete.', { signal });
}
