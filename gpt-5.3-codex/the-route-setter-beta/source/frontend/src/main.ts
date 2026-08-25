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

if (
  !statusElement ||
  !sceneMount ||
  !catalogList ||
  !removeSelectedButton ||
  !detailsModal ||
  !detailsCanvas ||
  !detailsTitle ||
  !detailsCloseButton
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
};

const holdState = new Map<string, HoldRuntime>();
const holdInstances = new Map<string, THREE.Object3D>();
let selectedHoldId: string | null = null;

let detailsRenderer: THREE.WebGLRenderer | null = null;
let detailsScene: THREE.Scene | null = null;
let detailsCamera: THREE.PerspectiveCamera | null = null;
let detailsModel: THREE.Object3D | null = null;
let detailsAnimationHandle = 0;

let holdsCatalogFetchCount = 0;
let holdModelUrlFetchCount = 0;
let holdTemplateLoadCount = 0;
let detailsLoadCount = 0;

void bootstrap();

async function bootstrap(): Promise<void> {
  try {
    const [wall, holds] = await Promise.all([fetchWall(apiBaseUrl), getHoldsCatalog(apiBaseUrl)]);
    const wallModelUrl = toClientAssetUrl(wall.modelUrl, apiBaseUrl);
    if (!wallModelUrl) {
      throw new Error('URL modello parete non valido.');
    }
    const wallScene = await createWallScene(requiredSceneMount, wallModelUrl);

    for (const manifest of holds) {
      holdState.set(manifest.id, {
        manifest,
        modelUrl: null,
        template: null,
        inScene: false
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
    updateRuntimeMetrics();

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

  const wallBounds = new THREE.Box3().setFromObject(wallScene.wallRoot);
  const center = wallBounds.getCenter(new THREE.Vector3());
  const index = holdInstances.size;
  const lateralOffset = ((index % 8) - 3.5) * 0.13;
  const verticalOffset = Math.floor(index / 8) * 0.12;

  instance.position.set(center.x + lateralOffset, center.y + 0.4 + verticalOffset, center.z + 0.02);
  instance.rotation.set(0, 0, 0);
  instance.scale.set(1, 1, 1);

  wallScene.scene.add(instance);

  runtime.inScene = true;
  holdInstances.set(holdId, instance);
  selectedHoldId = holdId;
  requiredRemoveSelectedButton.disabled = false;
  requiredSceneMount.dataset.sceneHolds = holdInstances.size.toString();
  requiredSceneMount.dataset.selectedHold = selectedHoldId;
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

  selectedHoldId = holdInstances.size > 0 ? [...holdInstances.keys()][0] : null;
  requiredRemoveSelectedButton.disabled = selectedHoldId === null;
  requiredSceneMount.dataset.sceneHolds = holdInstances.size.toString();
  requiredSceneMount.dataset.selectedHold = selectedHoldId ?? '';
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

  const modelUrl = await ensureHoldModelUrl(holdId);
  if (!modelUrl) {
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
  detailsRenderer.setSize(requiredDetailsCanvas.clientWidth, requiredDetailsCanvas.clientHeight, false);
  requiredDetailsCanvas.appendChild(detailsRenderer.domElement);

  detailsScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(1.5, 2, 1.2);
  detailsScene.add(key);

  detailsModel = await loadHoldSceneWithFallback(runtime, modelUrl);
  detailsScene.add(detailsModel);
  detailsLoadCount += 1;
  updateRuntimeMetrics();

  fitCameraOnObject(detailsCamera, detailsModel);

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

  if (detailsModel) {
    disposeObject3D(detailsModel);
    detailsModel = null;
  }

  if (detailsRenderer) {
    detailsRenderer.dispose();
    if (detailsRenderer.domElement.parentElement) {
      detailsRenderer.domElement.parentElement.removeChild(detailsRenderer.domElement);
    }
    detailsRenderer = null;
  }

  detailsScene = null;
  detailsCamera = null;
}

function fitCameraOnObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  const distance = Math.max(0.8, (maxDimension * 1.6) / Math.tan((Math.PI * camera.fov) / 360));

  camera.position.set(center.x, center.y + size.y * 0.1, center.z + distance);
  camera.lookAt(center);
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      if (Array.isArray(node.material)) {
        for (const material of node.material) {
          material.dispose();
        }
      } else {
        node.material.dispose();
      }
    }
  });
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

function updateRuntimeMetrics(): void {
  requiredSceneMount.dataset.catalogFetches = holdsCatalogFetchCount.toString();
  requiredSceneMount.dataset.modelUrlFetches = holdModelUrlFetchCount.toString();
  requiredSceneMount.dataset.templateLoads = holdTemplateLoadCount.toString();
  requiredSceneMount.dataset.detailsLoads = detailsLoadCount.toString();
}
