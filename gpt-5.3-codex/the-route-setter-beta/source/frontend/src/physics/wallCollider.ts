import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface PhysicsFoundation {
  world: RAPIER.World;
  wallRigidBody: RAPIER.RigidBody;
  wallCollider: RAPIER.Collider;
  kinematicRigidBody: RAPIER.RigidBody;
  kinematicCollider: RAPIER.Collider;
  characterController: RAPIER.KinematicCharacterController;
}

export async function createPhysicsFoundation(rootObject: THREE.Object3D): Promise<PhysicsFoundation> {
  await RAPIER.init();

  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const wallRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

  const { vertices, indices } = extractWorldTriangles(rootObject);
  const wallCollider = world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indices)
      .setFriction(0)
      .setRestitution(0),
    wallRigidBody
  );

  const wallBounds = new THREE.Box3().setFromObject(rootObject);
  const wallCenter = wallBounds.getCenter(new THREE.Vector3());
  const wallSize = wallBounds.getSize(new THREE.Vector3());

  const kinematicRigidBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        wallCenter.x,
        wallCenter.y + Math.max(0.12, wallSize.y * 0.1),
        wallCenter.z + Math.max(0.2, wallSize.z * 0.6)
      )
      .setCcdEnabled(true)
  );

  const kinematicCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.05, 0.05, 0.05)
      .setFriction(0)
      .setRestitution(0),
    kinematicRigidBody
  );

  const characterController = world.createCharacterController(0.001);
  characterController.setSlideEnabled(true);
  characterController.disableAutostep();
  characterController.disableSnapToGround();
  characterController.setApplyImpulsesToDynamicBodies(false);

  return {
    world,
    wallRigidBody,
    wallCollider,
    kinematicRigidBody,
    kinematicCollider,
    characterController
  };
}

export function createKinematicVisualMesh(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const material = new THREE.MeshStandardMaterial({
    color: '#ff9f43',
    transparent: true,
    opacity: 0
  });

  return new THREE.Mesh(geometry, material);
}

export function stepPhysicsAndSyncVisual(
  foundation: PhysicsFoundation,
  visualMesh: THREE.Object3D,
  desiredTranslationDelta: THREE.Vector3
): void {
  foundation.characterController.computeColliderMovement(foundation.kinematicCollider, desiredTranslationDelta);

  const movement = foundation.characterController.computedMovement();
  const current = foundation.kinematicRigidBody.translation();

  foundation.kinematicRigidBody.setNextKinematicTranslation({
    x: current.x + movement.x,
    y: current.y + movement.y,
    z: current.z + movement.z
  });

  foundation.world.step();
  syncRigidBodyToVisual(foundation.kinematicRigidBody, visualMesh);
}

function syncRigidBodyToVisual(rigidBody: RAPIER.RigidBody, visualMesh: THREE.Object3D): void {
  const translation = rigidBody.translation();
  const rotation = rigidBody.rotation();

  visualMesh.position.set(translation.x, translation.y, translation.z);
  visualMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
}

function extractWorldTriangles(rootObject: THREE.Object3D): { vertices: Float32Array; indices: Uint32Array } {
  const vertexList: number[] = [];
  const indexList: number[] = [];
  let globalVertexOffset = 0;

  rootObject.updateWorldMatrix(true, true);

  rootObject.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const geometry = child.geometry;
    const positionAttribute = geometry.getAttribute('position');
    if (!positionAttribute || positionAttribute.itemSize !== 3) {
      return;
    }

    const localVertex = new THREE.Vector3();
    const worldVertex = new THREE.Vector3();

    for (let index = 0; index < positionAttribute.count; index++) {
      localVertex.fromBufferAttribute(positionAttribute, index);
      worldVertex.copy(localVertex).applyMatrix4(child.matrixWorld);

      vertexList.push(worldVertex.x, worldVertex.y, worldVertex.z);
    }

    if (geometry.index) {
      const indices = geometry.index.array;
      for (let index = 0; index < indices.length; index++) {
        indexList.push(Number(indices[index]) + globalVertexOffset);
      }
    } else {
      for (let index = 0; index < positionAttribute.count; index++) {
        indexList.push(index + globalVertexOffset);
      }
    }

    globalVertexOffset += positionAttribute.count;
  });

  if (vertexList.length === 0 || indexList.length < 3) {
    throw new Error('Impossibile costruire il collider TriMesh della parete: geometria non valida.');
  }

  return {
    vertices: new Float32Array(vertexList),
    indices: new Uint32Array(indexList)
  };
}
