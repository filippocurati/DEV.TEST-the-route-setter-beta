export interface HoldManifest {
  id: string;
  previewUrl: string | null;
  modelUrl: string;
  colliderUrl: string | null;
  colliderReady: boolean;
}

type RawHoldManifest = {
  id?: string;
  Id?: string;
  previewUrl?: string | null;
  PreviewUrl?: string | null;
  modelUrl?: string;
  ModelUrl?: string;
  colliderUrl?: string | null;
  ColliderUrl?: string | null;
  colliderReady?: boolean;
  ColliderReady?: boolean;
};

type AssetFileUrlResponse = {
  url?: string;
  Url?: string;
}

export async function fetchHolds(apiBaseUrl: string): Promise<HoldManifest[]> {
  const response = await fetch(`${apiBaseUrl}/api/holds`);
  if (!response.ok) {
    throw new Error(`Impossibile caricare il catalogo hold. Status: ${response.status}`);
  }

  const payload = await parseUnknownJsonPayload(response);
  if (!Array.isArray(payload)) {
    throw new Error('Manifest hold non valido: payload non array.');
  }

  return payload.map((entry) => {
    const raw = entry as RawHoldManifest;
    const id = raw.id ?? raw.Id;
    const modelUrl = raw.modelUrl ?? raw.ModelUrl;

    if (!id || !modelUrl) {
      throw new Error('Manifest hold non valido: campi obbligatori mancanti.');
    }

    return {
      id,
      previewUrl: raw.previewUrl ?? raw.PreviewUrl ?? null,
      modelUrl,
      colliderUrl: raw.colliderUrl ?? raw.ColliderUrl ?? null,
      colliderReady: raw.colliderReady ?? raw.ColliderReady ?? false
    } satisfies HoldManifest;
  });
}

export async function fetchHoldModelUrl(apiBaseUrl: string, holdId: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/api/holds/${encodeURIComponent(holdId)}/model`);
  if (!response.ok) {
    throw new Error(`Impossibile caricare URL modello per ${holdId}. Status: ${response.status}`);
  }

  const payload = await parseUnknownJsonPayload(response);
  const resolvedUrl = resolveModelUrl(payload);
  if (!resolvedUrl) {
    throw new Error(`Risposta /api/holds/${holdId}/model non valida: url mancante.`);
  }

  return resolvedUrl;
}

function resolveModelUrl(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  if (typeof payload === 'object' && payload !== null) {
    const candidate = payload as AssetFileUrlResponse;
    return candidate.url ?? candidate.Url ?? null;
  }

  return null;
}

async function parseUnknownJsonPayload(response: Response): Promise<unknown> {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}
