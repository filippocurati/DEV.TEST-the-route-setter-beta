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
import { fetchHoldCollider, type HoldColliderDocument, type HoldManifest } from '../api/holdApi';
import { generateGuideImage, type CameraSnapshot, type GuideImageResult } from '../export/guideImage';
import { disposeObject3D, loadHoldModel, type HoldModelResource } from '../holds/holdResources';
import { ROTATION_STEP_RADIANS, TRANSLATION_STEP_METERS } from '../input/holdCommands';
import type {
  InteractionMode,
  InteractionSnapshot,
  MoveDirection,
  RotationDirection,
  SceneActionResult,
  ScreenRect,
  TargetPreview,
  ViewportPoint,
} from '../interaction/interactionTypes';
import {
  clampTargetDiameter,
  createTargetAdjacency,
  createTargetSamples,
  selectDominantSurface,
  type SurfaceSampleHit,
} from '../interaction/targetSampling';
import { PhysicsWorld } from '../physics/physicsWorld';
import { HOLD_PENETRATION_TOLERANCE_METERS, type PhysicsConfig } from '../config/physicsConfig';
import type { KinematicPhysicsObject, PoseValidation, PoseDiagnostic, PosePathValidation } from '../physics/physicsWorld';
import {
  addTwistAroundNormal,
  orientationFromNormal,
  projectAxisOnTangent,
  resolveContactNormal,
  transportOrientationToNormal,
  twistFromOrientation,
} from '../physics/snapMath';
import { loadWall } from './wallLoader';
import {
  createSpawnCandidateOffsets,
  SPAWN_GRID_MARGIN_METERS,
  SPAWN_GRID_STEP_METERS,
} from './spawnCandidates';

/** Riferimenti della scena esposti esclusivamente per diagnostica e test E2E. */
export interface WallSceneDebug {
  /** Indica il blocco definitivo dei comandi dopo un fault della scena. */
  readonly failed?: boolean;
  readonly collisionTolerancesMm: { readonly wall: number; readonly holds: number };
  readonly lastPoseDiagnostic: PoseDiagnostic | null;
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
    readonly physicalState: 'detached' | 'attached';
    readonly distanceFromWallCenter: number;
    readonly localNormal: readonly number[];
    readonly intersectsAtSpawn: boolean;
    readonly spawnOffset: readonly number[];
    readonly spawnCandidateIndex: number;
    readonly contactPoint: readonly number[] | null;
    readonly attachmentNormal: readonly number[] | null;
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
  readonly interactionMode: InteractionMode;
  readonly targetVisible: boolean;
  readonly orbitControlsEnabled: boolean;
  readonly dragPreview: InteractionSnapshot['dragPreview'];
  readonly previewObjectCount: number;
  readonly lastActionResult: SceneActionResult | null;
  readonly dragCandidatePosition: readonly number[] | null;
  readonly targetNormal: readonly number[] | null;
  readonly targetShadowPosition: readonly number[] | null;
  readonly poseValidationCount: number;
  readonly dragCandidateNormal: readonly number[] | null;
  readonly dragCandidateFeatureId: number | null;
  readonly dragCandidateEndpointAvailable: boolean;
  readonly dragShadowVisible: boolean;
  readonly contactFeatureId: number | null;
}

/** Misure del rendering e delle validazioni raccolte durante una sessione di benchmark. */
export interface PerformanceSnapshot {
  readonly active: boolean;
  readonly startedAt: number | null;
  readonly stoppedAt: number | null;
  readonly renderTimestamps: readonly number[];
  readonly renderDurations: readonly number[];
  readonly endpointDurations: readonly number[];
  readonly renderCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly canvasCssSize: readonly [number, number];
  readonly drawingBufferSize: readonly [number, number];
  readonly webglVersion: string;
  readonly webglVendor: string;
  readonly webglRenderer: string;
}

/** Controlli diagnostici per delimitare una raccolta di misure riproducibile. */
export interface PerformanceController {
  /** Azzera le misure e avvia la raccolta, con animazione camera opzionale. */
  start(options?: { animateCamera?: boolean }): void;
  /** Seleziona una presa esistente per lo scenario misurato. */
  selectHold(id: string): boolean;
  /** Ferma la raccolta e restituisce le misure finali. */
  stop(): PerformanceSnapshot;
  /** Legge le misure correnti senza interrompere la raccolta. */
  snapshot(): PerformanceSnapshot;
}

/** Controlli pubblici della scena usati dal catalogo senza esporre Three.js o Rapier alla UI. */
export interface WallSceneController {
  /** Rilascia risorse, listener e callback della scena; chiamate ripetute sono innocue. */
  dispose(): void;
  /** Carica e inserisce una presa pronta, annullando le risorse parziali in caso di errore. */
  addHold(hold: HoldManifest): Promise<void>;
  /** Rimuove la presa indicata e libera le risorse della sua istanza. */
  removeHold(id: string): boolean;
  /** Verifica la presenza di un'istanza del modello nella scena. */
  hasHold(id: string): boolean;
  /** Legge l'identificativo selezionato, oppure null in assenza di selezione. */
  selectedHoldId(): string | null;
  /** Rimuove evidenziazione e selezione correnti. */
  clearSelection(): void;
  /** Espone lo stato necessario alla UI senza fornire oggetti fisici o grafici. */
  interactionSnapshot(): InteractionSnapshot;
  /** Registra un osservatore dello stato e restituisce la relativa disiscrizione. */
  onInteractionChange(listener: (snapshot: InteractionSnapshot) => void): () => void;
  /** Entra nella scelta del bersaglio per la presa sganciata selezionata. */
  beginAttachTargeting(): SceneActionResult;
  /** Accoda la posizione del bersaglio e restituisce l'anteprima corrente. */
  updateAttachTarget(point: ViewportPoint): TargetPreview | null;
  /** Campiona il bersaglio e applica l'aggancio solo su una posa valida. */
  commitAttachTarget(point: ViewportPoint): SceneActionResult;
  /** Cerca una posa libera davanti alla parete e ripristina l'orientamento iniziale. */
  detachSelected(): SceneActionResult;
  /** Attiva la modalita di traslazione per una presa agganciata. */
  beginMoving(): SceneActionResult;
  /** Applica un passo tangenziale limitato da superficie e collisioni lungo il percorso. */
  moveSelected(direction: MoveDirection): SceneActionResult;
  /** Crea l'anteprima di traslazione libera o vincolata a un asse dello schermo. */
  beginMoveDrag(direction: MoveDirection | 'free', point: ViewportPoint, pointerId: number): SceneActionResult;
  /** Proietta la richiesta sulla parete senza modificare la posa fisica. */
  updateMoveDrag(point: ViewportPoint, pointerId: number): void;
  /** Conclude il drag applicando soltanto un endpoint fisicamente valido. */
  commitMoveDrag(pointerId: number): SceneActionResult;
  /** Attiva la modalita di rotazione per una presa agganciata. */
  beginRotating(): SceneActionResult;
  /** Applica passi angolari limitati dalle collisioni lungo la rotazione. */
  rotateSelected(direction: RotationDirection, steps?: number): SceneActionResult;
  /** Crea l'anteprima di rotazione associata al puntatore indicato. */
  beginRotationDrag(point: ViewportPoint, pointerId: number): SceneActionResult;
  /** Aggiorna l'angolo candidato quantizzato senza alterare il corpo fisico. */
  updateRotationDrag(point: ViewportPoint, pointerId: number): void;
  /** Conclude il drag applicando soltanto un orientamento finale valido. */
  commitRotationDrag(pointerId: number): SceneActionResult;
  /** Elimina l'anteprima e rilascia la cattura del puntatore senza commit. */
  cancelTransformDrag(): void;
  /** Termina il gesto e riporta la scena alla modalita inattiva. */
  cancelInteraction(): void;
  /** Abilita o sospende i controlli orbitali della camera. */
  setOrbitEnabled(enabled: boolean): void;
  /** Esporta l'immagine guida ripristinando lo stato interattivo al termine. */
  generateGuideImage(): Promise<GuideImageResult>;
}

/** Risorse della presa istanziata e stato di contatto necessario alle trasformazioni. */
interface HoldSceneInstance {
  readonly id: string;
  readonly model: HoldModelResource;
  readonly object: Group;
  readonly physics: KinematicPhysicsObject;
  readonly unbind: () => void;
  readonly originalMaterials: ReadonlyMap<Mesh, Material | Material[]>;
  readonly highlightedMaterials: Map<Mesh, Material | Material[]>;
  physicalState: 'detached' | 'attached';
  attachmentNormal: Vector3 | null;
  currentNormal: Vector3;
  readonly initialRotation: Quaternion;
  readonly intersectsAtSpawn: boolean;
  readonly pickPointLocal: Vector3;
  readonly spawnOffset: Vector2;
  readonly spawnCandidateIndex: number;
  contactPoint: Vector3 | null;
  contactFeatureId: number | null;
  twistRadians: number;
  readonly baseDiameterMeters: number;
  readonly baseFootprint: readonly Vector3[];
}

