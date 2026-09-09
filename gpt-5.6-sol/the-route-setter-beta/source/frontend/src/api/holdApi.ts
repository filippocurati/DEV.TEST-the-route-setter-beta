import { AppError } from '../errors/AppError';
import { fetchBytes, fetchJson } from './http';

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
  return fetchJson<readonly HoldManifest[]>('/api/holds', 'Impossibile caricare il catalogo delle prese.', { signal });
}

/** Scarica un asset binario verificando lo stato HTTP. */
export async function fetchBinaryAsset(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  return fetchBytes(url, 'Impossibile caricare la risorsa richiesta.', { signal });
}

/** Scarica il collider pre-calcolato senza eseguire calcoli geometrici nel browser. */
export async function fetchHoldCollider(
  url: string,
  signal?: AbortSignal,
): Promise<HoldColliderDocument> {
  const document = await fetchJson(url, 'Impossibile caricare la geometria fisica della presa.', { signal });
  validateColliderDocument(document);
  return document;
}

/** Valida lo schema minimo necessario a ColliderDesc.convexMesh. */
function validateColliderDocument(document: unknown): asserts document is HoldColliderDocument {
  if (!document || typeof document !== 'object' || Array.isArray(document)
    || !('sourceHash' in document) || typeof document.sourceHash !== 'string'
    || !/^sha256:[a-f\d]{64}$/i.test(document.sourceHash)
    || !('vertices' in document) || !Array.isArray(document.vertices)
    || document.vertices.length < 12 || document.vertices.length % 3 !== 0
    || !document.vertices.every(value => typeof value === 'number' && Number.isFinite(value) && Number.isFinite(Math.fround(value)))
    || !('indices' in document) || !Array.isArray(document.indices)
    || document.indices.length < 12 || document.indices.length % 3 !== 0
    || !document.indices.every(index => typeof index === 'number' && Number.isInteger(index)
      && index >= 0 && index <= 0xffffffff && index < (document.vertices as number[]).length / 3)) {
    throw new AppError('La geometria fisica della presa non e valida.', { category: 'Parsing' });
  }
}

/** Stato transitorio aggiornabile senza riscaricare i metadati del catalogo. */
export interface HoldReadiness {
  readonly id: string;
  readonly colliderStatus: ColliderStatus;
  readonly colliderUrl: string | null;
}

/** Richiede e valida soltanto gli stati dei job del catalogo corrente. */
export async function fetchHoldReadiness(signal?: AbortSignal): Promise<readonly HoldReadiness[]> {
  const data = await fetchJson<unknown>('/api/holds/status', 'Impossibile aggiornare la disponibilita delle prese.', { signal, cache: 'no-store' });
  if (!Array.isArray(data) || data.some(row => !row || typeof row !== 'object'
    || typeof row.id !== 'string' || !/^Hold\d+$/.test(row.id)
    || !['Missing', 'Pending', 'Ready', 'Failed'].includes(row.colliderStatus)
    || (row.colliderStatus === 'Ready' ? row.colliderUrl !== `/api/holds/${row.id}/collider` : row.colliderUrl !== null))
    || new Set(data.map(row => row.id)).size !== data.length) {
    throw new AppError('Disponibilita delle prese non valida.', { category: 'Parsing' });
  }
  return data as HoldReadiness[];
}
