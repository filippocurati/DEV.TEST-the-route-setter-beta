import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Material,
  MathUtils,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  Vector2,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { fetchHoldCollider, type HoldManifest } from '../api/holdApi';
import { generateGuideImage, type CameraSnapshot, type GuideImageResult } from '../export/guideImage';
import { loadHoldModel, type HoldModelResource } from '../holds/holdResources';
import {
  ROTATION_STEP_RADIANS,
  TRANSLATION_STEP_METERS,
  type HoldCommand,
} from '../input/holdCommands';
import { PhysicsWorld } from '../physics/physicsWorld';
import type { KinematicPhysicsObject } from '../physics/physicsWorld';
import {
  findMaximumValidFraction,
  walkSurface,
  type SurfaceSupport,
} from '../physics/surfaceMovement';
import { GEOMETRY_CONFIG } from '../physics/geometryConfig';
import {
  addTwistAroundNormal,
  DETACH_DISTANCE_METERS,
  isWithinSnapDistance,
  orientationFromNormal,
  projectAxisOnTangent,
  resolveContactNormal,
  SNAP_DISTANCE_METERS,
} from '../physics/snapMath';
import { loadWall } from './wallLoader';
import {
  createSpawnCandidateOffsets,
  findFirstAvailableSpawn,
  SPAWN_GRID_MARGIN_METERS,
  SPAWN_GRID_STEP_METERS,
} from './spawnCandidates';
import { buildWallTopology } from './wallTopology';

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
  readonly selectedHoldId: string | null;
  readonly selectedHoldPosition: readonly number[] | null;
  readonly selectedHoldRotation: readonly number[] | null;
  readonly selectedHoldBodyValid: boolean;
  readonly holdScreenPositions: Readonly<Record<string, readonly number[]>>;
  readonly rigidBodyCount: number;
  readonly colliderCount: number;
  readonly holdStates: Readonly<Record<string, {
    readonly attachment: 'pre-snap' | 'post-snap';
    readonly distanceFromWallCenter: number;
    readonly localNormal: readonly number[];
    readonly intersectsAtSpawn: boolean;
    readonly spawnOffset: readonly number[];
    readonly spawnCandidateIndex: number;
    readonly contactPoint: readonly number[] | null;
    readonly supportFeatureId: number | null;
    readonly lastSurfaceStopReason: string | null;
    readonly surfaceTransitions: number;
    readonly twistRadians: number;
  }>>;
  readonly wallFrontReference: readonly number[];
  readonly lastExportCamera: CameraSnapshot | null;
  readonly lastExportDimensions: readonly number[] | null;
  readonly cameraQuaternion: readonly number[];
  readonly cameraFov: number;
  readonly cameraZoom: number;
  readonly cameraNear: number;
  readonly cameraFar: number;
  readonly cameraAspect: number;
}

/** Controlli pubblici della scena usati dal catalogo senza esporre Three.js o Rapier alla UI. */
export interface WallSceneController {
  addHold(hold: HoldManifest): Promise<void>;
  removeHold(id: string): boolean;
  hasHold(id: string): boolean;
  selectedHoldId(): string | null;
  executeCommand(command: HoldCommand): boolean;
  onSelectionChange(listener: (id: string | null) => void): () => void;
  generateGuideImage(): Promise<GuideImageResult>;
}

interface HoldSceneInstance {
  readonly id: string;
  readonly model: HoldModelResource;
  readonly object: Group;
  readonly physics: KinematicPhysicsObject;
  readonly unbind: () => void;
  readonly originalMaterials: ReadonlyMap<Mesh, Material | Material[]>;
  readonly highlightedMaterials: Map<Mesh, Material | Material[]>;
  attachment: 'pre-snap' | 'post-snap';
  localNormal: Vector3;
  readonly initialRotation: Quaternion;
  readonly intersectsAtSpawn: boolean;
  readonly pickPointLocal: Vector3;
  readonly spawnOffset: Vector2;
  readonly spawnCandidateIndex: number;
  contactPoint: Vector3 | null;
  lastValidNormal: Vector3 | null;
  twistRadians: number;
  readonly surfaceAcquisitionDistance: number;
  readonly collisionRadius: number;
  supportFeatureId: number | null;
  lastSurfaceStopReason: string | null;
  surfaceTransitions: number;
}