/** Mantiene posa iniziale, candidato e shadow separati fino alla validazione del rilascio. */
interface TransformDragSession {
  readonly kind: 'move' | 'rotate';
  readonly pointerId: number;
  readonly holdId: string;
  readonly startPosition: Vector3;
  readonly startRotation: Quaternion;
  readonly startContactPoint: Vector3;
  readonly startNormal: Vector3;
  readonly startTwist: number;
  readonly startScreenPoint: ViewportPoint;
  readonly pointerStartPoint: ViewportPoint;
  readonly moveDirection: MoveDirection | 'free' | null;
  readonly screenAxis: Vector2 | null;
  readonly shadow: Group;
  readonly previousOrbitEnabled: boolean;
  lastPointerAngle: number;
  accumulatedAngle: number;
  candidatePosition: Vector3;
  candidateRotation: Quaternion;
  candidateNormal: Vector3;
  candidateFeatureId: number;
  candidateEndpointAvailable: boolean;
  candidateTwist: number;
  candidateScreenPoint: ViewportPoint;
  requestedScreenPoint: ViewportPoint;
}

declare global {
  /** Espone i soli agganci diagnostici opzionali della scena e del benchmark. */
  interface Window {
    __ROUTE_SETTER_SCENE__?: WallSceneDebug;
    __ROUTE_SETTER_PERFORMANCE__?: PerformanceController;
  }
}

/**
 * Crea la scena con bootstrap transazionale e rendering interattivo.
 * Gli errori asincroni di caricamento restano rejection; onError riceve i fault dei callback scena.
 */
