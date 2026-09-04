import './style.css';
import type { HoldManifest } from './api/holdApi';
import { HoldDetailsModal } from './catalog/holdDetailsModal';
import { SessionCatalog } from './catalog/sessionCatalog';
import { HoldOverlay } from './interaction/holdOverlay';
import { createWallScene } from './scene/wallScene';
import { downloadGuideImage } from './export/guideImage';

/** Avvia scena, catalogo e ciclo di vita delle prese per la sessione corrente. */
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
        <nav class="topbar-actions" aria-label="Comandi tracciatura">
          <button type="button" data-generate-image disabled>Genera immagine</button>
        </nav>
        <p class="scene-status" role="status" data-scene-status>Caricamento parete...</p>
      </header>
      <div class="workspace-body">
        <aside class="catalog" aria-labelledby="catalog-title">
          <div class="catalog-heading">
            <div>
              <p class="eyebrow">Asset locali</p>
              <h2 id="catalog-title">Catalogo prese</h2>
            </div>
            <span class="catalog-count" data-catalog-count>0</span>
          </div>
          <p class="catalog-feedback" data-catalog-feedback aria-live="polite"></p>
          <div class="catalog-list" data-catalog-list></div>
        </aside>
        <section class="viewport" aria-label="Scena tridimensionale della parete" data-viewport>
        </section>
      </div>
    </main>
    <dialog class="details-dialog" data-details-dialog aria-labelledby="details-title">
      <header>
        <div>
          <p class="eyebrow">Anteprima 3D</p>
          <h2 id="details-title" data-details-title>Dettagli presa</h2>
        </div>
        <button type="button" class="icon-button" data-close-details aria-label="Chiudi dettagli">×</button>
      </header>
      <div class="details-viewport" data-details-viewport></div>
    </dialog>
  `;

  const viewport = requiredElement<HTMLElement>(app, '[data-viewport]');
  const status = requiredElement<HTMLElement>(app, '[data-scene-status]');
  const list = requiredElement<HTMLElement>(app, '[data-catalog-list]');
  const count = requiredElement<HTMLElement>(app, '[data-catalog-count]');
  const feedback = requiredElement<HTMLElement>(app, '[data-catalog-feedback]');
  const generateButton = requiredElement<HTMLButtonElement>(app, '[data-generate-image]');
  const details = new HoldDetailsModal(requiredElement<HTMLDialogElement>(app, '[data-details-dialog]'));
  const catalog = new SessionCatalog();

  try {
    const [scene] = await Promise.all([
      createWallScene(viewport, status),
      catalog.loadManifest(),
    ]);

    const renderCatalog = async (): Promise<void> => {
      const holds = await catalog.availableHolds();
      list.replaceChildren();
      count.textContent = holds.length.toString();
      if (holds.length === 0) {
        list.innerHTML = '<p class="catalog-empty">Tutte le prese sono in scena.</p>';
      }

      holds.forEach((hold) => {
        list.append(createHoldCard(
          hold,
          catalog,
          async () => {
            if (!catalog.use(hold.id)) {
              return;
            }
            feedback.textContent = `Caricamento ${hold.id}...`;
            list.querySelector<HTMLElement>(`[data-hold-id="${CSS.escape(hold.id)}"]`)?.remove();
            count.textContent = String(Math.max(0, Number(count.textContent) - 1));
            if (Number(count.textContent) === 0) {
              list.innerHTML = '<p class="catalog-empty">Tutte le prese sono in scena.</p>';
            }
            try {
              await scene.addHold(hold);
              feedback.textContent = `${hold.id} aggiunta alla scena.`;
            } catch (error) {
              catalog.release(hold.id);
              feedback.textContent = error instanceof Error ? error.message : 'Impossibile aggiungere la presa.';
              await renderCatalog();
            }
          },
          async () => {
            feedback.textContent = `Apertura dettagli ${hold.id}...`;
            try {
              await details.open(hold);
              feedback.textContent = '';
            } catch (error) {
              details.close();
              feedback.textContent = error instanceof Error ? error.message : 'Impossibile mostrare i dettagli.';
            }
          },
        ));
      });
    };
    generateButton.disabled = false;
    generateButton.addEventListener('click', async () => {
      if (generateButton.disabled) return;
      generateButton.disabled = true;
      document.documentElement.dataset.exporting = 'true';
      feedback.textContent = 'Generazione immagine guida...';
      try {
        const result = await scene.generateGuideImage();
        downloadGuideImage(result.blob);
        feedback.textContent = `Immagine guida generata (${result.width}×${result.height} px).`;
      } catch (error) {
        feedback.textContent = error instanceof Error ? error.message : 'Impossibile generare l’immagine guida.';
      } finally {
        delete document.documentElement.dataset.exporting;
        generateButton.disabled = false;
      }
    });

    const removeSelected = (): void => {
      const selectedId = scene.selectedHoldId();
      if (!selectedId || !scene.removeHold(selectedId)) {
        return;
      }
      catalog.release(selectedId);
      feedback.textContent = `${selectedId} riportata nel catalogo.`;
      void renderCatalog();
    };
    const showSelectedDetails = async (): Promise<void> => {
      const selectedId = scene.selectedHoldId();
      if (!selectedId) return;
      const hold = (await catalog.loadManifest()).find((candidate) => candidate.id === selectedId);
      if (!hold) {
        feedback.textContent = 'Dettagli della presa non disponibili.';
        return;
      }
      feedback.textContent = `Apertura dettagli ${hold.id}...`;
      try {
        await details.open(hold);
        feedback.textContent = '';
      } catch (error) {
        details.close();
        feedback.textContent = error instanceof Error ? error.message : 'Impossibile mostrare i dettagli.';
      }
    };
    const overlay = new HoldOverlay(viewport, {
      details: () => void showSelectedDetails(),
      attach: () => scene.beginAttachTargeting(),
      detach: () => scene.detachSelected(),
      moveMode: () => scene.beginMoving(),
      move: (direction) => scene.moveSelected(direction),
      beginMoveDrag: (direction, point, pointerId) => scene.beginMoveDrag(direction, point, pointerId),
      updateMoveDrag: (point, pointerId) => scene.updateMoveDrag(point, pointerId),
      commitMoveDrag: (pointerId) => scene.commitMoveDrag(pointerId),
      rotateMode: () => scene.beginRotating(),
      rotate: (direction, steps) => scene.rotateSelected(direction, steps),
      beginRotationDrag: (point, pointerId) => scene.beginRotationDrag(point, pointerId),
      updateRotationDrag: (point, pointerId) => scene.updateRotationDrag(point, pointerId),
      commitRotationDrag: (pointerId) => scene.commitRotationDrag(pointerId),
      cancelTransformDrag: () => scene.cancelTransformDrag(),
      remove: removeSelected,
      cancel: () => scene.cancelInteraction(),
      setOrbitEnabled: (enabled) => scene.setOrbitEnabled(enabled),
      feedback: (action) => { feedback.textContent = action.message; },
    });
    let lastActionResult = scene.interactionSnapshot().lastActionResult;
    scene.onInteractionChange((snapshot) => {
      overlay.update(snapshot);
      if (!document.documentElement.dataset.exporting) generateButton.disabled = snapshot.dragPreview !== null;
      if (snapshot.lastActionResult !== lastActionResult) {
        lastActionResult = snapshot.lastActionResult;
        if (lastActionResult) feedback.textContent = lastActionResult.message;
      }
      if (snapshot.selected) feedback.textContent ||= `${snapshot.selected.id} selezionata.`;
    });
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      overlay.cancel();
      scene.cancelInteraction();
      scene.clearSelection();
      feedback.textContent = 'Interazione annullata e presa deselezionata.';
    });
    window.addEventListener('blur', () => {
      overlay.cancel();
      scene.cancelInteraction();
    });

    await renderCatalog();
    window.addEventListener('beforeunload', () => void catalog.dispose(), { once: true });
  } catch (error) {
    status.textContent = 'Impossibile inizializzare l’applicazione.';
    status.dataset.state = 'error';
    feedback.textContent = error instanceof Error ? error.message : 'Errore durante l’inizializzazione.';
    throw error;
  }
}

/** Crea una card catalogo e avvia il caricamento cache della relativa preview. */
function createHoldCard(
  hold: HoldManifest,
  catalog: SessionCatalog,
  onUse: () => Promise<void>,
  onDetails: () => Promise<void>,
): HTMLElement {
  const card = document.createElement('article');
  card.className = 'hold-card';
  card.dataset.holdId = hold.id;
  card.innerHTML = `
    <div class="hold-preview" data-preview><span>Anteprima non disponibile</span></div>
    <div class="hold-card-body">
      <div>
        <h3>${hold.id}</h3>
        <span class="collider-state" data-state="${hold.colliderStatus.toLowerCase()}">${hold.colliderStatus}</span>
      </div>
      <div class="hold-actions">
        <button type="button" data-use ${hold.colliderStatus !== 'Ready' ? 'disabled' : ''}>Utilizza</button>
        <button type="button" class="secondary" data-details>Dettagli</button>
      </div>
    </div>
  `;

  const preview = requiredElement<HTMLElement>(card, '[data-preview]');
  void catalog.loadPreview(hold).then((url) => {
    if (!url || !preview.isConnected) {
      return;
    }
    const image = new Image();
    image.src = url;
    image.alt = `Anteprima ${hold.id}`;
    image.loading = 'eager';
    preview.replaceChildren(image);
  });

  requiredElement<HTMLButtonElement>(card, '[data-use]').addEventListener('click', () => void onUse());
  requiredElement<HTMLButtonElement>(card, '[data-details]').addEventListener('click', () => void onDetails());
  return card;
}

/** Restituisce un elemento obbligatorio oppure interrompe il bootstrap in modo esplicito. */
function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Elemento applicativo non disponibile: ${selector}`);
  }
  return element;
}

void bootstrap();
