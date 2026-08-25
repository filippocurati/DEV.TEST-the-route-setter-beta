import type { Vector3 } from 'three';

/** Limita uno spostamento verso la parete mantenendo il pivot fuori dal margine frontale. */
export function limitMovementToFrontSurface(
  currentPosition: Vector3,
  frontReference: Vector3,
  localNormal: Vector3,
  desiredDistance: number,
  safetyMargin = 0.001,
): number {
  if (desiredDistance >= 0) return desiredDistance;
  const signedDistance = currentPosition.clone().sub(frontReference).dot(localNormal);
  return Math.max(desiredDistance, safetyMargin - signedDistance);
}