interface WallSurfaceContact {
  readonly point: Vector3;
  readonly normal: Vector3;
  readonly distance: number;
  readonly featureId: number;
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
  const frontReference = findFrontReference(wall.object, wall.center, wall.bounds);
  const wallTopology = buildWallTopology(wall.triMesh);
  status.textContent = 'Inizializzazione fisica...';
  const physics = await PhysicsWorld.create(wall.triMesh);
  const holdInstances = new Map<string, HoldSceneInstance>();
  const selectionListeners = new Set<(id: string | null) => void>();
  const raycaster = new Raycaster();
  let selectedHoldId: string | null = null;
  let lastExportCamera: CameraSnapshot | null = null;
  let lastExportDimensions: readonly number[] | null = null;
  frameWall(camera, controls, wall.bounds, wall.center, wall.size);
  status.textContent = 'Parete pronta';
  status.dataset.state = 'ready';

  const updateDebugState = (): void => {
    window.__ROUTE_SETTER_SCENE__ = {
      wallLoaded: true,
      triMeshVertexCount: wall.triMesh.vertices.length / 3,
      triMeshIndexCount: wall.triMesh.indices.length,
      cameraPosition: camera.position.toArray(),
      cameraQuaternion: camera.quaternion.toArray(),
      cameraFov: camera.fov,
      cameraZoom: camera.zoom,
      cameraNear: camera.near,
      cameraFar: camera.far,
      cameraAspect: camera.aspect,
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
      selectedHoldId,
      selectedHoldPosition: selectedHoldId
        ? holdInstances.get(selectedHoldId)?.object.position.toArray() ?? null
        : null,
      selectedHoldRotation: selectedHoldId
        ? holdInstances.get(selectedHoldId)?.object.quaternion.toArray() ?? null
        : null,
      selectedHoldBodyValid: selectedHoldId
        ? holdInstances.get(selectedHoldId)?.physics.body.isValid() ?? false
        : false,
      holdScreenPositions: Object.fromEntries(
        [...holdInstances].map(([id, instance]) => [id, projectCachedPickPoint(instance, camera)]),
      ),
      rigidBodyCount: physics.world.bodies.len(),
      colliderCount: physics.world.colliders.len(),
      holdStates: Object.fromEntries(
        [...holdInstances].map(([id, instance]) => [id, {
          attachment: instance.attachment,
          distanceFromWallCenter: instance.object.position.distanceTo(wall.center),
          localNormal: instance.localNormal.toArray(),
          intersectsAtSpawn: instance.intersectsAtSpawn,
          spawnOffset: instance.spawnOffset.toArray(),
          spawnCandidateIndex: instance.spawnCandidateIndex,
          contactPoint: instance.contactPoint?.toArray() ?? null,
          supportFeatureId: instance.supportFeatureId,
          lastSurfaceStopReason: instance.lastSurfaceStopReason,
          surfaceTransitions: instance.surfaceTransitions,
          twistRadians: instance.twistRadians,
        }]),
      ),
      wallFrontReference: frontReference.toArray(),
      lastExportCamera,
      lastExportDimensions,
    };
  };
  let renderPending = false;
  const render = (): void => {
    updateDebugState();
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderer.render(scene, camera);
      renderPending = false;
    });
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

  renderer.domElement.addEventListener('click', (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    ), camera);
    const hit = raycaster.intersectObjects(
      [...holdInstances.values()].map((instance) => instance.object),
      true,
    )[0];
    const id = hit ? findHoldId(hit.object) : null;
    setSelection(id);
    render();
  });

  /** Aggiorna selezione ed evidenziazione garantendo una sola presa attiva. */
  function setSelection(id: string | null): void {
    if (id === selectedHoldId) {
      return;
    }
    if (selectedHoldId) {
      const previous = holdInstances.get(selectedHoldId);
      if (previous) setHighlighted(previous, false);
    }
    selectedHoldId = id && holdInstances.has(id) ? id : null;
    if (selectedHoldId) {
      const selected = holdInstances.get(selectedHoldId);
      if (selected) setHighlighted(selected, true);
    }
    selectionListeners.forEach((listener) => listener(selectedHoldId));
  }

  /** Applica un passo elementare alla sola presa selezionata. */
  function executeCommand(command: HoldCommand): boolean {
    const selected = selectedHoldId ? holdInstances.get(selectedHoldId) : undefined;
    if (!selected) {
      return false;
    }

    if (command.startsWith('rotate-')) {
      const current = selected.physics.body.rotation();
      const next = addTwistAroundNormal(
        new Quaternion(current.x, current.y, current.z, current.w),
        selected.localNormal,
        command === 'rotate-clockwise' ? -ROTATION_STEP_RADIANS : ROTATION_STEP_RADIANS,
      );
      const position = selected.physics.body.translation();
      const currentRotation = new Quaternion(current.x, current.y, current.z, current.w);
      if (isTransformPathValid(
        selected,
        new Vector3(position.x, position.y, position.z),
        currentRotation,
        new Vector3(position.x, position.y, position.z),
        next,
      )) {
        physics.setKinematicTransform(selected.physics, selected.physics.body.translation(), next);
        selected.twistRadians += command === 'rotate-clockwise' ? -ROTATION_STEP_RADIANS : ROTATION_STEP_RADIANS;
      }
    } else if (command === 'move-forward' || command === 'move-backward') {
      if (selected.attachment === 'post-snap') {
        if (command === 'move-forward') return true;
        detachHold(selected);
      } else {
        movePreSnapNormal(selected, command === 'move-forward' ? -1 : 1);
      }
    } else {
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const tangentRight = projectAxisOnTangent(right, selected.localNormal, new Vector3(1, 0, 0));
      const tangentUp = projectAxisOnTangent(up, selected.localNormal, new Vector3(0, 1, 0));
      const direction = command === 'move-up' ? up
        : command === 'move-down' ? tangentUp.negate()
          : command === 'move-right' ? tangentRight
            : tangentRight.negate();
      if (command === 'move-up') direction.copy(tangentUp);
      direction.multiplyScalar(TRANSLATION_STEP_METERS);
      if (selected.attachment === 'post-snap') movePostSnapTangential(selected, direction);
      else {
        const current = selected.physics.body.translation();
        const includeWall = isWallWithinMovementRange(selected, current, direction);
        const movement = physics.movePreSnapWithCollisions(selected.physics, direction, includeWall);
        physics.setKinematicTransform(selected.physics, {
          x: current.x + movement.x,
          y: current.y + movement.y,
          z: current.z + movement.z,
        }, selected.physics.body.rotation());
        updatePreSnapSurface(selected);
      }
    }
    physics.synchronizeRendering();
    render();
    return true;
  }

  /** Avanza/allontana una hold pre-snap e applica lo snap entrando nella soglia. */
  function movePreSnapNormal(instance: HoldSceneInstance, sign: -1 | 1): void {
    const currentRaw = instance.physics.body.translation();
    const current = new Vector3(currentRaw.x, currentRaw.y, currentRaw.z);
    const surface = findClosestWallSurface(current, instance.lastValidNormal);
    if (surface) updatePreSnapNormal(instance, surface);
    if (sign > 0) {
      const movement = instance.localNormal.clone().multiplyScalar(TRANSLATION_STEP_METERS);
      physics.movePreSnapWithCollisions(
        instance.physics,
        movement,
        isWallWithinMovementRange(instance, currentRaw, movement),
      );
      updatePreSnapSurface(instance);
      return;
    }

    if (surface && isWithinSnapDistance(surface.distance)) {
      snapHold(instance, surface);
      return;
    }
    if (surface && isWithinSnapDistance(Math.max(0, surface.distance - TRANSLATION_STEP_METERS))) {
      snapHold(instance, surface);
      return;
    }
    const desired = instance.localNormal.clone().multiplyScalar(-TRANSLATION_STEP_METERS);
    const movement = physics.movePreSnapWithCollisions(
      instance.physics,
      desired,
      isWallWithinMovementRange(instance, currentRaw, desired),
    );
    if (movement.x === 0 && movement.y === 0 && movement.z === 0) return;
    updatePreSnapSurface(instance, true);
  }

  /** Aggancia pivot e orientamento alla normale del contatto, se la trasformazione è valida. */
  function snapHold(instance: HoldSceneInstance, surface: WallSurfaceContact): void {
    if (!Number.isInteger(surface.featureId) || surface.featureId < 0 || surface.featureId >= wallTopology.triangleCount) return;
    const normal = resolveContactNormal(surface.normal, instance.lastValidNormal, new Vector3(0, 0, 1));
    if (normal.dot(new Vector3().subVectors(instance.physics.body.translation() as Vector3, surface.point)) < 0) normal.negate();
    const rotation = orientationFromNormal(normal, instance.twistRadians);
    const current = instance.physics.body.translation();
    const currentRotation = instance.physics.body.rotation();
    if (!isTransformPathValid(
      instance,
      new Vector3(current.x, current.y, current.z),
      new Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w),
      surface.point,
      rotation,
    )) return;
    physics.setKinematicTransform(instance.physics, surface.point, rotation);
    instance.attachment = 'post-snap';
    instance.localNormal = normal;
    instance.lastValidNormal = normal.clone();
    instance.contactPoint = surface.point.clone();
    instance.supportFeatureId = surface.featureId;
    instance.lastSurfaceStopReason = null;
  }

  /** Segue esclusivamente facce contigue e arresta il residuo alla prima posa non valida. */
  function movePostSnapTangential(instance: HoldSceneInstance, desired: Vector3): void {
    const beforeRaw = instance.physics.body.translation();
    const before = new Vector3(beforeRaw.x, beforeRaw.y, beforeRaw.z);
    if (instance.supportFeatureId === null) return;
    const path = walkSurface(wallTopology, {
      triangleId: instance.supportFeatureId,
      point: instance.contactPoint?.clone() ?? before,
      normal: instance.localNormal.clone(),
    }, desired);

    let applied: SurfaceSupport = {
      triangleId: instance.supportFeatureId,
      point: before,
      normal: instance.localNormal.clone(),
    };
    let currentRotation = new Quaternion(
      instance.physics.body.rotation().x,
      instance.physics.body.rotation().y,
      instance.physics.body.rotation().z,
      instance.physics.body.rotation().w,
    );
    let appliedTransitions = 0;
    let blockedByCollision = false;
    for (let waypointIndex = 0; waypointIndex < path.waypoints.length; waypointIndex += 1) {
      const waypoint = path.waypoints[waypointIndex];
      const targetRotation = orientationFromNormal(waypoint.normal, instance.twistRadians);
      if (waypoint.kind === 'normal-change') {
        const rotationFraction = maximumValidTransformFraction(
          instance,
          applied.point,
          currentRotation,
          applied.point,
          targetRotation,
        );
        if (rotationFraction < 1) {
          // Una rotazione parziale non aderirebbe a nessuna delle due facce: il prefisso valido termina al bordo.
          blockedByCollision = true;
          break;
        }
      }
      if (waypoint.kind === 'translation') {
        const segment = waypoint.point.clone().sub(applied.point);
        const fraction = physics.allowedTranslationFraction(instance.physics, applied.point, currentRotation, segment);
        if (fraction < 1) {
          applied = { ...applied, point: applied.point.clone().addScaledVector(segment, fraction) };
          break;
        }
        if (!isTransformPathValid(
          instance,
          applied.point,
          currentRotation,
          waypoint.point,
          targetRotation,
        )) {
          const maximumFraction = maximumValidTransformFraction(
            instance,
            applied.point,
            currentRotation,
            waypoint.point,
            targetRotation,
          );
          if (maximumFraction > 0) {
            applied = { ...applied, point: applied.point.clone().lerp(waypoint.point, maximumFraction) };
            currentRotation = currentRotation.clone().slerp(targetRotation, maximumFraction);
          }
          blockedByCollision = true;
          break;
        }
      }
      applied = { triangleId: waypoint.triangleId, point: waypoint.point.clone(), normal: waypoint.normal.clone() };
      currentRotation = targetRotation;
      if (waypoint.kind === 'normal-change') appliedTransitions += 1;
    }

    physics.setKinematicTransform(instance.physics, applied.point, currentRotation);
    instance.localNormal = applied.normal.clone();
    instance.lastValidNormal = applied.normal.clone();
    instance.contactPoint = applied.point.clone();
    instance.supportFeatureId = applied.triangleId;
    instance.lastSurfaceStopReason = blockedByCollision ? 'collision' : path.completed ? null : path.stopReason;
    instance.surfaceTransitions += appliedTransitions;
  }



  /** Valida traslazione e rotazione combinate campionando il primo percorso continuo. */
  function isTransformPathValid(
    instance: HoldSceneInstance,
    fromPosition: Vector3,
    fromRotation: Quaternion,
    toPosition: Vector3,
    toRotation: Quaternion,
  ): boolean {
    const angularSteps = Math.ceil(fromRotation.angleTo(toRotation)
      / GEOMETRY_CONFIG.maximumRotationSubstepRadians);
    const linearSteps = Math.ceil(fromPosition.distanceTo(toPosition)
      / GEOMETRY_CONFIG.maximumTranslationSubstepMeters);
    const steps = Math.max(1, angularSteps, linearSteps);
    for (let step = 1; step <= steps; step += 1) {
      const fraction = step / steps;
      const position = fromPosition.clone().lerp(toPosition, fraction);
      const rotation = fromRotation.clone().slerp(toRotation, fraction);
      if (!physics.canPlaceWithoutPenetration(instance.physics, position, rotation)) return false;
    }
    return true;
  }

  /** Trova la massima frazione valida della trasformazione combinata. */
  function maximumValidTransformFraction(
    instance: HoldSceneInstance,
    fromPosition: Vector3,
    fromRotation: Quaternion,
    toPosition: Vector3,
    toRotation: Quaternion,
  ): number {
    return findMaximumValidFraction((fraction) =>
      physics.canPlaceWithoutPenetration(
        instance.physics,
        fromPosition.clone().lerp(toPosition, fraction),
        fromRotation.clone().slerp(toRotation, fraction),
      ));
  }

  /** Sgancia a 25 cm lungo la normale e ripristina l'orientamento iniziale completo. */
  function detachHold(instance: HoldSceneInstance): void {
    const contactPoint = instance.contactPoint;
    if (!contactPoint) return;
    const target = contactPoint.clone().addScaledVector(instance.localNormal, DETACH_DISTANCE_METERS);
    const currentRotation = instance.physics.body.rotation();
    if (!isTransformPathValid(
      instance,
      contactPoint,
      new Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w),
      target,
      instance.initialRotation,
    )) return;
    physics.setKinematicTransform(instance.physics, target, instance.initialRotation);
    instance.attachment = 'pre-snap';
    instance.contactPoint = null;
    instance.supportFeatureId = null;
    instance.lastSurfaceStopReason = null;
  }

  /** Trova punto e normale locali senza assumere che la parete sia ortogonale a Z. */
  function findClosestWallSurface(position: Vector3, lastNormal: Vector3 | null): WallSurfaceContact | null {
    const projection = physics.projectPointToWall(position);
    if (!projection) return null;
    const point = new Vector3(projection.point.x, projection.point.y, projection.point.z);
    const triangleNormal = projection.featureType === RAPIER.FeatureType.Face
      ? wallTriangleNormal(wall.triMesh, projection.featureId)
      : null;
    const normal = resolveContactNormal(triangleNormal, lastNormal, new Vector3(0, 0, 1));
    if (normal.dot(new Vector3().subVectors(position, point)) < 0) normal.negate();
    return { point, normal, distance: projection.distance, featureId: projection.featureId };
  }

  /** Acquisisce il pannello locale, pre-allinea la hold e completa lo snap entro 5 cm. */
  function updatePreSnapSurface(instance: HoldSceneInstance, allowSnap = false): void {
    const raw = instance.physics.body.translation();
    const surface = findClosestWallSurface(new Vector3(raw.x, raw.y, raw.z), instance.lastValidNormal);
    if (!surface) return;
    updatePreSnapNormal(instance, surface);
    if (allowSnap && isWithinSnapDistance(surface.distance)) {
      snapHold(instance, surface);
    }
  }

  /** Aggiorna la normale candidata e orienta la base prima che il volume tocchi la parete. */
  function updatePreSnapNormal(instance: HoldSceneInstance, surface: WallSurfaceContact): void {
    if (surface.distance > instance.surfaceAcquisitionDistance) return;
    if (instance.localNormal.angleTo(surface.normal) < GEOMETRY_CONFIG.normalChangeRadians) return;
    const rotation = orientationFromNormal(surface.normal, instance.twistRadians);
    if (!physics.canPlaceWithoutPenetration(instance.physics, instance.physics.body.translation(), rotation)) return;
    physics.setKinematicTransform(instance.physics, instance.physics.body.translation(), rotation);
    instance.localNormal = surface.normal.clone();
    instance.lastValidNormal = surface.normal.clone();
  }

  /** Evita shape-cast costosi finché il volume della hold non può raggiungere il TriMesh. */
  function isWallWithinMovementRange(
    instance: HoldSceneInstance,
    current: { readonly x: number; readonly y: number; readonly z: number },
    movement: Vector3,
  ): boolean {
    const candidate = new Vector3(current.x, current.y, current.z).add(movement);
    const surface = findClosestWallSurface(candidate, instance.lastValidNormal);
    return surface !== null
      && surface.distance <= instance.collisionRadius + movement.length() + GEOMETRY_CONFIG.collisionMarginMeters;
  }

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
        object.traverse((child) => { child.userData.holdModelId = hold.id; });
        const holdSize = new Box3().setFromObject(object).getSize(new Vector3());
        const holdBounds = new Box3().setFromObject(object);
        const collisionRadius = Math.max(
          holdBounds.min.length(),
          holdBounds.max.length(),
          ...boxCorners(holdBounds).map((corner) => corner.length()),
        );
        const localNormal = new Vector3(0, 0, 1);
        const centralSpawn = frontReference.clone().add(localNormal.clone().multiplyScalar(2));
        const physicsObject = physics.createKinematicObject(
          collider,
          centralSpawn,
          new Quaternion(),
        );
        const candidates = createSpawnCandidateOffsets({
          halfWidth: wall.size.x / 2,
          halfHeight: wall.size.y / 2,
          step: SPAWN_GRID_STEP_METERS,
          margin: SPAWN_GRID_MARGIN_METERS,
        });
        let insertionPosition: Vector3 | undefined;
        const spawnResult = findFirstAvailableSpawn(candidates, (candidateOffset) => {
          const candidate = centralSpawn.clone().add(new Vector3(candidateOffset.x, candidateOffset.y, 0));
          physics.setKinematicTransform(physicsObject, candidate, physicsObject.body.rotation());
          if (!physics.hasIntersections(physicsObject)) {
            insertionPosition = candidate;
            return true;
          }
          return false;
        });
        if (!insertionPosition || !spawnResult) {
          physics.removeKinematicObject(physicsObject);
          throw new Error('Nessuna posizione iniziale libera disponibile.');
        }
        object.position.copy(insertionPosition);
        object.updateMatrix();
        scene.add(object);
        const unbind = physics.bindRenderingObject(physicsObject.body, object);
        const intersectsAtSpawn = false;
        const pickPointWorld = findPickPointWorld(object, camera);
        const pickPointLocal = object.worldToLocal(pickPointWorld.clone());
        holdInstances.set(hold.id, {
          id: hold.id,
          model,
          object,
          physics: physicsObject,
          unbind,
          originalMaterials: captureMaterials(object),
          highlightedMaterials: new Map(),
          attachment: 'pre-snap',
          localNormal,
          initialRotation: object.quaternion.clone(),
          intersectsAtSpawn,
          pickPointLocal,
          spawnOffset: spawnResult.candidate,
          spawnCandidateIndex: spawnResult.index,
          contactPoint: null,
          lastValidNormal: localNormal.clone(),
          twistRadians: 0,
          surfaceAcquisitionDistance: Math.max(holdSize.x, holdSize.y, holdSize.z) + SNAP_DISTANCE_METERS,
          collisionRadius,
          supportFeatureId: null,
          lastSurfaceStopReason: null,
          surfaceTransitions: 0,
        });
        setSelection(hold.id);
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
      if (selectedHoldId === id) setSelection(null);
      instance.unbind();
      physics.removeKinematicObject(instance.physics);
      instance.object.removeFromParent();
      instance.model.dispose();
      holdInstances.delete(id);
      render();
      return true;
    },
    hasHold: (id) => holdInstances.has(id),
    selectedHoldId: () => selectedHoldId,
    executeCommand,
    onSelectionChange: (listener) => {
      selectionListeners.add(listener);
      listener(selectedHoldId);
      return () => selectionListeners.delete(listener);
    },
    generateGuideImage: async () => {
      const selected = selectedHoldId ? holdInstances.get(selectedHoldId) : undefined;
      if (selected) setHighlighted(selected, false);
      try {
        const result = await generateGuideImage(
          scene,
          camera,
          renderer,
          Math.max(container.clientWidth, 1),
          Math.max(container.clientHeight, 1),
        );
        lastExportCamera = result.camera;
        lastExportDimensions = [result.width, result.height];
        return result;
      } finally {
        if (selected) setHighlighted(selected, true);
        render();
      }
    },
  };
}

