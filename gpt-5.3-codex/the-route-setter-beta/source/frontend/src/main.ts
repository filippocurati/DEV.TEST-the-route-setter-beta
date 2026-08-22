import './style.css';
import { fetchWall } from './api/wallApi';
import { createWallScene } from './scene/wallScene';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="app-shell">
    <header class="app-header">
      <h1>The Route Setter Beta</h1>
      <p id="status">Inizializzazione scena 3D...</p>
    </header>
    <section class="viewport-panel">
      <div id="scene-mount" aria-label="Viewport 3D"></div>
    </section>
  </main>
`;

const statusElement = document.querySelector<HTMLParagraphElement>('#status');
const sceneMount = document.querySelector<HTMLDivElement>('#scene-mount');

if (!statusElement || !sceneMount) {
  throw new Error('Markup applicazione non valido.');
}

const requiredStatusElement = statusElement;
const requiredSceneMount = sceneMount;

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

void bootstrap();

async function bootstrap(): Promise<void> {
  try {
    const wall = await fetchWall(apiBaseUrl);
    const wallModelUrl = wall.modelUrl.startsWith('http') ? wall.modelUrl : `${apiBaseUrl}${wall.modelUrl}`;
    const wallScene = await createWallScene(requiredSceneMount, wallModelUrl);

    requiredSceneMount.dataset.physics = 'ready';
    requiredSceneMount.dataset.colliderType = wallScene.physics.wallCollider.shape.type.toString();

    requiredStatusElement.textContent = 'Parete caricata. OrbitControls attivi (orbit, zoom, pan).';
  } catch (error) {
    console.error(error);
    requiredStatusElement.textContent = 'Errore durante il caricamento della parete.';
  }
}
