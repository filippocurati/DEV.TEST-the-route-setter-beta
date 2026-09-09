import { fetchHoldManifest, fetchHoldReadiness, type HoldManifest } from '../api/holdApi';
import { fetchBlob } from '../api/http';

/** Stato catalogo mantenuto esclusivamente in memoria per la sessione browser. */
export class SessionCatalog {
  private manifestPromise: Promise<readonly HoldManifest[]> | undefined;
  private readonly previewPromises = new Map<string, Promise<string | null>>();
  private readonly usedIds = new Set<string>();
  private readonly readiness = new Map<string, { colliderStatus: HoldManifest['colliderStatus']; colliderUrl: string | null }>();
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private disposed = false;

  /** L'errore viene notificato al reporter condiviso senza interrompere il catalogo. */
  constructor(private readonly onError: (error: unknown) => void = () => {}) {}

  /** Restituisce il manifest, effettuando al massimo una richiesta per istanza/sessione. */
  loadManifest(): Promise<readonly HoldManifest[]> {
    this.manifestPromise ??= fetchHoldManifest();
    return this.manifestPromise;
  }

  /** Restituisce soltanto le prese non attualmente istanziate nella scena. */
  async availableHolds(): Promise<readonly HoldManifest[]> {
    return (await this.loadManifest()).filter((hold) => !this.usedIds.has(hold.id))
      .map(hold => ({ ...hold, ...this.readiness.get(hold.id) }));
  }

  /** Aggiorna soltanto le prese in attesa, con polling seriale e backoff massimo di 30 secondi. */
  async watchReadiness(onChange: () => void | Promise<void>): Promise<void> {
    const manifest = await this.loadManifest();
    if (this.disposed || this.timer !== undefined || this.controller) return;
    let failures = 0;
    const pending = (): boolean => manifest.some(hold =>
      ['Pending', 'Missing'].includes(this.readiness.get(hold.id)?.colliderStatus ?? hold.colliderStatus));
    const schedule = (): void => {
      if (this.disposed || !pending()) return;
      this.timer = setTimeout(() => { this.timer = undefined; void poll(); }, Math.min(30_000, 1000 * 2 ** failures));
    };
    const poll = async (): Promise<void> => {
      this.controller = new AbortController();
      const timeout = setTimeout(() => this.controller?.abort(), 10_000);
      try {
        const states = await fetchHoldReadiness(this.controller.signal);
        if (this.disposed) return;
        let changed = false;
        for (const hold of manifest) {
          const previous = this.readiness.get(hold.id) ?? hold;
          if (!['Pending', 'Missing'].includes(previous.colliderStatus)) continue;
          const state = states.find(candidate => candidate.id === hold.id);
          if (state && (state.colliderStatus !== previous.colliderStatus || state.colliderUrl !== previous.colliderUrl)) {
            this.readiness.set(hold.id, { colliderStatus: state.colliderStatus, colliderUrl: state.colliderUrl });
            changed = true;
          }
        }
        failures = 0;
        if (changed) await onChange();
      } catch (error) {
        failures = Math.min(failures + 1, 5);
        if (!this.disposed) this.onError(error);
      } finally {
        clearTimeout(timeout);
        this.controller = undefined;
        schedule();
      }
    };
    schedule();
  }

  /** Carica e memorizza una preview come object URL, senza ripetere la richiesta. */
  loadPreview(hold: HoldManifest): Promise<string | null> {
    if (!hold.previewUrl) {
      return Promise.resolve(null);
    }

    let preview = this.previewPromises.get(hold.id);
    if (!preview) {
      preview = fetchBlob(hold.previewUrl, 'Impossibile caricare anteprima della presa.')
        .then(blob => this.disposed ? null : URL.createObjectURL(blob))
        .catch(error => { if (!this.disposed) this.onError(error); return null; });
      this.previewPromises.set(hold.id, preview);
    }
    return preview;
  }

  /** Marca una presa come usata, impedendo una seconda istanza contemporanea. */
  use(id: string): boolean {
    if (this.usedIds.has(id)) {
      return false;
    }
    this.usedIds.add(id);
    return true;
  }

  /** Riporta una presa tra quelle disponibili. */
  release(id: string): void {
    this.usedIds.delete(id);
  }

  /** Verifica se una presa è attualmente in scena. */
  isUsed(id: string): boolean {
    return this.usedIds.has(id);
  }

  /** Ferma il polling e rilascia gli object URL, attendendo le preview ancora in caricamento. */
  async dispose(): Promise<void> {
    this.disposed = true;
    clearTimeout(this.timer);
    this.controller?.abort();
    for (const preview of this.previewPromises.values()) {
      const url = await preview;
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
    this.previewPromises.clear();
  }
}
