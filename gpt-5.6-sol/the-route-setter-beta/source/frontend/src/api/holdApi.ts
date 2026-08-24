/** Stato del collider comunicato dal manifest backend. */
export type ColliderStatus = 'Missing' | 'Pending' | 'Ready' | 'Failed';

/** Metadati leggeri di una presa, privi del contenuto GLB. */
export interface HoldManifest {
  readonly id: string;
  readonly previewUrl: string | null;
  readonly modelUrl: string;
  readonly colliderUrl: string | null;
  readonly colliderStatus: ColliderStatus;
  readonly optionalAssetUrls: readonly string[];
}

/** Documento Convex Hull generato dal backend e consumato direttamente da Rapier. */
export interface HoldColliderDocument {
  readonly sourceHash: string;
  readonly vertices: readonly number[];
  readonly indices: readonly number[];
}

/** Richiede il solo manifest leggero del catalogo. */
export async function fetchHoldManifest(signal?: AbortSignal): Promise<readonly HoldManifest[]> {
  const response = await fetch('/api/holds', { signal });
  if (!response.ok) {
    throw new Error(`Caricamento catalogo non riuscito (${response.status}).`);
  }

  return response.json() as Promise<readonly HoldManifest[]>;
}

/** Scarica un asset binario verificando lo stato HTTP. */
export async function fetchBinaryAsset(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Caricamento asset non riuscito (${response.status}).`);
  }

  return response.arrayBuffer();
}

/** Scarica il collider pre-calcolato senza eseguire calcoli geometrici nel browser. */
export async function fetchHoldCollider(
  url: string,
  signal?: AbortSignal,
): Promise<HoldColliderDocument> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Caricamento collider non riuscito (${response.status}).`);
  }

  const document = await response.json() as HoldColliderDocument;
  validateColliderDocument(document);
  return document;
}

/** Valida lo schema minimo necessario a ColliderDesc.convexMesh. */
function validateColliderDocument(document: HoldColliderDocument): void {
  if (!document.sourceHash.startsWith('sha256:')) {
    throw new Error('Hash collider non valido.');
  }
  if (document.vertices.length < 12 || document.vertices.length % 3 !== 0) {
    throw new Error('Vertici collider non validi.');
  }
  if (document.indices.length < 12 || document.indices.length % 3 !== 0) {
    throw new Error('Indici collider non validi.');
  }
  const vertexCount = document.vertices.length / 3;
  if (document.indices.some((index) => !Number.isInteger(index) || index < 0 || index >= vertexCount)) {
    throw new Error('Collider con indici fuori intervallo.');
  }
}
