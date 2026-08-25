import { Vector2 } from 'three';

export const SPAWN_GRID_STEP_METERS = 0.30;
export const SPAWN_GRID_MARGIN_METERS = 0.30;

/** Parametri del dominio rettangolare di ricerca sul piano frontale della parete. */
export interface SpawnGridOptions {
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly step?: number;
  readonly margin?: number;
}

/**
 * Genera offset deterministici: centro, distanza crescente, poi senso orario dall'alto.
 * Gli offset restano entro il bounding frontale esteso dal margine configurato.
 */
export function createSpawnCandidateOffsets(options: SpawnGridOptions): readonly Vector2[] {
  const step = options.step ?? SPAWN_GRID_STEP_METERS;
  const margin = options.margin ?? SPAWN_GRID_MARGIN_METERS;
  if (!(step > 0) || options.halfWidth < 0 || options.halfHeight < 0 || margin < 0) {
    throw new Error('Configurazione griglia spawn non valida.');
  }

  const maxColumn = Math.floor((options.halfWidth + margin) / step);
  const maxRow = Math.floor((options.halfHeight + margin) / step);
  const candidates: Vector2[] = [];
  for (let row = -maxRow; row <= maxRow; row += 1) {
    for (let column = -maxColumn; column <= maxColumn; column += 1) {
      candidates.push(new Vector2(column * step, row * step));
    }
  }

  return candidates.sort((left, right) => {
    const distanceDifference = left.lengthSq() - right.lengthSq();
    if (Math.abs(distanceDifference) > Number.EPSILON) return distanceDifference;
    const angleDifference = clockwiseAngleFromUp(left) - clockwiseAngleFromUp(right);
    if (Math.abs(angleDifference) > Number.EPSILON) return angleDifference;
    if (left.y !== right.y) return right.y - left.y;
    return left.x - right.x;
  });
}

/** Restituisce il primo candidato valido oppure null dopo l'esaurimento dell'intero dominio. */
export function findFirstAvailableSpawn<T>(
  candidates: readonly T[],
  isAvailable: (candidate: T, index: number) => boolean,
): { readonly candidate: T; readonly index: number } | null {
  for (let index = 0; index < candidates.length; index += 1) {
    if (isAvailable(candidates[index], index)) return { candidate: candidates[index], index };
  }
  return null;
}

/** Converte un vettore in angolo crescente in senso orario a partire dall'asse +Y. */
function clockwiseAngleFromUp(vector: Vector2): number {
  if (vector.lengthSq() === 0) return -1;
  const angle = Math.atan2(vector.x, vector.y);
  return angle < 0 ? angle + Math.PI * 2 : angle;
}