/** Determina il punto frontale proiettando il centro geometrico verso la superficie lungo -Z. */
function findFrontReference(root: Group, center: Vector3, bounds: Box3): Vector3 {
  const depth = Math.max(bounds.max.z - bounds.min.z, 1);
  const raycaster = new Raycaster(
    new Vector3(center.x, center.y, bounds.max.z + depth),
    new Vector3(0, 0, -1),
  );
  const intersections = raycaster.intersectObject(root, true)
    .filter((intersection) => Number.isFinite(intersection.point.z))
    .sort((left, right) => right.point.z - left.point.z);
  if (intersections.length === 0) {
    throw new Error('Punto frontale della parete non determinabile.');
  }
  return intersections[0].point.clone();
}

/** Restituisce la normale geometrica world-space del triangolo Rapier indicato. */
function wallTriangleNormal(triMesh: { readonly vertices: Float32Array; readonly indices: Uint32Array }, featureId: number): Vector3 | null {
  const firstIndex = featureId * 3;
  if (!Number.isInteger(featureId) || featureId < 0 || firstIndex + 2 >= triMesh.indices.length) return null;
  const aOffset = triMesh.indices[firstIndex] * 3;
  const bOffset = triMesh.indices[firstIndex + 1] * 3;
  const cOffset = triMesh.indices[firstIndex + 2] * 3;
  const a = new Vector3(triMesh.vertices[aOffset], triMesh.vertices[aOffset + 1], triMesh.vertices[aOffset + 2]);
  const b = new Vector3(triMesh.vertices[bOffset], triMesh.vertices[bOffset + 1], triMesh.vertices[bOffset + 2]);
  const c = new Vector3(triMesh.vertices[cOffset], triMesh.vertices[cOffset + 1], triMesh.vertices[cOffset + 2]);
  const normal = b.sub(a).cross(c.sub(a));
  return normal.lengthSq() > GEOMETRY_CONFIG.normalEpsilon ? normal.normalize() : null;
}

