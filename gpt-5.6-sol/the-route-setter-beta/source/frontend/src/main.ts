import './style.css';
import { createWallScene } from './scene/wallScene';

/** Avvia l'applicazione e rende visibile un errore non tecnico in caso di inizializzazione fallita. */
async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) {
    throw new Error('Contenitore applicativo non disponibile.');
  }

  app.innerHTML = `
    <main class="workspace" aria-labelledby="page-title">
      <header class="topbar">
        <div>
          <p class="eyebrow">Indoor climbing workspace</p>
          <h1 id="page-title">The Route Setter</h1>
        </div>
        <p class="scene-status" role="status" data-scene-status>Caricamento parete...</p>
      </header>
      <section class="viewport" aria-label="Scena tridimensionale della parete" data-viewport></section>
    </main>
  `;

  const viewport = app.querySelector<HTMLElement>('[data-viewport]');
  const status = app.querySelector<HTMLElement>('[data-scene-status]');
  if (!viewport || !status) {
    throw new Error('Elementi della scena non disponibili.');
  }

  try {
    await createWallScene(viewport, status);
  } catch (error) {
    status.textContent = 'Impossibile caricare la parete.';
    status.dataset.state = 'error';
    throw error;
  }
}

void bootstrap();
