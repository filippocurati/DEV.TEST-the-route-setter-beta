export interface WallResponse {
  modelUrl: string;
}

export async function fetchWall(apiBaseUrl: string): Promise<WallResponse> {
  const response = await fetch(`${apiBaseUrl}/api/wall`);
  if (!response.ok) {
    throw new Error(`Impossibile caricare la parete. Status: ${response.status}`);
  }

  const payload = (await response.json()) as WallResponse;
  if (!payload.modelUrl) {
    throw new Error('Risposta /api/wall non valida: modelUrl mancante.');
  }

  return payload;
}