export async function createWallScene(
  container: HTMLElement,
  status: HTMLElement,
  physicsConfig: PhysicsConfig,
  onError?: (error: unknown) => void,
): Promise<WallSceneController> {
  let disposed = false;
  let failed = false;
  const releases: Array<() => void> = [];
  /** Esegue tutti i rilasci anche quando una risorsa non puo essere liberata. */
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const release of releases.reverse()) {
      try { release(); } catch { /* Non interrompe il cleanup delle altre risorse. */ }
    }
    releases.length = 0;
  }
  try {
  const scene = new Scene();
  scene.background = new Color(0x101713);
  const previewGroup = new Group();
  previewGroup.name = 'HoldPreviewGroup';
  scene.add(previewGroup);

  const camera = new PerspectiveCamera(42, 1, 0.01, 100_000);
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  releases.push(() => renderer.domElement.remove(), () => renderer.forceContextLoss(), () => renderer.dispose());
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.tabIndex = 0;
  renderer.domElement.dataset.sceneCanvas = 'true';
  container.append(renderer.domElement);
  const performanceEnabled = new URLSearchParams(window.location.search).get('performance') === '1';
  let performanceActive = false;
  let performanceStartedAt: number | null = null;
  let performanceStoppedAt: number | null = null;
  let renderTimestamps: number[] = [];
  let renderDurations: number[] = [];
  let endpointDurations: number[] = [];
  let performanceCameraPosition: Vector3 | null = null;
  let performanceFrame: number | null = null;

  const controls = new OrbitControls(camera, renderer.domElement);
  releases.push(() => controls.dispose());
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
  releases.push(() => disposeObject3D(wall.object));
  scene.add(wall.object);
  const frontReference = findFrontReference(wall.object, wall.center, wall.bounds);
  const spawnCandidates = createSpawnCandidateOffsets({
    halfWidth: wall.size.x / 2,
    halfHeight: wall.size.y / 2,
    step: SPAWN_GRID_STEP_METERS,
    margin: SPAWN_GRID_MARGIN_METERS,
  });
  status.textContent = 'Inizializzazione fisica...';
  const physics = await PhysicsWorld.create(wall.triMesh, physicsConfig);
  releases.push(() => physics.dispose());
  const holdInstances = new Map<string, HoldSceneInstance>();
  const pendingHolds = new Set<string>();
  const colliderDocuments = new Map<string, Promise<HoldColliderDocument>>();
  const interactionListeners = new Set<(snapshot: InteractionSnapshot) => void>();
  const raycaster = new Raycaster();
  const targetSamples = createTargetSamples();
  const targetAdjacency = createTargetAdjacency(targetSamples);
  let selectedHoldId: string | null = null;
  let interactionMode: InteractionMode = 'idle';
  let targetPreview: TargetPreview | null = null;
  let targetInvalidUntil = 0;
  let targetResetTimer: ReturnType<typeof setTimeout> | null = null;
  let targetingShadow: Group | null = null;
  let exporting = false;
  let lastActionResult: SceneActionResult | null = null;
  let dragSession: TransformDragSession | null = null;
  let poseValidationCount = 0;
  let lastExportCamera: CameraSnapshot | null = null;
  let lastExportDimensions: readonly number[] | null = null;
  let renderFrame: number | null = null;
  let targetFrame: number | null = null;
  let pendingTargetPoint: ViewportPoint | null = null;
  let freeMoveFrame: number | null = null;
  let pendingFreeMove: { point: ViewportPoint; pointerId: number } | null = null;
  let resizePending = false;
  let pointerDownPosition: ViewportPoint | null = null;
  let suppressNextSelectionClick = false;
  let freeMovePointer: { id: number; start: ViewportPoint; dragging: boolean } | null = null;
  releases.push(() => {
    interactionListeners.clear();
    if (renderFrame !== null) cancelAnimationFrame(renderFrame);
    if (performanceFrame !== null) cancelAnimationFrame(performanceFrame);
    for (const release of [clearTarget, cancelFreeMoveFrame, cancelTransformDrag]) {
      try { release(); } catch { /* Completa il rilascio anche con una preview danneggiata. */ }
    }
    for (const instance of holdInstances.values()) {
      for (const release of [
        instance.unbind,
        () => setHighlighted(instance, false),
        () => instance.object.removeFromParent(),
        () => instance.model.dispose(),
      ]) {
        try { release(); } catch { /* Continua con le altre risorse della scena. */ }
      }
    }
    holdInstances.clear();
    selectedHoldId = null;
    interactionMode = 'idle';
    colliderDocuments.clear();
    delete window.__ROUTE_SETTER_SCENE__;
    delete window.__ROUTE_SETTER_PERFORMANCE__;
  });

  /** Contiene gli errori dei callback senza richiamare il reporter ricorsivamente. */
  function guarded<T extends unknown[]>(callback: (...args: T) => void): (...args: T) => void {
    return (...args) => {
      if (disposed || failed) return;
      try { callback(...args); }
      catch (error) {
        failed = true;
        if (renderFrame !== null) cancelAnimationFrame(renderFrame);
        if (performanceFrame !== null) cancelAnimationFrame(performanceFrame);
        renderFrame = performanceFrame = null;
        performanceActive = false;
        performanceCameraPosition = null;
        for (const cleanup of [clearTarget, cancelTransformDrag]) {
          try { cleanup(); } catch { /* Il reporter riceve l'errore originale. */ }
        }
        interactionMode = 'idle';
        controls.enabled = false;
        try { updateDebugState(); } catch { /* La diagnostica non sostituisce l'errore originale. */ }
        const snapshot = getInteractionSnapshot();
        for (const listener of [...interactionListeners]) {
          try { listener(snapshot); } catch { /* Un osservatore guasto non blocca gli altri. */ }
        }
        try { onError?.(error); } catch { /* Evita errori globali dal reporter. */ }
      }
    };
  }

  /** Blocca un comando pubblico conservandone firma ed esito senza mutare lo stato fermo. */
  function activeCommand<Args extends unknown[], Result>(
    command: (...args: Args) => Result,
    unavailable: () => Result,
  ): (...args: Args) => Result {
    return (...args) => disposed || failed ? unavailable() : command(...args);
  }

  /** Restituisce un esito neutro senza aggiornare diagnostica o ultimo comando. */
  function unavailableAction(): SceneActionResult {
    return { status: 'not-available', message: 'La scena non e disponibile.' };
  }

  /** Registra eventi canvas con boundary e rimozione deterministica. */
  function listen<K extends keyof HTMLElementEventMap>(
    type: K, callback: (event: HTMLElementEventMap[K]) => void, capture = false,
  ): void {
    const listener = guarded(callback);
    renderer.domElement.addEventListener(type, listener, capture);
    releases.push(() => renderer.domElement.removeEventListener(type, listener, capture));
  }
  frameWall(camera, controls, wall.bounds, wall.center, wall.size);
  status.textContent = 'Parete pronta';
  status.dataset.state = 'ready';

  const updateDebugState = (): void => {
    if (disposed) return;
    window.__ROUTE_SETTER_SCENE__ = {
      failed,
      wallLoaded: true,
      collisionTolerancesMm: { wall: physics.wallPenetrationToleranceMeters * 1000, holds: HOLD_PENETRATION_TOLERANCE_METERS * 1000 },
      lastPoseDiagnostic: physics.lastPoseDiagnostic,
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
          physicalState: instance.physicalState,
          distanceFromWallCenter: instance.object.position.distanceTo(wall.center),
          localNormal: instance.currentNormal.toArray(),
          intersectsAtSpawn: instance.intersectsAtSpawn,
          spawnOffset: instance.spawnOffset.toArray(),
          spawnCandidateIndex: instance.spawnCandidateIndex,
          contactPoint: instance.contactPoint?.toArray() ?? null,
          attachmentNormal: instance.attachmentNormal?.toArray() ?? null,
          twistRadians: instance.twistRadians,
        }]),
      ),
      wallFrontReference: frontReference.toArray(),
      lastExportCamera,
      lastExportDimensions,
      interactionMode,
      targetVisible: targetPreview?.visible ?? false,
      orbitControlsEnabled: controls.enabled,
      previewObjectCount: previewGroup.children.length,
      lastActionResult,
      dragCandidatePosition: dragSession?.candidatePosition.toArray() ?? null,
      targetNormal: targetingShadow && targetPreview
        ? new Vector3(0, 0, 1).applyQuaternion(targetingShadow.quaternion).toArray()
        : null,
      targetShadowPosition: targetingShadow?.visible ? targetingShadow.position.toArray() : null,
      poseValidationCount,
      dragCandidateNormal: dragSession?.candidateNormal.toArray() ?? null,
      dragCandidateFeatureId: dragSession?.candidateFeatureId ?? null,
      dragCandidateEndpointAvailable: dragSession?.candidateEndpointAvailable ?? false,
      dragShadowVisible: dragSession?.shadow.visible ?? false,
      contactFeatureId: selectedHoldId ? holdInstances.get(selectedHoldId)?.contactFeatureId ?? null : null,
      dragPreview: dragSession ? {
        kind: dragSession.kind,
        start: dragSession.startScreenPoint,
        requested: dragSession.requestedScreenPoint,
        candidate: dragSession.candidateScreenPoint,
        angleDegrees: dragSession.kind === 'rotate'
          ? MathUtils.radToDeg(dragSession.candidateTwist - dragSession.startTwist)
          : null,
      } : null,
    };
  };
  const getInteractionSnapshot = (): InteractionSnapshot => {
    if (failed || disposed) return {
      failed: true, selected: null, mode: 'idle', target: null,
      exporting: false, lastActionResult, dragPreview: null,
    };
    const selected = selectedHoldId ? holdInstances.get(selectedHoldId) : undefined;
    return {
      failed: false,
      selected: selected ? {
        id: selected.id,
        physicalState: selected.physicalState,
        screenBounds: projectObjectBounds(selected.object, camera, renderer.domElement),
        contactScreenPoint: selected.contactPoint
          ? projectWorldPoint(selected.contactPoint, camera, renderer.domElement)
          : null,
      } : null,
      mode: interactionMode,
      target: targetPreview,
      exporting,
      lastActionResult,
      dragPreview: dragSession ? {
        kind: dragSession.kind,
        start: dragSession.startScreenPoint,
        requested: dragSession.requestedScreenPoint,
        candidate: dragSession.candidateScreenPoint,
        angleDegrees: dragSession.kind === 'rotate'
          ? MathUtils.radToDeg(dragSession.candidateTwist - dragSession.startTwist)
          : null,
      } : null,
    };
  };
  const notifyInteraction = (): void => {
    if (disposed || failed) return;
    updateDebugState();
    const snapshot = getInteractionSnapshot();
    interactionListeners.forEach((listener) => listener(snapshot));
  };
  let renderPending = false;
  const render = (): void => {
    if (disposed || failed) return;
    updateDebugState();
    if (renderPending) return;
    renderPending = true;
    renderFrame = requestAnimationFrame(guarded(() => {
      renderFrame = null;
      renderPending = false;
      const renderStartedAt = performance.now();
      renderer.render(scene, camera);
      if (performanceActive) {
        renderTimestamps.push(renderStartedAt);
        renderDurations.push(performance.now() - renderStartedAt);
      }
      notifyInteraction();
    }));
  };
  if (performanceEnabled) {
    const performanceSnapshot = (): PerformanceSnapshot => {
      const context = renderer.getContext();
      const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
      const bounds = renderer.domElement.getBoundingClientRect();
      return {
        active: performanceActive,
        startedAt: performanceStartedAt,
        stoppedAt: performanceStoppedAt,
        renderTimestamps: [...renderTimestamps],
        renderDurations: [...renderDurations],
        endpointDurations: [...endpointDurations],
        renderCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        canvasCssSize: [bounds.width, bounds.height],
        drawingBufferSize: [renderer.domElement.width, renderer.domElement.height],
        webglVersion: String(context.getParameter(context.VERSION)),
        webglVendor: String(context.getParameter(debugInfo?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR)),
        webglRenderer: String(context.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER)),
      };
    };
    window.__ROUTE_SETTER_PERFORMANCE__ = {
      start: (options = {}) => {
        if (failed || disposed) return;
        if (performanceFrame !== null) cancelAnimationFrame(performanceFrame);
        performanceFrame = null;
        renderTimestamps = [];
        renderDurations = [];
        endpointDurations = [];
        performanceStartedAt = performance.now();
        performanceStoppedAt = null;
        performanceCameraPosition = options.animateCamera === false ? null : camera.position.clone();
        performanceActive = true;
        // La modalita di sola telemetria registra render e commit senza muovere la camera.
        if (options.animateCamera === false) return;
        const benchmarkFrame = guarded((now: number): void => {
          if (!performanceActive || !performanceCameraPosition || performanceStartedAt === null) return;
          const offset = performanceCameraPosition.clone().sub(controls.target);
          offset.applyAxisAngle(new Vector3(0, 1, 0), Math.sin((now - performanceStartedAt) / 2_000) * 0.08);
          camera.position.copy(controls.target).add(offset);
          camera.lookAt(controls.target);
          const renderStartedAt = performance.now();
          renderer.render(scene, camera);
          renderTimestamps.push(renderStartedAt);
          renderDurations.push(performance.now() - renderStartedAt);
          performanceFrame = requestAnimationFrame(benchmarkFrame);
        });
        performanceFrame = requestAnimationFrame(benchmarkFrame);
      },
      selectHold: (id) => {
        if (failed || disposed) return false;
        if (!holdInstances.has(id)) return false;
        setSelection(id);
        render();
        return true;
      },
      stop: () => {
        if (failed || disposed) return performanceSnapshot();
        performanceActive = false;
        if (performanceFrame !== null) cancelAnimationFrame(performanceFrame);
        performanceFrame = null;
        performanceStoppedAt = performance.now();
        if (performanceCameraPosition) {
          camera.position.copy(performanceCameraPosition);
          camera.lookAt(controls.target);
          performanceCameraPosition = null;
          render();
        }
        return performanceSnapshot();
      },
      snapshot: performanceSnapshot,
    };
  }
  /** Ricalcola il target solo su variazioni camera, non sulle notifiche di rendering. */
  const cameraChanged = guarded((): void => {
    camera.updateMatrixWorld(true);
    if (pendingTargetPoint) updateAttachTarget(pendingTargetPoint);
    render();
  });
  controls.addEventListener('change', cameraChanged);
  releases.push(() => controls.removeEventListener('change', cameraChanged));
  updateDebugState();

  /** Applica l'ultimo resize soltanto quando non esiste una trasformazione in anteprima. */
  const resize = (): void => {
    if (disposed || failed) return;
    if (dragSession) { resizePending = true; return; }
    resizePending = false;
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (pendingTargetPoint) updateAttachTarget(pendingTargetPoint);
    render();
  };
  const resizeObserver = new ResizeObserver(guarded(resize));
  releases.push(() => resizeObserver.disconnect());
  resizeObserver.observe(container);
  resize();

  listen('pointermove', (event) => {
    if (interactionMode !== 'attach-targeting' || event.pointerType !== 'mouse') return;
    const bounds = renderer.domElement.getBoundingClientRect();
    const nextPoint = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    if (targetInvalidUntil > 0 && targetPreview
      && Math.hypot(nextPoint.x - targetPreview.center.x, nextPoint.y - targetPreview.center.y) > 1) {
      targetInvalidUntil = 0;
      if (targetResetTimer !== null) clearTimeout(targetResetTimer);
      targetResetTimer = null;
    }
    pendingTargetPoint = nextPoint;
    if (targetFrame !== null) return;
    targetFrame = requestAnimationFrame(guarded(() => {
      targetFrame = null;
      if (pendingTargetPoint) updateAttachTarget(pendingTargetPoint);
    }));
  });

  listen('pointerdown', (event) => {
    suppressNextSelectionClick = false;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointerDownPosition = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    if (interactionMode === 'moving' && event.pointerType === 'mouse' && event.button === 0 && selectedHoldId) {
      raycaster.setFromCamera(new Vector2(
        (pointerDownPosition.x / bounds.width) * 2 - 1,
        -(pointerDownPosition.y / bounds.height) * 2 + 1,
      ), camera);
      const selected = holdInstances.get(selectedHoldId);
      if (selected && raycaster.intersectObject(selected.object, true).length > 0) {
        freeMovePointer = { id: event.pointerId, start: pointerDownPosition, dragging: false };
        renderer.domElement.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    if (interactionMode !== 'attach-targeting' || event.pointerType !== 'mouse' || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  listen('pointermove', (event) => {
    if (!freeMovePointer || freeMovePointer.id !== event.pointerId) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    if (!freeMovePointer.dragging && Math.hypot(
      point.x - freeMovePointer.start.x,
      point.y - freeMovePointer.start.y,
    ) >= 4) {
      freeMovePointer.dragging = true;
      beginMoveDrag('free', freeMovePointer.start, event.pointerId);
    }
    if (!freeMovePointer.dragging) return;
    pendingFreeMove = { point, pointerId: event.pointerId };
    if (freeMoveFrame !== null) return;
    freeMoveFrame = requestAnimationFrame(guarded(() => {
      freeMoveFrame = null;
      const pending = pendingFreeMove;
      pendingFreeMove = null;
      if (pending) updateMoveDrag(pending.point, pending.pointerId);
    }));
  }, true);

  listen('pointerup', (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    const downPosition = pointerDownPosition;
    const wasDrag = downPosition !== null && Math.hypot(
      event.clientX - bounds.left - downPosition.x,
      event.clientY - bounds.top - downPosition.y,
    ) > 4;
    if (wasDrag) suppressNextSelectionClick = true;
    pointerDownPosition = null;
    if (freeMovePointer?.id === event.pointerId) {
      const pointer = freeMovePointer;
      freeMovePointer = null;
      cancelFreeMoveFrame();
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      if (pointer.dragging) {
        updateMoveDrag({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, event.pointerId);
        commitMoveDrag(event.pointerId);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (interactionMode !== 'attach-targeting' || event.pointerType !== 'mouse' || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (wasDrag) return;
    const outcome = commitAttachTarget({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    if (outcome.status === 'applied') suppressNextSelectionClick = true;
  }, true);
  listen('pointercancel', (event) => {
    if (freeMovePointer?.id !== event.pointerId) return;
    cancelTransformDrag();
  });
  listen('lostpointercapture', (event) => {
    if (freeMovePointer?.id !== event.pointerId) return;
    cancelTransformDrag();
  });

  listen('click', (event) => {
    if (suppressNextSelectionClick) {
      suppressNextSelectionClick = false;
      return;
    }
    if (interactionMode === 'attach-targeting') return;
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
    if (!id && (interactionMode === 'moving' || interactionMode === 'rotating')) return;
    setSelection(id);
    render();
  });

  /** Aggiorna selezione ed evidenziazione garantendo una sola presa attiva. */
  function setSelection(id: string | null): void {
    if (id === selectedHoldId) {
      return;
    }
    clearTarget();
    cancelTransformDrag();
    if (selectedHoldId) {
      const previous = holdInstances.get(selectedHoldId);
      if (previous) setHighlighted(previous, false);
    }
    selectedHoldId = id && holdInstances.has(id) ? id : null;
    if (selectedHoldId) {
      const selected = holdInstances.get(selectedHoldId);
      if (selected && !exporting) setHighlighted(selected, true);
    }
    interactionMode = 'idle';
    targetPreview = null;
    notifyInteraction();
  }

  const selectedInstance = (): HoldSceneInstance | undefined => selectedHoldId ? holdInstances.get(selectedHoldId) : undefined;
  const result = (
    status: SceneActionResult['status'],
    message: string,
    reason?: SceneActionResult['reason'],
  ): SceneActionResult => {
    lastActionResult = { status, message, reason };
    updateDebugState();
    return lastActionResult;
  };

  /** Traduce il blocker senza dedurre collisioni da un esito privo di causa fisica. */
  function poseFailure(blocker: PoseValidation['blocker']): Pick<SceneActionResult, 'message' | 'reason'> {
    if (physics.lastPoseDiagnostic?.uncertain) return { message: 'Impossibile verificare questa posizione.', reason: 'path-unresolved' };
    if (blocker === 'wall') return { message: 'Collisione con la parete.', reason: 'wall-collision' };
    if (blocker === 'hold') return { message: 'Collisione con un\'altra presa.', reason: 'hold-collision' };
    return { message: 'Validazione della posa non risolta.', reason: 'path-unresolved' };
  }

  /** Aggiorna il target centrale senza eseguire il campionamento completo. */
  function updateAttachTarget(point: ViewportPoint): TargetPreview | null {
    const instance = selectedInstance();
    if (!instance || instance.physicalState !== 'detached' || interactionMode !== 'attach-targeting') return null;
    pendingTargetPoint = { ...point };
    const hit = raycastWallAt(point);
    if (hit) {
      const ellipse = targetEllipse(instance, hit.point, hit.normal);
      ensureTargetingShadow(instance);
      targetingShadow!.position.copy(hit.point);
      targetingShadow!.quaternion.copy(orientationFromNormal(hit.normal, instance.twistRadians));
      targetingShadow!.visible = true;
      setShadowColor(targetingShadow!, performance.now() < targetInvalidUntil ? 0xff3b30 : 0xffd436);
      targetPreview = {
        center: point,
        diameterPx: targetDiameterPx(instance, hit.point, hit.normal),
        visible: true,
        feedback: performance.now() < targetInvalidUntil ? 'invalid' : 'normal',
        minorAxisRatio: ellipse.ratio,
        rotationRadians: ellipse.rotation,
      };
    } else {
      if (targetingShadow) targetingShadow.visible = false;
      targetPreview = null;
    }
    notifyInteraction();
    render();
    return targetPreview;
  }

  /** Campiona il cerchio, seleziona la superficie dominante e committa una posa valida. */
  function commitAttachTarget(point: ViewportPoint): SceneActionResult {
    const instance = selectedInstance();
    if (!instance || instance.physicalState !== 'detached' || interactionMode !== 'attach-targeting') {
      return result('not-available', 'Aggancio non disponibile.');
    }
    const preview = updateAttachTarget(point);
    const diameterPx = preview?.diameterPx ?? estimateTargetDiameterWithoutCenter(instance, point);
    const hits: SurfaceSampleHit[] = [];
    targetSamples.forEach((sample) => {
      const samplePoint = {
        x: point.x + sample.x * diameterPx / 2,
        y: point.y + sample.y * diameterPx / 2,
      };
      const hit = raycastWallAt(samplePoint);
      if (!hit) return;
      hits.push({
        sampleIndex: sample.index,
        point: hit.point,
        normal: hit.normal,
        cameraDistance: hit.distance,
        stableId: hit.featureId.toString().padStart(12, '0'),
        featureId: hit.featureId,
        screenDistanceSquared: sample.x * sample.x + sample.y * sample.y,
      });
    });
    const dominant = selectDominantSurface(hits, instance.baseDiameterMeters, targetSamples, targetAdjacency);
    if (!dominant) return invalidateTarget('Nessuna superficie valida nel target.', 'no-surface');
    const rotation = orientationFromNormal(dominant.normal, instance.twistRadians);
    const validation = validatePose(instance, dominant.point, rotation, dominant.normal);
    if (!validation.valid) {
      const failure = poseFailure(validation.blocker);
      return invalidateTarget(failure.message, failure.reason);
    }
    physics.setKinematicTransform(instance.physics, dominant.point, rotation);
    instance.physicalState = 'attached';
    instance.attachmentNormal = dominant.normal.clone();
    instance.currentNormal = dominant.normal.clone();
    instance.contactPoint = dominant.point.clone();
    instance.contactFeatureId = dominant.featureId;
    interactionMode = 'idle';
    targetPreview = null;
    clearTarget();
    physics.synchronizeRendering();
    render();
    return result('applied', 'Presa agganciata.');
  }

  /** Segnala il bersaglio non valido con feedback temporaneo, senza spostare la presa. */
  function invalidateTarget(message: string, reason?: SceneActionResult['reason']): SceneActionResult {
    targetInvalidUntil = performance.now() + 500;
    if (targetResetTimer !== null) clearTimeout(targetResetTimer);
    if (targetPreview) targetPreview = { ...targetPreview, feedback: 'invalid' };
    else targetPreview = {
      center: pendingTargetPoint ?? { x: 0, y: 0 },
      diameterPx: 48,
      visible: true,
      feedback: 'invalid',
      minorAxisRatio: 1,
      rotationRadians: 0,
    };
    const outcome = result('invalid-target', message, reason);
    if (targetingShadow) setShadowColor(targetingShadow, 0xff3b30);
    notifyInteraction();
    targetResetTimer = setTimeout(guarded(() => {
      targetResetTimer = null;
      if (interactionMode === 'attach-targeting' && targetPreview) {
        targetPreview = { ...targetPreview, feedback: 'normal' };
        if (targetingShadow) setShadowColor(targetingShadow, 0xffd436);
        notifyInteraction();
      }
    }), 500);
    return outcome;
  }

  /** Cerca la prima posa detached valida da 50 cm a 10 m. */
  function detachSelected(): SceneActionResult {
    const instance = selectedInstance();
    if (!instance || instance.physicalState !== 'attached' || !instance.contactPoint || !instance.attachmentNormal) {
      return result('not-available', 'Sgancio non disponibile.');
    }
    for (let index = 0; index <= 95; index += 1) {
      const distance = 0.5 + index * 0.1;
      const target = instance.contactPoint.clone().addScaledVector(instance.attachmentNormal, distance);
      if (!validatePose(instance, target, instance.initialRotation, instance.attachmentNormal).valid) continue;
      physics.setKinematicTransform(instance.physics, target, instance.initialRotation);
      instance.physicalState = 'detached';
      instance.attachmentNormal = null;
      instance.currentNormal.set(0, 0, 1);
      instance.contactPoint = null;
      instance.contactFeatureId = null;
      instance.twistRadians = 0;
      interactionMode = 'idle';
      physics.synchronizeRendering();
      render();
      return result('applied', 'Presa sganciata.');
    }
    return result('blocked', 'Nessuno spazio disponibile per sganciare la presa.');
  }

  /** Avanza lungo la tangente e riproietta anche i passi parziali prima di applicarli. */
  function moveSelected(direction: MoveDirection): SceneActionResult {
    const instance = selectedInstance();
    if (!instance || instance.physicalState !== 'attached' || interactionMode !== 'moving'
      || !instance.attachmentNormal || !instance.contactPoint) {
      return result('not-available', 'Movimento non disponibile.');
    }
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const tangentRight = projectAxisOnTangent(right, instance.currentNormal, new Vector3(1, 0, 0));
    const tangentUp = projectAxisOnTangent(up, instance.currentNormal, new Vector3(0, 1, 0));
    const desired = direction === 'up' ? tangentUp
      : direction === 'down' ? tangentUp.negate()
        : direction === 'right' ? tangentRight
          : tangentRight.negate();
    desired.multiplyScalar(TRANSLATION_STEP_METERS);
    const candidate = instance.contactPoint.clone().add(desired);
    const origin = candidate.clone().addScaledVector(instance.currentNormal, 0.02);
    const hit = physics.castRayToWall(origin, instance.currentNormal.clone().negate(), 0.04);
    if (!hit) return result('blocked', 'Limite della superficie raggiunto.', 'no-surface');
    const point = new Vector3(hit.point.x, hit.point.y, hit.point.z);
    if (point.distanceTo(candidate) > 0.005) return result('blocked', 'Cambio di superficie raggiunto.', 'surface-gap');
    const normal = resolveContactNormal(new Vector3(hit.normal.x, hit.normal.y, hit.normal.z), instance.currentNormal);
    if (normal.dot(instance.currentNormal) < 0) normal.negate();
    if (normal.angleTo(instance.attachmentNormal) > Math.PI / 36) {
      return result('blocked', 'Cambio di inclinazione raggiunto.', 'normal-limit');
    }
    const rotation = orientationFromNormal(normal, instance.twistRadians);
    const currentRotation = instance.physics.body.rotation();
    const path = physics.maximumValidPoseFraction(instance.physics, instance.contactPoint, currentRotation, point, rotation);
    const validFraction = path.fraction;
    if (validFraction <= 0) return pathResult(path);
    if (validFraction < 1) {
      const partialPoint = instance.contactPoint.clone().lerp(point, validFraction);
      const partialNormal = instance.currentNormal.clone().lerp(normal, validFraction).normalize();
      const partialRotation = new Quaternion(
        currentRotation.x,
        currentRotation.y,
        currentRotation.z,
        currentRotation.w,
      ).slerp(rotation, validFraction);
      const partialHit = physics.castRayToWall(partialPoint.clone().addScaledVector(partialNormal, 0.02), partialNormal.clone().negate(), 0.04);
      if (!partialHit) return result('blocked', 'Limite della superficie raggiunto.', 'no-surface');
      const projected = new Vector3().copy(partialHit.point);
      const projectedNormal = resolveContactNormal(new Vector3().copy(partialHit.normal), partialNormal);
      if (projectedNormal.dot(partialNormal) < 0) projectedNormal.negate();
      if (projected.distanceTo(partialPoint) > 0.005 || projectedNormal.angleTo(instance.attachmentNormal) > Math.PI / 36) return pathResult(path);
      partialRotation.copy(orientationFromNormal(projectedNormal, instance.twistRadians));
      const projectedPath = physics.maximumValidPoseFraction(instance.physics, instance.contactPoint, currentRotation, projected, partialRotation);
      if (projectedPath.fraction < 1 || !validatePose(instance, projected, partialRotation, projectedNormal).valid) return pathResult(path);
      physics.setKinematicTransform(instance.physics, projected, partialRotation);
      instance.currentNormal = projectedNormal;
      instance.contactPoint = projected;
      instance.contactFeatureId = partialHit.featureId;
      physics.synchronizeRendering();
      render();
      return pathResult(path);
    }
    const endpoint = validatePose(instance, point, rotation, normal);
    if (!endpoint.valid) return pathResult({ fraction: 0, blocker: endpoint.blocker, unresolved: physics.lastPoseDiagnostic?.uncertain ?? false });
    physics.setKinematicTransform(instance.physics, point, rotation);
    instance.currentNormal = normal;
    instance.contactPoint = point;
    instance.contactFeatureId = hit.featureId;
    physics.synchronizeRendering();
    render();
    return result('applied', 'Presa spostata.');
  }

  /** Consuma passi angolari fermandosi alla prima collisione o incertezza del percorso. */
  function rotateSelected(direction: RotationDirection, steps = 1): SceneActionResult {
    const instance = selectedInstance();
    if (!instance || instance.physicalState !== 'attached' || interactionMode !== 'rotating') {
      return result('not-available', 'Rotazione non disponibile.');
    }
    const signedSteps = direction === 'clockwise' ? -Math.abs(steps) : Math.abs(steps);
    let applied = 0;
    let blockedPath: PosePathValidation | null = null;
    for (let index = 0; index < Math.abs(signedSteps); index += 1) {
      const delta = Math.sign(signedSteps) * ROTATION_STEP_RADIANS;
      const current = instance.physics.body.rotation();
      const next = addTwistAroundNormal(
        new Quaternion(current.x, current.y, current.z, current.w),
        instance.currentNormal,
        delta,
      );
      const translation = instance.physics.body.translation();
      const path = physics.maximumValidPoseFraction(instance.physics, translation, current, translation, next);
      if (path.fraction < 1) {
        blockedPath = path;
        if (path.fraction > 0) {
          const partial = new Quaternion().copy(current).slerp(next, path.fraction);
          if (validatePose(instance, translation, partial, instance.currentNormal).valid) {
            physics.setKinematicTransform(instance.physics, translation, partial);
            instance.twistRadians += delta * path.fraction;
          }
        }
        break;
      }
      const endpoint = validatePose(instance, translation, next, instance.currentNormal);
      if (!endpoint.valid) {
        blockedPath = { fraction: 0, blocker: endpoint.blocker, unresolved: physics.lastPoseDiagnostic?.uncertain ?? false };
        break;
      }
      physics.setKinematicTransform(instance.physics, instance.physics.body.translation(), next);
      instance.twistRadians += delta;
      applied += 1;
    }
    physics.synchronizeRendering();
    render();
    if (blockedPath) return pathResult(blockedPath);
    if (applied === 0) return result('cancelled', 'Nessuna rotazione richiesta.', 'no-change');
    return result('applied', 'Presa ruotata.');
  }

  /** Riserva un gesto di movimento valido e sospende l'orbita durante l'anteprima. */
  function beginMoveDrag(direction: MoveDirection | 'free', point: ViewportPoint, pointerId: number): SceneActionResult {
    const instance = selectedInstance();
    if (!instance || instance.physicalState !== 'attached' || interactionMode !== 'moving'
      || !instance.contactPoint || !instance.attachmentNormal || dragSession) {
      return result('not-available', 'Drag di movimento non disponibile.');
    }
    const axis = direction === 'free' ? null
      : direction === 'up' ? new Vector2(0, -1)
      : direction === 'down' ? new Vector2(0, 1)
        : direction === 'left' ? new Vector2(-1, 0)
          : new Vector2(1, 0);
    dragSession = createDragSession('move', instance, point, pointerId, direction, axis);
    controls.enabled = false;
    notifyInteraction();
    render();
    return result('previewing', 'Anteprima spostamento attiva.');
  }

  /** Trasporta l'orientamento sulla normale colpita; nasconde la shadow se manca la superficie. */
  function updateMoveDrag(point: ViewportPoint, pointerId: number): void {
    const session = dragSession;
    const instance = selectedInstance();
    if (!session || session.kind !== 'move' || session.pointerId !== pointerId
      || !instance || instance.id !== session.holdId || !instance.attachmentNormal) return;
    const delta = new Vector2(point.x - session.pointerStartPoint.x, point.y - session.pointerStartPoint.y);
    const target = session.screenAxis ? (() => {
      const scalar = delta.dot(session.screenAxis!);
      return {
        x: session.startScreenPoint.x + session.screenAxis!.x * scalar,
        y: session.startScreenPoint.y + session.screenAxis!.y * scalar,
      };
    })() : point;
    session.requestedScreenPoint = target;
    const hit = raycastWallAt(target);
    if (hit) {
      const normal = resolveContactNormal(hit.normal, session.candidateNormal);
      if (normal.dot(hit.normal) < 0) normal.negate();
      session.candidatePosition.copy(hit.point);
      session.candidateNormal.copy(normal);
      session.candidateFeatureId = hit.featureId;
      session.candidateRotation.copy(transportOrientationToNormal(session.startRotation, session.startNormal, normal));
      session.candidateTwist = twistFromOrientation(session.candidateRotation, normal);
      session.candidateScreenPoint = target;
      session.candidateEndpointAvailable = true;
      session.shadow.visible = true;
      lastActionResult = result('previewing', 'Anteprima spostamento attiva.');
      applyShadowPose(session);
    } else {
      session.candidateEndpointAvailable = false;
      session.shadow.visible = false;
      lastActionResult = result('surface-limit', 'Nessuna superficie visibile nel punto richiesto.', 'no-surface');
    }
    notifyInteraction();
    render();
  }

  /** Valida solo l'endpoint del drag e aggiorna il contatto dopo un commit riuscito. */
  function commitMoveDrag(pointerId: number): SceneActionResult {
    const startedAt = performance.now();
    const session = dragSession;
    const instance = selectedInstance();
    if (!session || session.kind !== 'move' || session.pointerId !== pointerId || !instance) {
      return result('not-available', 'Nessuna anteprima movimento attiva.');
    }
    // Tornare al punto iniziale non e uno spostamento, neppure con l'errore numerico del raycast.
    const changed = session.candidatePosition.distanceTo(session.startContactPoint) > 1e-8
      && Math.hypot(session.requestedScreenPoint.x - session.startScreenPoint.x,
        session.requestedScreenPoint.y - session.startScreenPoint.y) > 1e-6;
    let outcome: SceneActionResult;
    if (!session.candidateEndpointAvailable) {
      outcome = result('invalid-endpoint', 'Nessuna superficie visibile. Movimento annullato.', 'no-surface');
    } else if (!changed) {
      outcome = result('cancelled', 'Nessuna variazione di posizione.', 'no-change');
    } else {
      const validation = validatePose(instance, session.candidatePosition, session.candidateRotation, session.candidateNormal);
      if (validation.valid) {
        physics.setKinematicTransform(instance.physics, session.candidatePosition, session.candidateRotation);
        instance.contactPoint = session.candidatePosition.clone();
        instance.contactFeatureId = session.candidateFeatureId;
        instance.currentNormal = session.candidateNormal.clone();
        instance.attachmentNormal = session.candidateNormal.clone();
        instance.twistRadians = session.candidateTwist;
        physics.synchronizeRendering();
        outcome = result('committed', 'Spostamento applicato.');
      } else {
        const failure = poseFailure(validation.blocker);
        outcome = result('invalid-endpoint', `${failure.message} Movimento annullato.`, failure.reason);
      }
    }
    finishDragSession();
    render();
    if (performanceActive) endpointDurations.push(performance.now() - startedAt);
    return outcome;
  }

  /** Inizializza una shadow di rotazione per la presa agganciata e blocca l'orbita. */
  function beginRotationDrag(point: ViewportPoint, pointerId: number): SceneActionResult {
    const instance = selectedInstance();
    if (!instance || instance.physicalState !== 'attached' || interactionMode !== 'rotating'
      || !instance.contactPoint || dragSession) {
      return result('not-available', 'Drag di rotazione non disponibile.');
    }
    dragSession = createDragSession('rotate', instance, point, pointerId, null, null);
    controls.enabled = false;
    notifyInteraction();
    render();
    return result('previewing', 'Anteprima rotazione attiva.');
  }

  /** Accumula l'angolo del puntatore senza salti al cambio di quadrante e quantizza la shadow. */
  function updateRotationDrag(point: ViewportPoint, pointerId: number): void {
    const session = dragSession;
    if (!session || session.kind !== 'rotate' || session.pointerId !== pointerId) return;
    const center = projectWorldPoint(session.startContactPoint, camera, renderer.domElement);
    const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
    let delta = currentAngle - session.lastPointerAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    session.accumulatedAngle -= delta;
    session.lastPointerAngle = currentAngle;
    session.candidateTwist = session.startTwist
      + Math.round(session.accumulatedAngle / ROTATION_STEP_RADIANS) * ROTATION_STEP_RADIANS;
    session.candidateRotation.copy(orientationFromNormal(session.startNormal, session.candidateTwist));
    session.requestedScreenPoint = point;
    session.candidateScreenPoint = point;
    applyShadowPose(session);
    notifyInteraction();
    render();
  }

  /** Applica l'orientamento finale solo se diverso e valido, poi libera la sessione di drag. */
  function commitRotationDrag(pointerId: number): SceneActionResult {
    const startedAt = performance.now();
    const session = dragSession;
    const instance = selectedInstance();
    if (!session || session.kind !== 'rotate' || session.pointerId !== pointerId || !instance) {
      return result('not-available', 'Nessuna anteprima rotazione attiva.');
    }
    let outcome: SceneActionResult;
    if (Math.abs(session.candidateTwist - session.startTwist) < 1e-8) {
      outcome = result('cancelled', 'Nessuna variazione di rotazione.', 'no-change');
    } else {
      const validation = validatePose(instance, session.candidatePosition, session.candidateRotation, session.candidateNormal);
      if (validation.valid) {
        physics.setKinematicTransform(instance.physics, session.candidatePosition, session.candidateRotation);
        instance.twistRadians = session.candidateTwist;
        physics.synchronizeRendering();
        outcome = result('committed', 'Rotazione applicata.');
      } else {
        const failure = poseFailure(validation.blocker);
        outcome = result('invalid-endpoint', `${failure.message} Rotazione annullata.`, failure.reason);
      }
    }
    finishDragSession();
    render();
    if (performanceActive) endpointDurations.push(performance.now() - startedAt);
    return outcome;
  }

  /** Fotografa la posa iniziale e crea una shadow con candidati indipendenti dal corpo fisico. */
  function createDragSession(
    kind: 'move' | 'rotate',
    instance: HoldSceneInstance,
    point: ViewportPoint,
    pointerId: number,
    moveDirection: MoveDirection | 'free' | null,
    screenAxis: Vector2 | null,
  ): TransformDragSession {
    const translation = instance.physics.body.translation();
    const rotation = instance.physics.body.rotation();
    const shadow = createShadow(instance.object);
    previewGroup.add(shadow);
    const position = new Vector3(translation.x, translation.y, translation.z);
    const quaternion = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    shadow.position.copy(position);
    shadow.quaternion.copy(quaternion);
    const contactScreen = projectWorldPoint(instance.contactPoint!, camera, renderer.domElement);
    const centerAngle = Math.atan2(point.y - contactScreen.y, point.x - contactScreen.x);
    return {
      kind,
      pointerId,
      holdId: instance.id,
      startPosition: position,
      startRotation: quaternion,
      startContactPoint: instance.contactPoint!.clone(),
      startNormal: instance.currentNormal.clone(),
      startTwist: instance.twistRadians,
      startScreenPoint: contactScreen,
      pointerStartPoint: point,
      moveDirection,
      screenAxis,
      shadow,
      previousOrbitEnabled: controls.enabled,
      lastPointerAngle: centerAngle,
      accumulatedAngle: 0,
      candidatePosition: position.clone(),
      candidateRotation: quaternion.clone(),
      candidateNormal: instance.currentNormal.clone(),
      candidateFeatureId: instance.contactFeatureId ?? Number.MAX_SAFE_INTEGER,
      candidateEndpointAvailable: true,
      candidateTwist: instance.twistRadians,
      candidateScreenPoint: contactScreen,
      requestedScreenPoint: point,
    };
  }

  /** Crea una sola shadow gialla per visualizzare il possibile aggancio. */
  function ensureTargetingShadow(instance: HoldSceneInstance): void {
    if (targetingShadow) return;
    targetingShadow = createShadow(instance.object, 0xffd436);
    targetingShadow.name = `${instance.object.name}:attach-shadow`;
    previewGroup.add(targetingShadow);
  }

  /** Scollega e libera l'anteprima di aggancio, se presente. */
  function disposeTargetingShadow(): void {
    if (!targetingShadow) return;
    const shadow = targetingShadow;
    targetingShadow = null;
    disposeShadow(shadow);
  }

  /** Copia il candidato sulla sola shadow, lasciando invariata l'istanza reale. */
  function applyShadowPose(session: TransformDragSession): void {
    session.shadow.position.copy(session.candidatePosition);
    session.shadow.quaternion.copy(session.candidateRotation);
    session.shadow.updateMatrix();
  }

  /** Libera la shadow, ripristina l'orbita precedente e applica il resize eventualmente rinviato. */
  function finishDragSession(): void {
    if (!dragSession) return;
    const session = dragSession;
    dragSession = null;
    controls.enabled = session.previousOrbitEnabled;
    disposeShadow(session.shadow);
    if (resizePending) resize();
    notifyInteraction();
  }

  /** Annulla frame e cattura pendenti, quindi chiude il drag senza applicare il candidato. */
  function cancelTransformDrag(): void {
    cancelFreeMoveFrame();
    if (freeMovePointer) {
      const pointer = freeMovePointer;
      freeMovePointer = null;
      if (renderer.domElement.hasPointerCapture(pointer.id)) {
        renderer.domElement.releasePointerCapture(pointer.id);
      }
    }
    if (dragSession) {
      finishDragSession();
      lastActionResult = result('cancelled', 'Operazione annullata.');
      render();
    }
  }

  /** Elimina gli aggiornamenti liberi non ancora consumati dal frame. */
  function cancelFreeMoveFrame(): void {
    if (freeMoveFrame !== null) cancelAnimationFrame(freeMoveFrame);
    freeMoveFrame = null;
    pendingFreeMove = null;
  }

  /** Invalida puntatore, feedback e shadow quando termina il targeting. */
  function clearTarget(): void {
    if (targetFrame !== null) cancelAnimationFrame(targetFrame);
    if (targetResetTimer !== null) clearTimeout(targetResetTimer);
    targetFrame = null;
    targetResetTimer = null;
    pendingTargetPoint = null;
    targetPreview = null;
    targetInvalidUntil = 0;
    disposeTargetingShadow();
  }

  /** Converte pixel della viewport in un raycast fisico con normale rivolta verso la camera. */
  function raycastWallAt(point: ViewportPoint): { point: Vector3; normal: Vector3; distance: number; featureId: number } | null {
    const bounds = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new Vector2(
      (point.x / bounds.width) * 2 - 1,
      -(point.y / bounds.height) * 2 + 1,
    ), camera);
    const hit = physics.castRayToWall(raycaster.ray.origin, raycaster.ray.direction, camera.far);
    if (!hit) return null;
    const normal = new Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
    return { point: new Vector3(hit.point.x, hit.point.y, hit.point.z), normal, distance: hit.distance, featureId: hit.featureId };
  }


  /** Proietta il footprint orientato della presa e ne limita il diametro per il bersaglio UI. */
  function targetDiameterPx(instance: HoldSceneInstance, wallPoint: Vector3, normal: Vector3): number {
    const rotation = orientationFromNormal(normal, instance.twistRadians);
    const projected = instance.baseFootprint.map((local) => local.clone()
      .applyQuaternion(rotation)
      .add(wallPoint)
      .project(camera));
    const xs = projected.map((point) => (point.x + 1) * renderer.domElement.clientWidth / 2);
    const ys = projected.map((point) => (1 - point.y) * renderer.domElement.clientHeight / 2);
    return clampTargetDiameter(Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ));
  }

  /** Stima rapporto degli assi e inclinazione dell'ellisse proiettando due tangenti alla parete. */
  function targetEllipse(instance: HoldSceneInstance, wallPoint: Vector3, normal: Vector3): {
    ratio: number;
    rotation: number;
  } {
    const tangentA = projectAxisOnTangent(new Vector3(1, 0, 0), normal, new Vector3(0, 1, 0));
    const tangentB = new Vector3().crossVectors(normal, tangentA).normalize();
    const radius = instance.baseDiameterMeters / 2;
    const center = projectWorldPoint(wallPoint, camera, renderer.domElement);
    const a = projectWorldPoint(wallPoint.clone().addScaledVector(tangentA, radius), camera, renderer.domElement);
    const b = projectWorldPoint(wallPoint.clone().addScaledVector(tangentB, radius), camera, renderer.domElement);
    const lengthA = Math.hypot(a.x - center.x, a.y - center.y);
    const lengthB = Math.hypot(b.x - center.x, b.y - center.y);
    const major = Math.max(lengthA, lengthB, 1e-6);
    const minor = Math.max(Math.min(lengthA, lengthB), 1);
    const endpoint = lengthA >= lengthB ? a : b;
    return { ratio: Math.min(1, minor / major), rotation: Math.atan2(endpoint.y - center.y, endpoint.x - center.x) };
  }

  /** Stima il footprint da hit periferici quando il centro del target cade in un foro. */
  function estimateTargetDiameterWithoutCenter(instance: HoldSceneInstance, point: ViewportPoint): number {
    for (const diameter of [160, 128, 96, 64, 48]) {
      for (const sample of targetSamples.slice(1)) {
        const hit = raycastWallAt({
          x: point.x + sample.x * diameter / 2,
          y: point.y + sample.y * diameter / 2,
        });
        if (hit) return targetDiameterPx(instance, hit.point, hit.normal);
      }
    }
    return 48;
  }

  /** Distingue una collisione identificata da un arresto numerico conservativo. */
  function pathResult(path: PosePathValidation): SceneActionResult {
    if (path.unresolved || !path.blocker) return result('blocked', 'Movimento arrestato: impossibile verificare un tratto del percorso.', 'path-unresolved');
    return result('blocked', path.blocker === 'wall'
      ? 'Movimento arrestato al contatto con la parete.'
      : 'Movimento arrestato al contatto con un\'altra presa.',
    path.blocker === 'wall' ? 'wall-collision' : 'hold-collision');
  }

  /** Delega la verifica fisica contando le query endpoint per la diagnostica della scena. */
  function validatePose(
    instance: HoldSceneInstance,
    translation: RAPIER.Vector,
    rotation: RAPIER.Rotation,
    outwardNormal?: RAPIER.Vector,
  ) {
    poseValidationCount += 1;
    return physics.validatePose(instance.physics, translation, rotation, outwardNormal);
  }

  /** Condivide il download del collider e rimuove dalla cache le richieste fallite. */
  function loadCollider(url: string): Promise<HoldColliderDocument> {
    let pending = colliderDocuments.get(url);
    if (!pending) {
      pending = fetchHoldCollider(url).catch((error) => {
        colliderDocuments.delete(url);
        throw error;
      });
      colliderDocuments.set(url, pending);
    }
    return pending;
  }

  const controller: WallSceneController = {
    dispose,
    /** Inserisce la presa con rollback di modello, binding e corpo fisico. */
    addHold: async (hold) => {
      if (disposed || failed) throw new Error('La scena non e disponibile.');
      if (holdInstances.has(hold.id) || pendingHolds.has(hold.id)) {
        throw new Error('La presa e gia presente nella scena.');
      }
      if (!hold.colliderUrl || hold.colliderStatus !== 'Ready') {
        throw new Error('Il collider della presa non e ancora disponibile.');
      }

      pendingHolds.add(hold.id);
      let model: HoldModelResource | undefined;
      let stagedObject: Group | undefined;
      let stagedPhysics: KinematicPhysicsObject | undefined;
      let stagedUnbind: (() => void) | undefined;
      const previousSelection = selectedHoldId;
      try {
        model = await loadHoldModel(hold);
        if (disposed || failed) throw new Error('La scena non e disponibile.');
        const colliderDocument = await loadCollider(hold.colliderUrl);
        if (disposed || failed) throw new Error('La scena non e disponibile.');
        const baseFootprint = computeBaseFootprint(colliderDocument.vertices);
        const baseDiameterMeters = computeBaseDiameter(baseFootprint);
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
        const initialNormal = new Vector3(0, 0, 1);
        const centralSpawn = frontReference.clone().add(initialNormal.clone().multiplyScalar(2));
        const physicsObject = physics.createKinematicObject(
          collider,
          centralSpawn,
          new Quaternion(),
        );
        stagedPhysics = physicsObject;
        let insertionPosition: Vector3 | undefined;
        const spawnResult = await findFirstAvailableSpawnCooperatively(spawnCandidates, (candidateOffset) => {
          if (disposed || failed) throw new Error('La scena non e disponibile.');
          const candidate = centralSpawn.clone().add(new Vector3(candidateOffset.x, candidateOffset.y, 0));
          physics.setKinematicTransform(physicsObject, candidate, physicsObject.body.rotation());
          if (!physics.hasIntersections(physicsObject)) {
            insertionPosition = candidate;
            return true;
          }
          return false;
        });
        if (disposed || failed) throw new Error('La scena non e disponibile.');
        if (!insertionPosition || !spawnResult) {
          throw new Error('Nessuna posizione iniziale libera disponibile.');
        }
        object.position.copy(insertionPosition);
        object.updateMatrix();
        scene.add(object);
        const unbind = physics.bindRenderingObject(physicsObject.body, object);
        stagedUnbind = unbind;
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
          physicalState: 'detached',
          attachmentNormal: null,
          currentNormal: initialNormal,
          initialRotation: object.quaternion.clone(),
          intersectsAtSpawn,
          pickPointLocal,
          spawnOffset: spawnResult.candidate,
          spawnCandidateIndex: spawnResult.index,
          contactPoint: null,
          contactFeatureId: null,
          twistRadians: 0,
          baseDiameterMeters,
          baseFootprint,
        });
        setSelection(hold.id);
        physics.step();
        render();
      } catch (error) {
        const staged = holdInstances.get(hold.id);
        holdInstances.delete(hold.id);
        if (selectedHoldId === hold.id) selectedHoldId = previousSelection && holdInstances.has(previousSelection) ? previousSelection : null;
        for (const release of [
          () => staged && setHighlighted(staged, false),
          () => stagedUnbind?.(),
          () => !disposed && stagedPhysics && physics.removeKinematicObject(stagedPhysics),
          () => stagedObject?.removeFromParent(),
          () => model?.dispose(),
          () => { const selected = selectedInstance(); if (selected && !exporting) setHighlighted(selected, true); },
        ]) {
          try { release(); } catch { /* Conserva l'errore originale e completa il rollback. */ }
        }
        throw error;
      } finally {
        pendingHolds.delete(hold.id);
      }
    },
    removeHold: (id) => {
      const instance = holdInstances.get(id);
      if (!instance) {
        return false;
      }
      if (selectedHoldId === id) {
        disposeTargetingShadow();
        cancelTransformDrag();
        setSelection(null);
      }
      instance.unbind();
      setHighlighted(instance, false);
      physics.removeKinematicObject(instance.physics);
      instance.object.removeFromParent();
      instance.model.dispose();
      holdInstances.delete(id);
      render();
      return true;
    },
    hasHold: (id) => holdInstances.has(id),
    selectedHoldId: () => selectedHoldId,
    clearSelection: () => setSelection(null),
    interactionSnapshot: getInteractionSnapshot,
    onInteractionChange: (listener) => {
      if (!failed && !disposed) interactionListeners.add(listener);
      listener(getInteractionSnapshot());
      return () => interactionListeners.delete(listener);
    },
    beginAttachTargeting: () => {
      const instance = selectedInstance();
      if (!instance || instance.physicalState !== 'detached') return result('not-available', 'Aggancio non disponibile.');
      interactionMode = 'attach-targeting';
      clearTarget();
      notifyInteraction();
      return result('applied', 'Seleziona un punto sulla parete.');
    },
    updateAttachTarget,
    commitAttachTarget,
    detachSelected,
    beginMoving: () => {
      const instance = selectedInstance();
      if (!instance || instance.physicalState !== 'attached') return result('not-available', 'Movimento non disponibile.');
      interactionMode = 'moving';
      targetPreview = null;
      notifyInteraction();
      return result('applied', 'Modalità spostamento attiva.');
    },
    moveSelected,
    beginMoveDrag,
    updateMoveDrag,
    commitMoveDrag,
    beginRotating: () => {
      const instance = selectedInstance();
      if (!instance || instance.physicalState !== 'attached') return result('not-available', 'Rotazione non disponibile.');
      interactionMode = 'rotating';
      targetPreview = null;
      notifyInteraction();
      return result('applied', 'Modalità rotazione attiva.');
    },
    rotateSelected,
    beginRotationDrag,
    updateRotationDrag,
    commitRotationDrag,
    cancelTransformDrag,
    cancelInteraction: () => {
      clearTarget();
      const hadDrag = dragSession !== null;
      cancelTransformDrag();
      interactionMode = 'idle';
      targetPreview = null;
      targetInvalidUntil = 0;
      if (!hadDrag) controls.enabled = true;
      notifyInteraction();
      render();
    },
    setOrbitEnabled: (enabled) => {
      controls.enabled = enabled;
      updateDebugState();
    },
    generateGuideImage: async () => {
      if (disposed || failed) throw new Error('La scena non e disponibile.');
      if (exporting) throw new Error('Esportazione gia in corso.');
      if (dragSession) throw new Error('Termina il trascinamento prima di generare l’immagine.');
      const selected = selectedHoldId ? holdInstances.get(selectedHoldId) : undefined;
      if (selected) setHighlighted(selected, false);
      const previewVisible = previewGroup.visible;
      previewGroup.visible = false;
      exporting = true;
      try {
        notifyInteraction();
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
        exporting = false;
        previewGroup.visible = previewVisible;
        const current = selectedInstance();
        if (!disposed && current) setHighlighted(current, true);
        notifyInteraction();
        render();
      }
    },
  };
  return {
    ...controller,
    addHold: activeCommand(controller.addHold, () => Promise.reject(new Error('La scena non e disponibile.'))),
    removeHold: activeCommand(controller.removeHold, () => false),
    clearSelection: activeCommand(controller.clearSelection, () => undefined),
    beginAttachTargeting: activeCommand(controller.beginAttachTargeting, unavailableAction),
    updateAttachTarget: activeCommand(controller.updateAttachTarget, () => null),
    commitAttachTarget: activeCommand(controller.commitAttachTarget, unavailableAction),
    detachSelected: activeCommand(controller.detachSelected, unavailableAction),
    beginMoving: activeCommand(controller.beginMoving, unavailableAction),
    moveSelected: activeCommand(controller.moveSelected, unavailableAction),
    beginMoveDrag: activeCommand(controller.beginMoveDrag, unavailableAction),
    updateMoveDrag: activeCommand(controller.updateMoveDrag, () => undefined),
    commitMoveDrag: activeCommand(controller.commitMoveDrag, unavailableAction),
    beginRotating: activeCommand(controller.beginRotating, unavailableAction),
    rotateSelected: activeCommand(controller.rotateSelected, unavailableAction),
    beginRotationDrag: activeCommand(controller.beginRotationDrag, unavailableAction),
    updateRotationDrag: activeCommand(controller.updateRotationDrag, () => undefined),
    commitRotationDrag: activeCommand(controller.commitRotationDrag, unavailableAction),
    cancelTransformDrag: activeCommand(controller.cancelTransformDrag, () => undefined),
    cancelInteraction: activeCommand(controller.cancelInteraction, () => undefined),
    setOrbitEnabled: activeCommand(controller.setOrbitEnabled, () => undefined),
    generateGuideImage: activeCommand(controller.generateGuideImage, () => Promise.reject(new Error('La scena non e disponibile.'))),
  };
  } catch (error) {
    dispose();
    throw error;
  }
}

/** Conserva l'ordine deterministico della griglia cedendo periodicamente il main thread. */
async function findFirstAvailableSpawnCooperatively<T>(
  candidates: readonly T[],
  isAvailable: (candidate: T, index: number) => boolean,
): Promise<{ readonly candidate: T; readonly index: number } | null> {
  let sliceStartedAt = performance.now();
  for (let index = 0; index < candidates.length; index += 1) {
    if (isAvailable(candidates[index], index)) return { candidate: candidates[index], index };
    if (performance.now() - sliceStartedAt >= 16) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      sliceStartedAt = performance.now();
    }
  }
  return null;
}

/** Crea una copia grafica trasparente condividendo geometrie e texture. */
function createShadow(source: Group, color = 0xffd436): Group {
  const shadow = source.clone(true);
  shadow.name = `${source.name}:shadow`;
  shadow.traverse((object) => {
    delete object.userData.holdModelId;
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const previews = materials.map((material) => {
      const clone = material.clone();
      clone.transparent = true;
      clone.opacity = 0.35;
      clone.depthTest = true;
      clone.depthWrite = false;
      if ('color' in clone && clone.color instanceof Color) clone.color.setHex(color);
      return clone;
    });
    object.material = Array.isArray(object.material) ? previews : previews[0];
  });
  return shadow;
}

/** Aggiorna il colore dei soli materiali preview clonati appartenenti alla shadow. */
function setShadowColor(shadow: Group, color: number): void {
  shadow.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if ('color' in material && material.color instanceof Color) material.color.setHex(color);
    });
  });
}

