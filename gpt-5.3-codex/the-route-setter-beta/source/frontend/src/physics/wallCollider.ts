import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface PhysicsContext {
  world: RAPIER.World;
  wallRigidBody: RAPIER.RigidBody;
  wallCollider: RAPIER.Collider;
}

export async function createPhysicsContext(rootObject: THREE.Object3D): Promise<PhysicsContext> {
  await RAPIER.init();

  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const wallRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

  const { vertices, indices } = extractWorldTriangles(rootObject);
  const wallCollider = world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices), wallRigidBody);

  return {
    world,
    wallRigidBody,
    wallCollider
  };
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
