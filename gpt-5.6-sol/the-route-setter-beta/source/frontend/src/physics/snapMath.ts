import { Quaternion, Vector3 } from 'three';

export const SNAP_DISTANCE_METERS = 0.05;
export const DETACH_DISTANCE_METERS = 0.25;
const NORMAL_EPSILON = 1e-8;

/** Contatto minimo usato per il tie-break stabile. */
export interface ContactCandidate {
  readonly distance: number;
  readonly featureId: number;
}

/** Lo snap è consentito soltanto entro la soglia inclusiva di 5 cm. */
export function isWithinSnapDistance(distance: number): boolean {
  return Number.isFinite(distance) && distance >= 0 && distance <= SNAP_DISTANCE_METERS;
}

/** Ordina contatti per distanza e poi per feature id, rendendo stabile ogni parità. */
export function selectDeterministicContact<T extends ContactCandidate>(candidates: readonly T[]): T | null {
  return [...candidates]
    .filter((candidate) => Number.isFinite(candidate.distance) && candidate.distance >= 0)
    .sort((left, right) => left.distance - right.distance || left.featureId - right.featureId)[0] ?? null;
}

/** Risolve la normale con fallback triangolo -> ultima valida -> asse mondo. */
export function resolveContactNormal(
  triangleNormal: Vector3 | null | undefined,
  lastValidNormal: Vector3 | null | undefined,
  worldFallback = new Vector3(0, 0, 1),
): Vector3 {
  for (const candidate of [triangleNormal, lastValidNormal, worldFallback]) {
    if (candidate && isValidNormal(candidate)) return candidate.clone().normalize();
  }
  return new Vector3(0, 0, 1);
}

/** Proietta un asse vista sul piano tangente con fallback deterministico. */
export function projectAxisOnTangent(axis: Vector3, normal: Vector3, fallbackAxis: Vector3): Vector3 {
  const projected = axis.clone().addScaledVector(normal, -axis.dot(normal));
  if (projected.lengthSq() > NORMAL_EPSILON) return projected.normalize();
  const fallback = fallbackAxis.clone().addScaledVector(normal, -fallbackAxis.dot(normal));
  if (fallback.lengthSq() > NORMAL_EPSILON) return fallback.normalize();
  return new Vector3(1, 0, 0).cross(normal).normalize();
}

/** Orienta l'asse locale +Z della hold sulla normale, applicando poi il twist richiesto. */
export function orientationFromNormal(normal: Vector3, twistRadians = 0): Quaternion {
  const normalized = resolveContactNormal(normal, null);
  const alignment = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normalized);
  const twist = new Quaternion().setFromAxisAngle(normalized, twistRadians);
  return twist.multiply(alignment).normalize();
}

/** Calcola il twist firmato intorno alla normale tra orientamento base e corrente. */
export function addTwistAroundNormal(
  current: Quaternion,
  normal: Vector3,
  deltaRadians: number,
): Quaternion {
  return new Quaternion().setFromAxisAngle(normal, deltaRadians).multiply(current).normalize();
}

/** Trasporta l'orientamento sulla nuova normale usando la rotazione minima fra le due superfici. */
export function transportOrientationToNormal(
  orientation: Quaternion,
  fromNormal: Vector3,
  toNormal: Vector3,
): Quaternion {
  const source = resolveContactNormal(fromNormal, null);
  const target = resolveContactNormal(toNormal, source);
  const transport = new Quaternion().setFromUnitVectors(source, target);
  return transport.multiply(orientation).normalize();
}

/** Ricava il twist firmato dell'orientamento rispetto all'allineamento canonico sulla normale. */
export function twistFromOrientation(orientation: Quaternion, normal: Vector3): number {
  const normalized = resolveContactNormal(normal, null);
  const alignment = orientationFromNormal(normalized);
  const relative = orientation.clone().multiply(alignment.invert()).normalize();
  const signedSin = relative.x * normalized.x + relative.y * normalized.y + relative.z * normalized.z;
  let angle = 2 * Math.atan2(signedSin, relative.w);
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Accetta soltanto normali finite e con modulo sufficiente alla normalizzazione. */
function isValidNormal(normal: Vector3): boolean {
  return Number.isFinite(normal.x)
    && Number.isFinite(normal.y)
    && Number.isFinite(normal.z)
    && normal.lengthSq() > NORMAL_EPSILON;
}
