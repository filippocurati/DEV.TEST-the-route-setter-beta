import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  MathUtils,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { fetchHoldCollider, type HoldManifest } from '../api/holdApi';
import { loadHoldModel, type HoldModelResource } from '../holds/holdResources';
import { PhysicsWorld } from '../physics/physicsWorld';
import type { KinematicPhysicsObject } from '../physics/physicsWorld';
import { loadWall } from './wallLoader';

/** Riferimenti della scena esposti esclusivamente per diagnostica e test E2E. */
export interface WallSceneDebug {
  readonly wallLoaded: boolean;
  readonly triMeshVertexCount: number;
  readonly triMeshIndexCount: number;
  readonly cameraPosition: readonly number[];
  readonly controlsTarget: readonly number[];
  readonly wallCenter: readonly number[];
  readonly wallMaxDimension: number;
  readonly physicsReady: boolean;
  readonly gravity: readonly number[];
  readonly wallBodyFixed: boolean;
  readonly wallColliderReady: boolean;
  readonly characterControllerReady: boolean;
  readonly characterAutostepEnabled: boolean;
  readonly characterSnapToGroundEnabled: boolean;
  readonly holdInstanceIds: readonly string[];
}

/** Controlli pubblici della scena usati dal catalogo senza esporre Three.js o Rapier alla UI. */
export interface WallSceneController {
  addHold(hold: HoldManifest): Promise<void>;
  removeHold(id: string): boolean;
  hasHold(id: string): boolean;
  activeHoldId(): string | null;
}

interface HoldSceneInstance {
  readonly id: string;
  readonly model: HoldModelResource;
  readonly object: Group;
  readonly physics: KinematicPhysicsObject;
  readonly unbind: () => void;
}

declare global {
  interface Window {
    __ROUTE_SETTER_SCENE__?: WallSceneDebug;
  }
}

/** Crea la scena, carica automaticamente la parete e avvia il rendering interattivo. */
export async function createWallScene(
  container: HTMLElement,
  status: HTMLElement,
): Promise<WallSceneController> {
  const scene = new Scene();
  scene.background = new Color(0x101713);

  const camera = new PerspectiveCamera(42, 1, 0.01, 100_000);
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.tabIndex = 0;
  renderer.domElement.dataset.sceneCanvas = 'true';
  container.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.screenSpacePanning = true;

  scene.add(new AmbientLight(0xffffff, 1.4));
  const keyLight = new DirectionalLight(0xfff3df, 3.2);
  keyLight.position.set(1, 2, 4);
  scene.add(keyLight);
  const fillLight = new DirectionalLight(0xb9d8ff, 1.6);
  fillLight.position.set(-3, 1, -2);
  scene.add(fillLight);

  const wall = await loadWall();
  scene.add(wall.object);
  status.textContent = 'Inizializzazione fisica...';
  const physics = await PhysicsWorld.create(wall.triMesh);
  const holdInstances = new Map<string, HoldSceneInstance>();
  let activeHoldId: string | null = null;
  frameWall(camera, controls, wall.bounds, wall.center, wall.size);
  status.textContent = 'Parete pronta';
  status.dataset.state = 'ready';

  const updateDebugState = (): void => {
    window.__ROUTE_SETTER_SCENE__ = {
      wallLoaded: true,
      triMeshVertexCount: wall.triMesh.vertices.length / 3,
      triMeshIndexCount: wall.triMesh.indices.length,
      cameraPosition: camera.position.toArray(),
      controlsTarget: controls.target.toArray(),
      wallCenter: wall.center.toArray(),
      wallMaxDimension: Math.max(wall.size.x, wall.size.y, wall.size.z),
      physicsReady: true,
      gravity: [physics.world.gravity.x, physics.world.gravity.y, physics.world.gravity.z],
      wallBodyFixed: physics.wallBody.isFixed(),
      wallColliderReady: physics.wallCollider.isValid(),
      characterControllerReady: true,
      characterAutostepEnabled: physics.characterController.autostepEnabled(),
      characterSnapToGroundEnabled: physics.characterController.snapToGroundEnabled(),
      holdInstanceIds: [...holdInstances.keys()],
    };
  };
  const render = (): void => {
    updateDebugState();
    renderer.render(scene, camera);
  };
  controls.addEventListener('change', render);
  updateDebugState();

  const resize = (): void => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  return {
    addHold: async (hold) => {
      if (holdInstances.has(hold.id)) {
        throw new Error('La presa e gia presente nella scena.');
      }
      if (!hold.colliderUrl || hold.colliderStatus !== 'Ready') {
        throw new Error('Il collider della presa non e ancora disponibile.');
      }

      const model = await loadHoldModel(hold);
      let stagedObject: Group | undefined;
      try {
        const colliderDocument = await fetchHoldCollider(hold.colliderUrl);
        const collider = RAPIER.ColliderDesc.convexMesh(
          new Float32Array(colliderDocument.vertices),
          new Uint32Array(colliderDocument.indices),
        );
        if (!collider) {
          throw new Error('Il collider della presa non e valido.');
        }

        const object = model.createInstance();
        stagedObject = object;
        const insertionPosition = wall.center.clone().add(new Vector3(0, 0, Math.max(wall.size.z, 1) * 0.75));
        object.position.copy(insertionPosition);
        object.updateMatrix();
        scene.add(object);
        const physicsObject = physics.createKinematicObject(
          collider,
          insertionPosition,
          new Quaternion(),
        );
        const unbind = physics.bindRenderingObject(physicsObject.body, object);
        holdInstances.set(hold.id, { id: hold.id, model, object, physics: physicsObject, unbind });
        activeHoldId = hold.id;
        physics.step();
        render();
      } catch (error) {
        stagedObject?.removeFromParent();
        model.dispose();
        throw error;
      }
    },
    removeHold: (id) => {
      const instance = holdInstances.get(id);
      if (!instance) {
        return false;
      }
      instance.unbind();
      physics.removeKinematicObject(instance.physics);
      instance.object.removeFromParent();
      instance.model.dispose();
      holdInstances.delete(id);
      if (activeHoldId === id) {
        activeHoldId = [...holdInstances.keys()].at(-1) ?? null;
      }
      render();
      return true;
    },
    hasHold: (id) => holdInstances.has(id),
    activeHoldId: () => activeHoldId,
  };
}

/** Posiziona camera e target in funzione del bounding box reale della parete. */
function frameWall(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bounds: Box3,
  center: Vector3,
  size: Vector3,
): void {
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const halfFieldOfView = MathUtils.degToRad(camera.fov / 2);
  const distance = (maxDimension / 2) / Math.tan(halfFieldOfView) * 1.35;
  camera.position.copy(center).add(new Vector3(0, maxDimension * 0.08, distance));
  camera.near = Math.max(distance / 10_000, 0.001);
  camera.far = Math.max(distance * 100, bounds.max.length() * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(center);

  controls.target.copy(center);
  controls.minDistance = Math.max(maxDimension * 0.05, 0.01);
  controls.maxDistance = maxDimension * 20;
  controls.update();
}
