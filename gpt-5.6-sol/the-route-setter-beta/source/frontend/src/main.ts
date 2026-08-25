import './style.css';
import type { HoldManifest } from './api/holdApi';
import { HoldDetailsModal } from './catalog/holdDetailsModal';
import { SessionCatalog } from './catalog/sessionCatalog';
import {
  commandForKeyboardCode,
  ContinuousCommandController,
  isEditableTarget,
  type HoldCommand,
} from './input/holdCommands';
import { createWallScene } from './scene/wallScene';

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
          <button type="button" disabled title="Disponibile in una fase successiva">Genera immagine</button>
          <button type="button" data-remove-hold disabled>Rimuovi presa</button>
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
          <div class="hold-controls" data-hold-controls aria-label="Comandi presa selezionata">
            <div class="move-pad" aria-label="Spostamento presa">
              <button type="button" data-hold-command="move-up" aria-label="Sposta presa su" title="Su (Freccia su)">↑</button>
              <button type="button" data-hold-command="move-left" aria-label="Sposta presa a sinistra" title="Sinistra (Freccia sinistra)">←</button>
              <button type="button" data-hold-command="move-down" aria-label="Sposta presa giù" title="Giù (Freccia giù)">↓</button>
              <button type="button" data-hold-command="move-right" aria-label="Sposta presa a destra" title="Destra (Freccia destra)">→</button>
            </div>
            <div class="rotate-controls" aria-label="Rotazione presa">
              <button type="button" data-hold-command="rotate-counterclockwise" aria-label="Ruota presa in senso antiorario" title="Antiorario (Q)">↶</button>
              <button type="button" data-hold-command="rotate-clockwise" aria-label="Ruota presa in senso orario" title="Orario (E)">↷</button>
            </div>
            <p>Frecce: sposta 1 cm · Q/E: ruota 1°</p>
          </div>
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
  const removeButton = requiredElement<HTMLButtonElement>(app, '[data-remove-hold]');
  const commandButtons = [...app.querySelectorAll<HTMLButtonElement>('[data-hold-command]')];
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
            await renderCatalog();
            try {
              await scene.addHold(hold);
              feedback.textContent = `${hold.id} aggiunta alla scena.`;
              removeButton.disabled = false;
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

    const updateSelectionUi = (selectedId: string | null): void => {
      removeButton.disabled = selectedId === null;
      commandButtons.forEach((button) => { button.disabled = selectedId === null; });
      if (selectedId) feedback.textContent = `${selectedId} selezionata.`;
    };
    scene.onSelectionChange(updateSelectionUi);

    const continuousCommands = new ContinuousCommandController();
    const executeCommand = (command: HoldCommand): void => {
      if (scene.executeCommand(command)) {
        const selected = scene.selectedHoldId();
        if (selected) feedback.textContent = `${selected}: comando applicato.`;
      }
    };
    commandButtons.forEach((button) => {
      const command = button.dataset.holdCommand as HoldCommand;
      const key = `button:${command}`;
      button.addEventListener('mousedown', (event) => {
        if (button.disabled || event.button !== 0) return;
        event.preventDefault();
        continuousCommands.start(key, command, executeCommand);
      });
      const stop = (): void => continuousCommands.stop(key);
      window.addEventListener('mouseup', stop);
      button.addEventListener('pointerdown', (event) => {
        if (button.disabled || event.pointerType === 'mouse') return;
        event.preventDefault();
        continuousCommands.start(key, command, executeCommand);
      });
      window.addEventListener('pointerup', (event) => {
        if (event.pointerType !== 'mouse') stop();
      });
      window.addEventListener('pointercancel', (event) => {
        if (event.pointerType !== 'mouse') stop();
      });
    });
    window.addEventListener('keydown', (event) => {
      const command = commandForKeyboardCode(event.code);
      if (!command || isEditableTarget(event.target)) return;
      event.preventDefault();
      continuousCommands.start(`key:${event.code}`, command, executeCommand);
    });
    window.addEventListener('keyup', (event) => continuousCommands.stop(`key:${event.code}`));
    window.addEventListener('blur', () => continuousCommands.stopAll());

    removeButton.addEventListener('click', () => {
      const selectedId = scene.selectedHoldId();
      if (!selectedId || !scene.removeHold(selectedId)) {
        return;
      }
      catalog.release(selectedId);
      feedback.textContent = `${selectedId} riportata nel catalogo.`;
      void renderCatalog();
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