/** Elenca gli otto vertici dell'AABB locale per ricavarne una sfera conservativa. */
function boxCorners(bounds: Box3): Vector3[] {
  return [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) => new Vector3(x, y, z))));
}

/** Risale dalla mesh colpita fino alla radice istanza annotata. */
function findHoldId(object: Object3D): string | null {
  let current: Object3D | null = object;
  while (current) {
    if (typeof current.userData.holdModelId === 'string') {
      return current.userData.holdModelId;
    }
    current = current.parent;
  }
  return null;
}

/** Individua una volta il baricentro di un triangolo reale front-facing. */
function findPickPointWorld(root: Group, camera: PerspectiveCamera): Vector3 {
  let point: Vector3 | undefined;
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (point || !(object instanceof Mesh)) return;
    const position = object.geometry.getAttribute('position');
    if (!position || position.count < 3) return;
    const index = object.geometry.index;
    const triangleCount = Math.floor((index?.count ?? position.count) / 3);
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const aIndex = index?.getX(triangle * 3) ?? triangle * 3;
      const bIndex = index?.getX(triangle * 3 + 1) ?? triangle * 3 + 1;
      const cIndex = index?.getX(triangle * 3 + 2) ?? triangle * 3 + 2;
      const a = new Vector3().fromBufferAttribute(position, aIndex).applyMatrix4(object.matrixWorld);
      const b = new Vector3().fromBufferAttribute(position, bIndex).applyMatrix4(object.matrixWorld);
      const c = new Vector3().fromBufferAttribute(position, cIndex).applyMatrix4(object.matrixWorld);
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
      const center = a.add(b).add(c).multiplyScalar(1 / 3);
      const projected = center.clone().project(camera);
      if (normal.dot(new Vector3().subVectors(camera.position, center)) > 0
        && Math.abs(projected.x) < 0.95
        && Math.abs(projected.y) < 0.95
        && Math.abs(projected.z) <= 1) {
        point = center;
        break;
      }
    }
  });
  return point ?? new Box3().setFromObject(root).getCenter(new Vector3());
}

