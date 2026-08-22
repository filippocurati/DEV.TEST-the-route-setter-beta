import {
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Mesh,
  Object3D,
} from 'three';

/** Dati geometrici separati dalla mesh grafica e pronti per il futuro collider Rapier. */
export interface WallTriMeshData {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
}

/** Estrae triangoli in coordinate mondo da tutte le mesh della parete. */
export function createWallTriMesh(root: Object3D): WallTriMeshData {
  root.updateWorldMatrix(true, true);
  const vertices: number[] = [];
  const indices: number[] = [];

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    appendGeometry(object.geometry, object.matrixWorld, vertices, indices);
  });

  if (vertices.length === 0 || indices.length === 0) {
    throw new Error('La parete non contiene geometrie triangolari utilizzabili.');
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

/** Aggiunge una geometria triangolare applicando la trasformazione mondo della mesh. */
function appendGeometry(
  geometry: BufferGeometry,
  worldMatrix: Matrix4,
  vertices: number[],
  indices: number[],
): void {
  const position = geometry.getAttribute('position');
  if (!(position instanceof BufferAttribute) || position.itemSize < 3) {
    return;
  }

  const vertexOffset = vertices.length / 3;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const transformedX = worldMatrix.elements[0] * x
      + worldMatrix.elements[4] * y
      + worldMatrix.elements[8] * z
      + worldMatrix.elements[12];
    const transformedY = worldMatrix.elements[1] * x
      + worldMatrix.elements[5] * y
      + worldMatrix.elements[9] * z
      + worldMatrix.elements[13];
    const transformedZ = worldMatrix.elements[2] * x
      + worldMatrix.elements[6] * y
      + worldMatrix.elements[10] * z
      + worldMatrix.elements[14];
    vertices.push(transformedX, transformedY, transformedZ);
  }

  if (geometry.index) {
    for (let index = 0; index < geometry.index.count; index += 1) {
      indices.push(vertexOffset + geometry.index.getX(index));
    }
    return;
  }

  const triangleVertexCount = position.count - (position.count % 3);
  for (let index = 0; index < triangleVertexCount; index += 1) {
    indices.push(vertexOffset + index);
  }
}
