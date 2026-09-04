import { Box3, Group, Material, Mesh, Object3D, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fetchBinaryAsset, type HoldManifest } from '../api/holdApi';

/** Modello catalogo riutilizzabile, separato dalle trasformazioni delle istanze in scena. */
export interface HoldModelResource {
  readonly definition: HoldManifest;
  readonly template: Group;
  createInstance(): Group;
  dispose(): void;
}

interface CachedModel {
  readonly template: Group;
  references: number;
}

const modelCache = new Map<string, Promise<CachedModel>>();

/** Carica on-demand un GLB e crea la risorsa modello del catalogo. */
export async function loadHoldModel(definition: HoldManifest): Promise<HoldModelResource> {
  let cachedPromise = modelCache.get(definition.modelUrl);
  if (!cachedPromise) {
    cachedPromise = fetchBinaryAsset(definition.modelUrl).then(async (bytes) => {
      const modelUrl = new URL(definition.modelUrl, window.location.href);
      const assetBaseUrl = `${modelUrl.pathname.slice(0, modelUrl.pathname.lastIndexOf('/') + 1)}assets/`;
      const gltf = await new GLTFLoader().parseAsync(bytes, assetBaseUrl);
      return { template: gltf.scene, references: 0 };
    }).catch((error) => {
      modelCache.delete(definition.modelUrl);
      throw error;
    });
    modelCache.set(definition.modelUrl, cachedPromise);
  }
  const cached = await cachedPromise;
  cached.references += 1;
  let disposed = false;

  return {
    definition,
    template: cached.template,
    createInstance: () => {
      const instance = cached.template.clone(true);
      instance.name = `${definition.id}:instance`;
      instance.userData.holdModelId = definition.id;
      return instance;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      cached.references -= 1;
      if (cached.references === 0) {
        modelCache.delete(definition.modelUrl);
        disposeObject3D(cached.template);
      }
    },
  };
}

/** Centra e inquadra un modello all'interno di una scena di dettaglio. */
export function normalizeForPreview(object: Object3D): { center: Vector3; size: Vector3 } {
  object.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(object);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  object.position.sub(center);
  object.updateWorldMatrix(true, true);
  return { center: new Vector3(), size };
}

/** Rilascia geometrie, materiali e texture appartenenti a un modello non più usato. */
export function disposeObject3D(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(disposeMaterial);
  });
  root.removeFromParent();
}

/** Rilascia un materiale e le texture eventualmente referenziate. */
function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) {
      value.dispose();
    }
  }
  material.dispose();
}
