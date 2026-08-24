import { fetchHoldManifest, type HoldManifest } from '../api/holdApi';

/** Stato catalogo mantenuto esclusivamente in memoria per la sessione browser. */
export class SessionCatalog {
  private manifestPromise: Promise<readonly HoldManifest[]> | undefined;
  private readonly previewPromises = new Map<string, Promise<string | null>>();
  private readonly usedIds = new Set<string>();

  /** Restituisce il manifest, effettuando al massimo una richiesta per istanza/sessione. */
  loadManifest(): Promise<readonly HoldManifest[]> {
    this.manifestPromise ??= fetchHoldManifest();
    return this.manifestPromise;
  }

  /** Restituisce soltanto le prese non attualmente istanziate nella scena. */
  async availableHolds(): Promise<readonly HoldManifest[]> {
    return (await this.loadManifest()).filter((hold) => !this.usedIds.has(hold.id));
  }

  /** Carica e memorizza una preview come object URL, senza ripetere la richiesta. */
  loadPreview(hold: HoldManifest): Promise<string | null> {
    if (!hold.previewUrl) {
      return Promise.resolve(null);
    }

    let preview = this.previewPromises.get(hold.id);
    if (!preview) {
      preview = fetch(hold.previewUrl)
        .then((response) => {
          if (!response.ok) {
            return null;
          }
          return response.blob();
        })
        .then((blob) => blob ? URL.createObjectURL(blob) : null)
        .catch(() => null);
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

  /** Rilascia gli object URL delle preview alla chiusura della sessione. */
  async dispose(): Promise<void> {
    for (const preview of this.previewPromises.values()) {
      const url = await preview;
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
    this.previewPromises.clear();
  }
}
