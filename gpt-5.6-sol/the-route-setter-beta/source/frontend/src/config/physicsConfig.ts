/** Parametri fisici della sessione; il file pubblico usa millimetri per evitare ambiguita. */
export interface PhysicsConfig {
  readonly wallPenetrationToleranceMm: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = Object.freeze({ wallPenetrationToleranceMm: 5 });
export const HOLD_PENETRATION_TOLERANCE_METERS = 0.001;

/** Accetta soltanto una soglia parete numerica finita tra 1 e 10 mm, estremi inclusi. */
export function parsePhysicsConfig(value: unknown): PhysicsConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => key !== 'wallPenetrationToleranceMm')
    || !('wallPenetrationToleranceMm' in value)
    || typeof value.wallPenetrationToleranceMm !== 'number'
    || !Number.isFinite(value.wallPenetrationToleranceMm)
    || value.wallPenetrationToleranceMm < 1 || value.wallPenetrationToleranceMm > 10) {
    throw new Error('Configurazione fisica non valida: la tolleranza parete deve essere un numero tra 1 e 10 mm.');
  }
  return Object.freeze({ wallPenetrationToleranceMm: value.wallPenetrationToleranceMm });
}

/** Legge la configurazione runtime una volta nel bootstrap, senza usare cache HTTP. */
export async function loadPhysicsConfig(): Promise<PhysicsConfig> {
  let value: unknown;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}physics-config.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP');
    value = await response.json();
  } catch {
    throw new Error('Impossibile leggere la configurazione fisica. Verificare il file physics-config.json e ricaricare la pagina.');
  }
  return parsePhysicsConfig(value);
}