/** Rilascia soltanto i materiali preview e mantiene geometrie/texture condivise. */
function disposeShadow(shadow: Group): void {
  shadow.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
  shadow.removeFromParent();
}

/** Proietta un punto world in coordinate CSS relative al canvas corrente. */
function projectWorldPoint(point: Vector3, camera: PerspectiveCamera, canvas: HTMLCanvasElement): ViewportPoint {
  const projected = point.clone().project(camera);
  return {
    x: (projected.x + 1) * canvas.clientWidth / 2,
    y: (1 - projected.y) * canvas.clientHeight / 2,
  };
}

/** Calcola il diametro fisico della base posteriore dal collider locale della hold. */
function computeBaseFootprint(vertices: readonly number[]): Vector3[] {
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let index = 2; index < vertices.length; index += 3) {
    minZ = Math.min(minZ, vertices[index]);
    maxZ = Math.max(maxZ, vertices[index]);
  }
  const threshold = minZ + Math.max(0.002, (maxZ - minZ) * 0.02);
  let points: Vector3[] = [];
  for (let index = 0; index < vertices.length; index += 3) {
    if (vertices[index + 2] <= threshold) points.push(new Vector3(vertices[index], vertices[index + 1], vertices[index + 2]));
  }
  if (points.length < 3) {
    points = [];
    for (let index = 0; index < vertices.length; index += 3) points.push(new Vector3(vertices[index], vertices[index + 1], vertices[index + 2]));
  }
  return points;
}

