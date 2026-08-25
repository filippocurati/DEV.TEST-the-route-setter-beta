import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fetchHoldModelUrl, fetchHolds, type HoldManifest } from './api/holdsApi';
import { fetchWall } from './api/wallApi';
import { createWallScene } from './scene/wallScene';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="app-shell">
    <header class="app-header">
      <div>
        <h1>The Route Setter Beta</h1>
        <p id="status">Inizializzazione scena 3D...</p>
      </div>
      <div class="top-actions">
        <button id="generate-image" type="button">Genera immagine</button>
        <button id="remove-selected" type="button" disabled>Rimuovi presa</button>
      </div>
    </header>
    <section class="command-panel" aria-label="Comandi hold">
      <div class="command-group">
        <span>Trasla (1 cm)</span>
        <button id="cmd-left" type="button">Sinistra</button>
        <button id="cmd-right" type="button">Destra</button>
        <button id="cmd-up" type="button">Su</button>
        <button id="cmd-down" type="button">Giu</button>
        <button id="cmd-forward" type="button">Avanti</button>
        <button id="cmd-backward" type="button">Indietro</button>
      </div>
      <div class="command-group">
        <span>Ruota (1 grado)</span>
        <button id="cmd-rotate-ccw" type="button">Ruota -</button>
        <button id="cmd-rotate-cw" type="button">Ruota +</button>
      </div>
      <p class="shortcut-hint">Shortcut: frecce = trasla su piano parete, SHIFT+Freccia Su/Giu = avanti/indietro, A/D = ruota.</p>
    </section>
    <section class="workspace-layout">
      <aside class="catalog-panel">
        <h2>Catalogo prese</h2>
        <div id="catalog-list" class="catalog-list" aria-label="Catalogo hold"></div>
      </aside>
      <section class="viewport-panel">
        <div id="scene-mount" aria-label="Viewport 3D"></div>
      </section>
    </section>
    <div id="details-modal" class="details-modal hidden" role="dialog" aria-modal="true" aria-label="Dettagli hold">
      <div class="details-content">
        <div class="details-header">
          <h3 id="details-title">Dettagli hold</h3>
          <button id="details-close" type="button">Chiudi</button>
        </div>
        <div id="details-canvas" class="details-canvas"></div>
      </div>
    </div>
  </main>
