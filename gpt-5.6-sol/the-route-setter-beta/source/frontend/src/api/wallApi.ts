/** Scarica il modello GLB della parete senza interpretarlo nel livello API. */
export async function fetchWallModel(signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch('/api/wall', { signal });
  if (!response.ok) {
    throw new Error(`Caricamento parete non riuscito (${response.status}).`);
  }

  return response.arrayBuffer();
}
