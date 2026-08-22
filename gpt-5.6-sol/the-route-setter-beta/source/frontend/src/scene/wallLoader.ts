import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fetchWallModel } from '../api/wallApi';
import { createWallTriMesh, type WallTriMeshData } from './wallTriMesh';

/** Risultato del caricamento della parete, con rendering e geometria fisica separati. */
export interface LoadedWall {
  readonly object: Group;
  readonly bounds: Box3;
  readonly center: Vector3;
  readonly size: Vector3;
  readonly triMesh: WallTriMeshData;
}

/** Carica e interpreta il GLB della parete interamente nel browser. */
export async function loadWall(signal?: AbortSignal): Promise<LoadedWall> {
  const bytes = await fetchWallModel(signal);
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  const object = gltf.scene;
  object.name = 'MainWall';
  object.updateWorldMatrix(true, true);

  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    throw new Error('Il modello della parete non contiene una geometria visibile.');
  }

  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  return { object, bounds, center, size, triMesh: createWallTriMesh(object) };
}