`;

const statusElement = document.querySelector<HTMLParagraphElement>('#status');
const sceneMount = document.querySelector<HTMLDivElement>('#scene-mount');
const catalogList = document.querySelector<HTMLDivElement>('#catalog-list');
const removeSelectedButton = document.querySelector<HTMLButtonElement>('#remove-selected');
const detailsModal = document.querySelector<HTMLDivElement>('#details-modal');
const detailsCanvas = document.querySelector<HTMLDivElement>('#details-canvas');
const detailsTitle = document.querySelector<HTMLHeadingElement>('#details-title');
const detailsCloseButton = document.querySelector<HTMLButtonElement>('#details-close');
const cmdLeftButton = document.querySelector<HTMLButtonElement>('#cmd-left');
const cmdRightButton = document.querySelector<HTMLButtonElement>('#cmd-right');
const cmdUpButton = document.querySelector<HTMLButtonElement>('#cmd-up');
const cmdDownButton = document.querySelector<HTMLButtonElement>('#cmd-down');
const cmdForwardButton = document.querySelector<HTMLButtonElement>('#cmd-forward');
const cmdBackwardButton = document.querySelector<HTMLButtonElement>('#cmd-backward');
const cmdRotateCcwButton = document.querySelector<HTMLButtonElement>('#cmd-rotate-ccw');
const cmdRotateCwButton = document.querySelector<HTMLButtonElement>('#cmd-rotate-cw');

if (
  !statusElement ||
  !sceneMount ||
  !catalogList ||
  !removeSelectedButton ||
  !detailsModal ||
  !detailsCanvas ||
  !detailsTitle ||
  !detailsCloseButton ||
  !cmdLeftButton ||
  !cmdRightButton ||
  !cmdUpButton ||
  !cmdDownButton ||
  !cmdForwardButton ||
  !cmdBackwardButton ||
  !cmdRotateCcwButton ||
  !cmdRotateCwButton
) {
  throw new Error('Markup applicazione non valido.');
}

const requiredStatusElement = statusElement;
const requiredSceneMount = sceneMount;
const requiredCatalogList = catalogList;
const requiredRemoveSelectedButton = removeSelectedButton;
const requiredDetailsModal = detailsModal;
const requiredDetailsCanvas = detailsCanvas;
const requiredDetailsTitle = detailsTitle;
const requiredDetailsCloseButton = detailsCloseButton;
const requiredCmdLeftButton = cmdLeftButton;
const requiredCmdRightButton = cmdRightButton;
const requiredCmdUpButton = cmdUpButton;
const requiredCmdDownButton = cmdDownButton;
const requiredCmdForwardButton = cmdForwardButton;
const requiredCmdBackwardButton = cmdBackwardButton;
const requiredCmdRotateCcwButton = cmdRotateCcwButton;
const requiredCmdRotateCwButton = cmdRotateCwButton;

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
const gltfLoader = new GLTFLoader();
const previewPlaceholder =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><rect width="320" height="160" fill="%23e6edf5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23556a80" font-family="Segoe UI" font-size="16">PREV_ non disponibile</text></svg>';

let holdsCatalogPromise: Promise<HoldManifest[]> | null = null;

type HoldRuntime = {
  manifest: HoldManifest;
  modelUrl: string | null;
  template: THREE.Object3D | null;
  inScene: boolean;
  initialRotation: THREE.Euler;
  state: 'pre-snap' | 'post-snap';
};

const holdState = new Map<string, HoldRuntime>();
const holdInstances = new Map<string, THREE.Object3D>();
let selectedHelper: THREE.BoxHelper | null = null;
let selectedHoldId: string | null = null;
let sceneController: Awaited<ReturnType<typeof createWallScene>> | null = null;
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

let detailsRenderer: THREE.WebGLRenderer | null = null;
let detailsScene: THREE.Scene | null = null;
let detailsCamera: THREE.PerspectiveCamera | null = null;
let detailsModel: THREE.Object3D | null = null;
let detailsAnimationHandle = 0;
let detailsResizeObserver: ResizeObserver | null = null;

let holdsCatalogFetchCount = 0;
let holdModelUrlFetchCount = 0;
let holdTemplateLoadCount = 0;
let detailsLoadCount = 0;

let activeContinuousCommand: number | null = null;
let keyboardCommandTimer: number | null = null;

const TRANSLATION_STEP = 0.01;
const ROTATION_STEP = Math.PI / 180;
const SPAWN_OFFSET_Z = 2.0;
const SPAWN_GRID_STEP = 0.3;
const SPAWN_BOUNDING_MARGIN = 2.0;
const SPAWN_MAX_RING = 16;

void bootstrap();

async function bootstrap(): Promise<void> {
  try {
    const [wall, holds] = await Promise.all([fetchWall(apiBaseUrl), getHoldsCatalog(apiBaseUrl)]);
    const wallModelUrl = toClientAssetUrl(wall.modelUrl, apiBaseUrl);
    if (!wallModelUrl) {
      throw new Error('URL modello parete non valido.');
    }
    const wallScene = await createWallScene(requiredSceneMount, wallModelUrl);
    sceneController = wallScene;

    for (const manifest of holds) {
      holdState.set(manifest.id, {
        manifest,
        modelUrl: null,
        template: null,
        inScene: false,
        initialRotation: new THREE.Euler(0, 0, 0),
        state: 'pre-snap'
      });
    }

    renderCatalog(wallScene);

    requiredSceneMount.dataset.physics = 'ready';
    requiredSceneMount.dataset.colliderType = wallScene.physics.wallCollider.shapeType().toString();
    requiredSceneMount.dataset.gravity = JSON.stringify(wallScene.physics.world.gravity);
    requiredSceneMount.dataset.kinematicController = 'ready';
    requiredSceneMount.dataset.networkLoop = 'none';
    requiredSceneMount.dataset.sceneHolds = '0';
    requiredSceneMount.dataset.selectedHold = '';
    requiredSceneMount.dataset.detailsOpen = 'false';
    requiredSceneMount.dataset.selectionActive = 'false';
    requiredSceneMount.dataset.selectedState = '';
    requiredSceneMount.dataset.spawnCancelled = '';
    requiredSceneMount.dataset.spawnDistance = '';
    requiredSceneMount.dataset.spawnCandidateRank = '';
    updateRuntimeMetrics();

    wallScene.renderer.domElement.addEventListener('pointerdown', (event) => {
      pickHoldAtPointer(event, wallScene);
    });

    bindCommandButtons();
    bindKeyboardShortcuts();

    requiredRemoveSelectedButton.addEventListener('click', () => {
      if (!selectedHoldId) {
        return;
      }

      removeHoldFromScene(selectedHoldId, wallScene);
      renderCatalog(wallScene);
    });

    requiredDetailsCloseButton.addEventListener('click', () => {
      closeDetailsModal();
    });

    requiredDetailsModal.addEventListener('click', (event) => {
      if (event.target === requiredDetailsModal) {
        closeDetailsModal();
      }
    });

    requiredStatusElement.textContent = 'Parete caricata. Catalogo pronto. OrbitControls attivi (orbit, zoom, pan).';
  } catch (error) {
    console.error(error);
    requiredStatusElement.textContent = 'Errore durante il caricamento della parete.';
  }
}

function renderCatalog(wallScene: Awaited<ReturnType<typeof createWallScene>>): void {
  requiredCatalogList.innerHTML = '';

  const availableHolds = [...holdState.values()]
    .filter((runtime) => !runtime.inScene)
    .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));

  for (const runtime of availableHolds) {
    const card = document.createElement('article');
    card.className = 'hold-card';
    card.dataset.holdId = runtime.manifest.id;

    const title = document.createElement('h3');
    title.textContent = runtime.manifest.id;

    const preview = document.createElement('img');
    preview.alt = `Anteprima ${runtime.manifest.id}`;
    preview.loading = 'lazy';
    preview.src = toClientAssetUrl(runtime.manifest.previewUrl, apiBaseUrl) ?? previewPlaceholder;
    preview.className = 'hold-preview';

    const actions = document.createElement('div');
    actions.className = 'hold-actions';

    const useButton = document.createElement('button');
    useButton.type = 'button';
    useButton.textContent = 'Utilizza';
    useButton.dataset.action = 'use';
    useButton.addEventListener('click', async () => {
      try {
        await useHold(runtime.manifest.id, wallScene);
        renderCatalog(wallScene);
      } catch (error) {
        console.error(error);
        requiredStatusElement.textContent = `Errore durante uso hold ${runtime.manifest.id}.`;
      }
    });

    const detailsButton = document.createElement('button');
    detailsButton.type = 'button';
    detailsButton.textContent = 'Dettagli';
    detailsButton.dataset.action = 'details';
    detailsButton.addEventListener('click', async () => {
      try {
        await openDetailsModal(runtime.manifest.id);
      } catch (error) {
        console.error(error);
        requiredStatusElement.textContent = `Errore durante apertura dettagli ${runtime.manifest.id}.`;
      }
    });

    actions.appendChild(useButton);
    actions.appendChild(detailsButton);

    card.appendChild(title);
    card.appendChild(preview);
    card.appendChild(actions);
    requiredCatalogList.appendChild(card);
  }

  requiredSceneMount.dataset.catalogAvailable = availableHolds.length.toString();
}

async function useHold(holdId: string, wallScene: Awaited<ReturnType<typeof createWallScene>>): Promise<void> {
  const runtime = holdState.get(holdId);
  if (!runtime || runtime.inScene) {
    return;
  }

  const template = await ensureHoldTemplateLoaded(holdId);
  const instance = template.clone(true);
  instance.name = `hold-instance-${holdId}`;

  const spawn = computeInitialSpawnPosition(wallScene.wallRoot, instance);
  if (!spawn) {
    requiredSceneMount.dataset.spawnCancelled = 'reference-undetermined';
    requiredStatusElement.textContent = `Inserimento annullato per ${holdId}: riferimento frontale non determinabile.`;
    return;
  }

  instance.position.copy(spawn.position);
  instance.rotation.set(0, 0, 0);
  instance.scale.set(1, 1, 1);

  if (!isPositionValid(instance, instance.position)) {
    requiredSceneMount.dataset.spawnCancelled = 'occupied-or-penetrating';
    requiredStatusElement.textContent = `Inserimento annullato per ${holdId}: posizione occupata o compenetrante.`;
    return;
  }

  wallScene.scene.add(instance);

  runtime.inScene = true;
  runtime.initialRotation = instance.rotation.clone();
  runtime.state = 'pre-snap';
  holdInstances.set(holdId, instance);
  selectHold(holdId, wallScene);
  requiredSceneMount.dataset.sceneHolds = holdInstances.size.toString();
  requiredSceneMount.dataset.spawnCancelled = '';
  requiredSceneMount.dataset.spawnDistance = spawn.distance.toFixed(3);
  requiredSceneMount.dataset.spawnCandidateRank = spawn.candidateRank.toString();
}

function removeHoldFromScene(holdId: string, wallScene: Awaited<ReturnType<typeof createWallScene>>): void {
  const runtime = holdState.get(holdId);
  const instance = holdInstances.get(holdId);

  if (!runtime || !instance) {
    return;
  }

  wallScene.scene.remove(instance);
  holdInstances.delete(holdId);
  runtime.inScene = false;
  runtime.state = 'pre-snap';

  if (selectedHoldId === holdId) {
    clearSelection();
  }

  const fallbackSelection = holdInstances.size > 0 ? [...holdInstances.keys()][0] : null;
  if (fallbackSelection && sceneController) {
    selectHold(fallbackSelection, sceneController);
  } else {
    clearSelection();
  }

  requiredSceneMount.dataset.sceneHolds = holdInstances.size.toString();
}

async function ensureHoldTemplateLoaded(holdId: string): Promise<THREE.Object3D> {
  const runtime = holdState.get(holdId);
  if (!runtime) {
    throw new Error(`Hold non trovata: ${holdId}`);
  }

  if (runtime.template) {
    return runtime.template;
  }

  const modelUrl = await ensureHoldModelUrl(holdId);
  if (!modelUrl) {
    throw new Error(`Model URL non disponibile per ${holdId}`);
  }

  runtime.template = await loadHoldSceneWithFallback(runtime, modelUrl);
  holdTemplateLoadCount += 1;
  updateRuntimeMetrics();
  return runtime.template;
}

async function openDetailsModal(holdId: string): Promise<void> {
  closeDetailsModal();

  const runtime = holdState.get(holdId);
  if (!runtime) {
    throw new Error(`Hold non trovata: ${holdId}`);
  }

  const template = await ensureHoldTemplateLoaded(holdId);
  if (!template) {
    throw new Error(`Dettagli non disponibili per ${holdId}`);
  }

  requiredDetailsTitle.textContent = `Dettagli ${holdId}`;
  requiredDetailsModal.classList.remove('hidden');
  requiredSceneMount.dataset.detailsOpen = 'true';

  detailsScene = new THREE.Scene();
  detailsScene.background = new THREE.Color('#f2f5f8');
  detailsCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  detailsCamera.position.set(0, 0.3, 1.2);

  detailsRenderer = new THREE.WebGLRenderer({ antialias: true });
  detailsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  requiredDetailsCanvas.appendChild(detailsRenderer.domElement);

  resizeDetailsViewport();
  detailsResizeObserver = new ResizeObserver(() => {
    resizeDetailsViewport();
  });
  detailsResizeObserver.observe(requiredDetailsCanvas);

  detailsScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(1.5, 2, 1.2);
  detailsScene.add(key);

  detailsModel = createDetailsPreviewModel(template);
  detailsScene.add(detailsModel);
  detailsLoadCount += 1;
  updateRuntimeMetrics();

  const modelBox = new THREE.Box3().setFromObject(detailsModel);
  const modelSize = modelBox.getSize(new THREE.Vector3());
  requiredSceneMount.dataset.detailsModelSize = Math.max(modelSize.x, modelSize.y, modelSize.z).toFixed(6);

  const fitMetrics = fitCameraOnObject(detailsCamera, detailsModel);
  requiredSceneMount.dataset.detailsCameraNear = fitMetrics.near.toFixed(6);
  requiredSceneMount.dataset.detailsCameraFar = fitMetrics.far.toFixed(6);
  requiredSceneMount.dataset.detailsInFrustum = isObjectVisibleInCameraFrustum(detailsModel, detailsCamera) ? 'true' : 'false';

  const render = () => {
    if (!detailsScene || !detailsRenderer || !detailsCamera || !detailsModel) {
      return;
    }

    detailsModel.rotation.y += 0.01;
    detailsRenderer.render(detailsScene, detailsCamera);
    detailsAnimationHandle = requestAnimationFrame(render);
  };

  render();
}

function closeDetailsModal(): void {
  requiredDetailsModal.classList.add('hidden');
  requiredSceneMount.dataset.detailsOpen = 'false';

  if (detailsAnimationHandle !== 0) {
    cancelAnimationFrame(detailsAnimationHandle);
    detailsAnimationHandle = 0;
  }

  detailsModel = null;

  if (detailsRenderer) {
    detailsRenderer.dispose();
    if (detailsRenderer.domElement.parentElement) {
      detailsRenderer.domElement.parentElement.removeChild(detailsRenderer.domElement);
    }
    detailsRenderer = null;
  }

  if (detailsResizeObserver) {
    detailsResizeObserver.disconnect();
    detailsResizeObserver = null;
  }

  detailsScene = null;
  detailsCamera = null;
}

function fitCameraOnObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D
): { near: number; far: number } {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  const distance = Math.max(0.8, (maxDimension * 1.6) / Math.tan((Math.PI * camera.fov) / 360));

  camera.position.set(center.x, center.y + size.y * 0.1, center.z + distance);
  camera.near = Math.max(0.001, distance / 1000);
  camera.far = Math.max(200, distance * 12 + maxDimension * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(center);

  return {
    near: camera.near,
    far: camera.far
  };
}

function createDetailsPreviewModel(template: THREE.Object3D): THREE.Object3D {
  const cloned = template.clone(true);
  cloned.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(cloned);
  if (box.isEmpty()) {
    return cloned;
  }

  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  wrapper.add(cloned);
  cloned.position.sub(center);

  return wrapper;
}

function computeInitialSpawnPosition(
  wallRoot: THREE.Object3D,
  holdInstance: THREE.Object3D
): { position: THREE.Vector3; frontReference: THREE.Vector3; distance: number; candidateRank: number } | null {
  const wallBounds = new THREE.Box3().setFromObject(wallRoot);
  if (wallBounds.isEmpty()) {
    return null;
  }

  const center = wallBounds.getCenter(new THREE.Vector3());
  const frontReference = new THREE.Vector3(center.x, center.y, wallBounds.max.z);

  const initialCandidate = frontReference.clone().add(new THREE.Vector3(0, 0, SPAWN_OFFSET_Z));
  if (isPositionValid(holdInstance, initialCandidate)) {
    return {
      position: initialCandidate,
      frontReference,
      distance: initialCandidate.distanceTo(frontReference),
      candidateRank: 0
    };
  }

  const xMin = wallBounds.min.x - SPAWN_BOUNDING_MARGIN;
  const xMax = wallBounds.max.x + SPAWN_BOUNDING_MARGIN;
  const yMin = wallBounds.min.y - SPAWN_BOUNDING_MARGIN;
  const yMax = wallBounds.max.y + SPAWN_BOUNDING_MARGIN;

  const orderedOffsets = buildDeterministicGridOffsets(SPAWN_MAX_RING);
  let rank = 1;
  for (const offset of orderedOffsets) {
    const candidate = new THREE.Vector3(
      frontReference.x + offset.x,
      frontReference.y + offset.y,
      frontReference.z + SPAWN_OFFSET_Z
    );

    if (candidate.x < xMin || candidate.x > xMax || candidate.y < yMin || candidate.y > yMax) {
      continue;
    }

    if (!isPositionValid(holdInstance, candidate)) {
      rank += 1;
      continue;
    }

    return {
      position: candidate,
      frontReference,
      distance: candidate.distanceTo(frontReference),
      candidateRank: rank
    };
  }

  return null;
}

function buildDeterministicGridOffsets(maxRing: number): THREE.Vector2[] {
  const offsets: THREE.Vector2[] = [];

  for (let ring = 1; ring <= maxRing; ring += 1) {
    const cardinal = [
      new THREE.Vector2(0, ring),
      new THREE.Vector2(ring, 0),
      new THREE.Vector2(0, -ring),
      new THREE.Vector2(-ring, 0)
    ];

    for (const offset of cardinal) {
      offsets.push(offset.multiplyScalar(SPAWN_GRID_STEP));
    }

    const diagonal: THREE.Vector2[] = [];
    for (let x = -ring; x <= ring; x += 1) {
      for (let y = -ring; y <= ring; y += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== ring) {
          continue;
        }

        if ((x === 0 && Math.abs(y) === ring) || (y === 0 && Math.abs(x) === ring)) {
          continue;
        }

        diagonal.push(new THREE.Vector2(x, y));
      }
    }

    diagonal.sort((a, b) => {
      const angleA = Math.atan2(a.y, a.x);
      const angleB = Math.atan2(b.y, b.x);
      const normalizedA = angleA < 0 ? angleA + Math.PI * 2 : angleA;
      const normalizedB = angleB < 0 ? angleB + Math.PI * 2 : angleB;
      return normalizedB - normalizedA;
    });

    for (const offset of diagonal) {
      offsets.push(offset.multiplyScalar(SPAWN_GRID_STEP));
    }
  }

  return offsets;
}

function isObjectVisibleInCameraFrustum(object: THREE.Object3D, camera: THREE.PerspectiveCamera): boolean {
  camera.updateMatrixWorld(true);
  const projectionMatrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(projectionMatrix);

  const box = new THREE.Box3().setFromObject(object);
  return frustum.intersectsBox(box);
}

function toClientAssetUrl(relativeOrAbsoluteUrl: string | null, baseUrl: string): string | null {
  if (!relativeOrAbsoluteUrl) {
    return null;
  }

  const isAbsoluteHttp = /^https?:\/\//i.test(relativeOrAbsoluteUrl);

  if (!isAbsoluteHttp) {
    if (relativeOrAbsoluteUrl.startsWith('/')) {
      return relativeOrAbsoluteUrl;
    }

    return `${baseUrl}${relativeOrAbsoluteUrl}`;
  }

  try {
    const url = new URL(relativeOrAbsoluteUrl);
    if (url.pathname.startsWith('/data/')) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return relativeOrAbsoluteUrl;
  } catch {
    return relativeOrAbsoluteUrl;
  }
}

function getHoldsCatalog(baseUrl: string): Promise<HoldManifest[]> {
  if (!holdsCatalogPromise) {
    holdsCatalogFetchCount += 1;
    updateRuntimeMetrics();
    holdsCatalogPromise = fetchHolds(baseUrl);
  }

  return holdsCatalogPromise;
}

async function ensureHoldModelUrl(holdId: string): Promise<string | null> {
  const runtime = holdState.get(holdId);
  if (!runtime) {
    return null;
  }

  if (!runtime.modelUrl) {
    const manifestUrl = toClientAssetUrl(runtime.manifest.modelUrl, apiBaseUrl);

    holdModelUrlFetchCount += 1;
    updateRuntimeMetrics();

    try {
      runtime.modelUrl = toClientAssetUrl(await fetchHoldModelUrl(apiBaseUrl, holdId), apiBaseUrl) ?? manifestUrl;
    } catch {
      runtime.modelUrl = manifestUrl;
    }
  }

  return runtime.modelUrl;
}

async function loadHoldSceneWithFallback(runtime: HoldRuntime, preferredUrl: string): Promise<THREE.Object3D> {
  try {
    const gltf = await gltfLoader.loadAsync(preferredUrl);
    runtime.modelUrl = preferredUrl;
    return gltf.scene;
  } catch {
    const fallbackUrl = toClientAssetUrl(runtime.manifest.modelUrl, apiBaseUrl);
    if (!fallbackUrl || fallbackUrl === preferredUrl) {
      throw new Error(`Impossibile caricare il modello della hold ${runtime.manifest.id}.`);
    }

    const gltf = await gltfLoader.loadAsync(fallbackUrl);
    runtime.modelUrl = fallbackUrl;
    return gltf.scene;
  }
}

function pickHoldAtPointer(event: PointerEvent, wallScene: Awaited<ReturnType<typeof createWallScene>>): void {
  const rect = wallScene.renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNdc, wallScene.camera);

  const candidates = [...holdInstances.values()];
  const intersections = raycaster.intersectObjects(candidates, true);
  if (intersections.length === 0) {
    return;
  }

  const selected = intersections[0].object;
  const hitEntry = [...holdInstances.entries()].find(([, root]) => root === selected || root.children.includes(selected) || root.getObjectById(selected.id));
  if (!hitEntry) {
    return;
  }

  if (selectedHoldId === hitEntry[0]) {
    return;
  }

  selectHold(hitEntry[0], wallScene);
}

function selectHold(holdId: string, wallScene: Awaited<ReturnType<typeof createWallScene>>): void {
  const instance = holdInstances.get(holdId);
  if (!instance) {
    clearSelection();
    return;
  }

  selectedHoldId = holdId;
  requiredRemoveSelectedButton.disabled = false;
  requiredSceneMount.dataset.selectedHold = holdId;
  requiredSceneMount.dataset.selectionActive = 'true';
  requiredSceneMount.dataset.selectedState = holdState.get(holdId)?.state ?? '';

  if (selectedHelper && selectedHelper.parent) {
    selectedHelper.parent.remove(selectedHelper);
    selectedHelper.dispose();
  }

  selectedHelper = new THREE.BoxHelper(instance, 0x2f80ed);
  wallScene.scene.add(selectedHelper);
}

function clearSelection(): void {
  selectedHoldId = null;
  requiredRemoveSelectedButton.disabled = true;
  requiredSceneMount.dataset.selectedHold = '';
  requiredSceneMount.dataset.selectionActive = 'false';
  requiredSceneMount.dataset.selectedState = '';

  if (selectedHelper && selectedHelper.parent) {
    selectedHelper.parent.remove(selectedHelper);
    selectedHelper.dispose();
  }
  selectedHelper = null;
}

function bindCommandButtons(): void {
  bindContinuousButton(requiredCmdLeftButton, () => translateSelected(-TRANSLATION_STEP, 0, 0));
  bindContinuousButton(requiredCmdRightButton, () => translateSelected(TRANSLATION_STEP, 0, 0));
  bindContinuousButton(requiredCmdUpButton, () => translateSelected(0, TRANSLATION_STEP, 0));
  bindContinuousButton(requiredCmdDownButton, () => translateSelected(0, -TRANSLATION_STEP, 0));
  bindContinuousButton(requiredCmdForwardButton, () => moveSelectedAlongNormal(TRANSLATION_STEP));
  bindContinuousButton(requiredCmdBackwardButton, () => moveSelectedAlongNormal(-TRANSLATION_STEP));
  bindContinuousButton(requiredCmdRotateCcwButton, () => rotateSelected(-ROTATION_STEP));
  bindContinuousButton(requiredCmdRotateCwButton, () => rotateSelected(ROTATION_STEP));
}

function bindContinuousButton(button: HTMLButtonElement, action: () => void): void {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    action();
    stopContinuousCommand();
    activeContinuousCommand = window.setInterval(() => {
      action();
    }, 80);
  });

  const stop = () => stopContinuousCommand();
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('pointercancel', stop);
}

function stopContinuousCommand(): void {
  if (activeContinuousCommand !== null) {
    clearInterval(activeContinuousCommand);
    activeContinuousCommand = null;
  }
}

function bindKeyboardShortcuts(): void {
  window.addEventListener('keydown', (event) => {
    const action = resolveKeyboardAction(event);
    if (!action) {
      return;
    }

    event.preventDefault();
    action();

    if (keyboardCommandTimer === null) {
      keyboardCommandTimer = window.setInterval(() => {
        action();
      }, 80);
    }
  });

  window.addEventListener('keyup', () => {
    if (keyboardCommandTimer !== null) {
      clearInterval(keyboardCommandTimer);
      keyboardCommandTimer = null;
    }
  });
}

function resolveKeyboardAction(event: KeyboardEvent): (() => void) | null {
  if (event.shiftKey && event.code === 'ArrowUp') {
    return () => moveSelectedAlongNormal(TRANSLATION_STEP);
  }

  if (event.shiftKey && event.code === 'ArrowDown') {
    return () => moveSelectedAlongNormal(-TRANSLATION_STEP);
  }

  if (event.code === 'ArrowLeft') {
    return () => translateSelected(-TRANSLATION_STEP, 0, 0);
  }

  if (event.code === 'ArrowRight') {
    return () => translateSelected(TRANSLATION_STEP, 0, 0);
  }

  if (event.code === 'ArrowUp') {
    return () => translateSelected(0, TRANSLATION_STEP, 0);
  }

  if (event.code === 'ArrowDown') {
    return () => translateSelected(0, -TRANSLATION_STEP, 0);
  }

  if (event.code === 'KeyA') {
    return () => rotateSelected(-ROTATION_STEP);
  }

  if (event.code === 'KeyD') {
    return () => rotateSelected(ROTATION_STEP);
  }

  return null;
}

function translateSelected(dx: number, dy: number, dz: number): void {
  const instance = getSelectedInstance();
  if (!instance) {
    return;
  }

  const next = instance.position.clone().add(new THREE.Vector3(dx, dy, dz));
  if (isPositionValid(instance, next)) {
    instance.position.copy(next);
    refreshSelectionHelper();
  }
}

function rotateSelected(deltaRadians: number): void {
  const instance = getSelectedInstance();
  if (!instance) {
    return;
  }

  instance.rotation.z += deltaRadians;
  refreshSelectionHelper();
}

function moveSelectedAlongNormal(delta: number): void {
  const instance = getSelectedInstance();
  if (!instance) {
    return;
  }

  const state = selectedHoldId ? holdState.get(selectedHoldId) : null;
  const normal = new THREE.Vector3(0, 0, 1);
  const step = normal.multiplyScalar(delta);
  const nextPosition = instance.position.clone().add(step);

  if (!isPositionValid(instance, nextPosition)) {
    return;
  }

  instance.position.copy(nextPosition);
  if (state) {
    state.state = 'pre-snap';
    requiredSceneMount.dataset.selectedState = state.state;
  }
  refreshSelectionHelper();
}

function isPositionValid(instance: THREE.Object3D, candidatePosition: THREE.Vector3): boolean {
  const original = instance.position.clone();
  instance.position.copy(candidatePosition);
  instance.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(instance);

  const wallDepthLimit = (() => {
    if (!sceneController) {
      return null;
    }
    return new THREE.Box3().setFromObject(sceneController.wallRoot);
  })();

  if (wallDepthLimit && box.intersectsBox(wallDepthLimit)) {
    instance.position.copy(original);
    instance.updateWorldMatrix(true, true);
    return false;
  }

  if (wallDepthLimit && candidatePosition.z > wallDepthLimit.max.z + 2.25) {
    instance.position.copy(original);
    instance.updateWorldMatrix(true, true);
    return false;
  }

  for (const other of holdInstances.values()) {
    if (other === instance) {
      continue;
    }

    const otherBox = new THREE.Box3().setFromObject(other);
    if (box.intersectsBox(otherBox)) {
      instance.position.copy(original);
      instance.updateWorldMatrix(true, true);
      return false;
    }
  }

  instance.position.copy(original);
  instance.updateWorldMatrix(true, true);
  return true;
}

function getSelectedInstance(): THREE.Object3D | null {
  if (!selectedHoldId) {
    return null;
  }

  return holdInstances.get(selectedHoldId) ?? null;
}

function refreshSelectionHelper(): void {
  if (selectedHelper) {
    selectedHelper.update();
  }
}

function updateRuntimeMetrics(): void {
  requiredSceneMount.dataset.catalogFetches = holdsCatalogFetchCount.toString();
  requiredSceneMount.dataset.modelUrlFetches = holdModelUrlFetchCount.toString();
  requiredSceneMount.dataset.templateLoads = holdTemplateLoadCount.toString();
  requiredSceneMount.dataset.detailsLoads = detailsLoadCount.toString();
}

function resizeDetailsViewport(): void {
  if (!detailsRenderer || !detailsCamera) {
    return;
  }

  const width = Math.max(320, requiredDetailsCanvas.clientWidth);
  const height = Math.max(220, requiredDetailsCanvas.clientHeight);

  detailsRenderer.setSize(width, height, false);
  detailsCamera.aspect = width / height;
  detailsCamera.updateProjectionMatrix();
}
