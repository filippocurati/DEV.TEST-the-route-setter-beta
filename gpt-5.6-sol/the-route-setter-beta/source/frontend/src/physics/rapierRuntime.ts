import RAPIER from '@dimforge/rapier3d-compat';

let initialization: Promise<typeof RAPIER> | undefined;

/** Inizializza una sola volta il modulo WASM ufficiale Rapier e ne restituisce l'API. */
export function initializeRapier(): Promise<typeof RAPIER> {
  initialization ??= RAPIER.init().then(() => RAPIER);
  return initialization;
}

export type RapierApi = typeof RAPIER;
