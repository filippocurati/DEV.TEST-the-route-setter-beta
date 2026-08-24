import type RAPIER from '@dimforge/rapier3d-compat';
import type { Object3D } from 'three';

/** Associazione locale tra una trasformazione fisica Rapier e un oggetto grafico Three.js. */
export interface PhysicsRenderBinding {
  readonly body: RAPIER.RigidBody;
  readonly object: Object3D;
}

/** Copia posizione e rotazione dai corpi Rapier alle mesh senza effettuare operazioni di rete. */
export function synchronizePhysicsToRendering(bindings: Iterable<PhysicsRenderBinding>): void {
  for (const binding of bindings) {
    const translation = binding.body.translation();
    const rotation = binding.body.rotation();
    binding.object.position.set(translation.x, translation.y, translation.z);
    binding.object.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    binding.object.updateMatrix();
  }
}