/** Proietta il punto di picking memorizzato senza scandire nuovamente la geometria. */
function projectCachedPickPoint(instance: HoldSceneInstance, camera: PerspectiveCamera): readonly number[] {
  instance.object.updateWorldMatrix(true, false);
  const projected = instance.pickPointLocal.clone().applyMatrix4(instance.object.matrixWorld).project(camera);
  return [projected.x, projected.y];
}

/** Conserva i materiali originali delle mesh per ripristinare l'aspetto dopo la selezione. */
function captureMaterials(root: Group): ReadonlyMap<Mesh, Material | Material[]> {
  const materials = new Map<Mesh, Material | Material[]>();
  root.traverse((object) => {
    if (object instanceof Mesh) {
      materials.set(object, object.material as Material | Material[]);
    }
  });
  return materials;
}

/** Evidenzia la presa clonando temporaneamente i materiali senza modificare il modello catalogo. */
function setHighlighted(instance: HoldSceneInstance, highlighted: boolean): void {
  for (const [mesh, original] of instance.originalMaterials) {
    if (!highlighted) {
      const highlightedMaterial = instance.highlightedMaterials.get(mesh);
      const highlightedList = Array.isArray(highlightedMaterial) ? highlightedMaterial : [highlightedMaterial];
      highlightedList.forEach((material) => material?.dispose());
      instance.highlightedMaterials.delete(mesh);
      mesh.material = original;
      continue;
    }

    const source = Array.isArray(original) ? original : [original];
    const selected = source.map((material) => {
      const clone = material.clone();
      if ('emissive' in clone && clone.emissive instanceof Color) {
        clone.emissive.setHex(0xe6a25c);
        if ('emissiveIntensity' in clone) clone.emissiveIntensity = 0.45;
      }
      return clone;
    });
    const selectionMaterial = Array.isArray(original) ? selected : selected[0];
    instance.highlightedMaterials.set(mesh, selectionMaterial);
    mesh.material = selectionMaterial;
  }
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
