import { describe, expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import { createWallTriMesh } from '../../src/scene/wallTriMesh';

describe('wall TriMesh', () => {
  it('estrae vertici e indici applicando la trasformazione mondo', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ], 3));
    geometry.setIndex([0, 1, 2]);
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.position.set(2, 3, 4);
    const root = new Group();
    root.add(mesh);

    const triMesh = createWallTriMesh(root);

    expect(Array.from(triMesh.vertices)).toEqual([2, 3, 4, 3, 3, 4, 2, 4, 4]);
    expect(Array.from(triMesh.indices)).toEqual([0, 1, 2]);
  });

  it('genera indici sequenziali per geometrie non indicizzate', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ], 3));
    const root = new Group();
    root.add(new Mesh(geometry, new MeshBasicMaterial()));

    const triMesh = createWallTriMesh(root);

    expect(Array.from(triMesh.indices)).toEqual([0, 1, 2]);
  });

  it('rifiuta una parete priva di triangoli', () => {
    expect(() => createWallTriMesh(new Group())).toThrow(
      'La parete non contiene geometrie triangolari utilizzabili.',
    );
  });
});