/** Ricava dal footprint locale il diametro fisico usato per il campionamento di aggancio. */
function computeBaseDiameter(points: readonly Vector3[]): number {
  const bounds = new Box3();
  points.forEach((point) => bounds.expandByPoint(new Vector3(point.x, point.y, 0)));
  const size = bounds.getSize(new Vector3());
  return Math.max(Math.hypot(size.x, size.y), 0.01);
}

/** Proietta il bounding box world della hold in pixel CSS relativi al canvas. */
function projectObjectBounds(object: Object3D, camera: PerspectiveCamera, canvas: HTMLCanvasElement): ScreenRect {
  const bounds = new Box3().setFromObject(object);
  const size = canvas.getBoundingClientRect();
  const points = boxCorners(bounds).map((point) => point.project(camera));
  const visiblePoints = points.filter((point) => Number.isFinite(point.x)
    && Number.isFinite(point.y) && point.z >= -1 && point.z <= 1);
  if (visiblePoints.length === 0) return { left: 0, top: 0, right: 0, bottom: 0, visible: false };
  const xs = visiblePoints.map((point) => (point.x + 1) * size.width / 2);
  const ys = visiblePoints.map((point) => (1 - point.y) * size.height / 2);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
    visible: Math.max(...xs) >= 0 && Math.min(...xs) <= size.width
      && Math.max(...ys) >= 0 && Math.min(...ys) <= size.height,
  };
}

/** Espande un bounding box nei suoi otto vertici per la successiva proiezione a schermo. */
function boxCorners(bounds: Box3): Vector3[] {
  return [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) => new Vector3(x, y, z))));
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
    if (highlighted && instance.highlightedMaterials.has(mesh)) continue;
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
