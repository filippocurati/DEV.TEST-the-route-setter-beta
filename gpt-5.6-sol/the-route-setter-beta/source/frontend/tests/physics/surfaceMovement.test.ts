import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildWallTopology } from '../../src/scene/wallTopology';
import { findMaximumValidFraction, walkSurface } from '../../src/physics/surfaceMovement';
import type { WallTriMeshData } from '../../src/scene/wallTriMesh';

describe('movimento su superficie continua', () => {
  it('attraversa il bordo condiviso e consuma una sola volta il passo richiesto', () => {
    const mesh = createConnectedPanels();
    const topology = buildWallTopology(mesh);

    const result = walkSurface(
      topology,
      { triangleId: 0, point: new Vector3(-0.005, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(0.01, 0, 0),
    );

    expect(result.completed).toBe(true);
    expect(result.support.triangleId).toBe(3);
    expect(result.transitions).toBe(1);
    expect(result.consumedDistance).toBeCloseTo(0.01, 6);
    expect(result.support.point.z).toBeGreaterThan(0);
    expect(result.support.normal.z).toBeGreaterThan(0.7);
    expect(Math.abs(result.support.normal.x)).toBeGreaterThan(0.7);
  });

  it('si arresta al bordo esterno senza continuare nello spazio libero', () => {
    const topology = buildWallTopology(createConnectedPanels());

    const result = walkSurface(
      topology,
      { triangleId: 1, point: new Vector3(-0.995, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(-0.01, 0, 0),
    );

    expect(result.completed).toBe(false);
    expect(result.stopReason).toBe('boundary');
    expect(result.consumedDistance).toBeCloseTo(0.005, 5);
    expect(result.support.point.x).toBeCloseTo(-1, 5);
  });

  it('non salta su una superficie vicina ma non contigua', () => {
    const topology = buildWallTopology(createConnectedPanels(true));

    const result = walkSurface(
      topology,
      { triangleId: 1, point: new Vector3(-0.995, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(-0.01, 0, 0),
    );

    expect(result.completed).toBe(false);
    expect(result.stopReason).toBe('boundary');
    expect(result.support.triangleId).toBe(1);
    expect(topology.areLocallyConnected(1, 4)).toBe(false);
  });

  it('produce lo stesso risultato suddividendo il comando in passi equivalenti', () => {
    const topology = buildWallTopology(createConnectedPanels());
    const initial = { triangleId: 0, point: new Vector3(-0.005, 0, 0), normal: new Vector3(0, 0, 1) };
    const single = walkSurface(topology, initial, new Vector3(0.01, 0, 0));
    const firstHalf = walkSurface(topology, initial, new Vector3(0.005, 0, 0));
    const secondHalf = walkSurface(topology, firstHalf.support, new Vector3(0.005, 0, 0));

    expect(secondHalf.support.point.distanceTo(single.support.point)).toBeLessThan(1e-5);
    expect(secondHalf.support.normal.distanceTo(single.support.normal)).toBeLessThan(1e-5);
  });

  it('collega deterministicamente una seam con vertici geometricamente coincidenti', () => {
    const mesh = createConnectedPanelsWithDuplicatedSeam();
    const topology = buildWallTopology(mesh);

    const result = walkSurface(
      topology,
      { triangleId: 0, point: new Vector3(-0.005, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(0.01, 0, 0),
    );

    expect(result.completed).toBe(true);
    expect(result.transitions).toBe(1);
    expect(result.support.triangleId).toBe(3);
    expect(topology.areLocallyConnected(0, 3)).toBe(true);
  });

  it('salda una seam entro tolleranza anche attraverso il confine di una cella spaziale', () => {
    const topology = buildWallTopology(createNearCoincidentSeam());

    expect(topology.areLocallyConnected(0, 1)).toBe(true);
  });

  it('mantiene una normale stabile attraversando triangoli coplanari', () => {
    const topology = buildWallTopology(createConnectedPanels());
    const result = walkSurface(
      topology,
      { triangleId: 0, point: new Vector3(-0.75, -0.25, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(0, 0.6, 0),
    );

    expect(result.completed).toBe(true);
    expect(result.support.normal.toArray()).toEqual([0, 0, 1]);
    expect(result.support.normal.toArray().every(Number.isFinite)).toBe(true);
  });

  it('attraversa un bordo vicino anche con il supporto leggermente fuori per tolleranza', () => {
    const topology = buildWallTopology(createNarrowRealScaleTriangles());
    const result = walkSurface(
      topology,
      { triangleId: 0, point: new Vector3(0, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(-0.01, 0, 0),
    );

    expect(result.support.triangleId).toBe(1);
    expect(result.consumedDistance).toBeCloseTo(0.01, 6);
  });

  it('non scarta i triangoli stretti ma validi prodotti dalla fotogrammetria', () => {
    const topology = buildWallTopology(createPhotogrammetryScaleTriangles());
    const result = walkSurface(
      topology,
      { triangleId: 0, point: new Vector3(0, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(-0.01, 0, 0),
    );

    expect(result.stopReason).not.toBe('degenerate');
    expect(result.support.triangleId).not.toBe(0);
  });

  it('attraversa deterministicamente una fan di triangoli quando il passo raggiunge un vertice', () => {
    const topology = buildWallTopology(createVertexFan());
    const result = walkSurface(
      topology,
      { triangleId: 0, point: new Vector3(-0.005, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(0.01, 0, 0),
    );

    expect(result.completed).toBe(true);
    expect(result.support.triangleId).toBe(2);
    expect(result.consumedDistance).toBeCloseTo(0.01, 6);
  });

  it('trova la massima frazione valida entro la tolleranza configurata', () => {
    const maximum = findMaximumValidFraction((fraction) => fraction <= 0.625);

    expect(maximum).toBeLessThanOrEqual(0.625);
    expect(maximum).toBeGreaterThan(0.6249);
    expect(maximum + 1 / 2 ** 14).toBeGreaterThan(0.625);
  });

  it('si arresta al primo intervallo invalido anche se la posa finale torna valida', () => {
    const maximum = findMaximumValidFraction((fraction) => fraction < 0.4 || fraction > 0.6);

    expect(maximum).toBeLessThanOrEqual(0.4);
    expect(maximum).toBeGreaterThan(0.3999);
  });

  it('trasporta il movimento attraverso uno spigolo ortogonale', () => {
    const topology = buildWallTopology(createOrthogonalPanels());
    const result = walkSurface(
      topology,
      { triangleId: 0, point: new Vector3(-0.005, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(0.01, 0, 0),
    );

    expect(result.completed).toBe(true);
    expect(result.transitions).toBe(1);
    expect(result.support.normal.x).toBeLessThan(-0.9);
    expect(result.support.point.z).toBeGreaterThan(0);
  });

  it('non limita un passo che attraversa oltre 128 triangoli coplanari con progresso', () => {
    const topology = buildWallTopology(createDenseStrip(80));
    const result = walkSurface(
      topology,
      { triangleId: 1, point: new Vector3(0.000001, 0, 0), normal: new Vector3(0, 0, 1) },
      new Vector3(0.0098, 0, 0),
    );

    expect(result.completed).toBe(true);
    expect(result.stopReason).toBe('complete');
    expect(result.transitions).toBeGreaterThan(128);
    expect(result.consumedDistance).toBeCloseTo(0.0098, 6);
  });
});

function createConnectedPanels(includeNearbySurface = false): WallTriMeshData {
  const vertices = [
    -1, -1, 0,
    0, -1, 0,
    0, 1, 0,
    -1, 1, 0,
    1, -1, 1,
    1, 1, 1,
  ];
  const indices = [
    0, 1, 2,
    0, 2, 3,
    1, 4, 5,
    1, 5, 2,
  ];
  if (includeNearbySurface) {
    const offset = vertices.length / 3;
    vertices.push(
      -1.006, -1, 0,
      -1.006, 1, 0,
      -1.006, 0, 1,
    );
    indices.push(offset, offset + 1, offset + 2);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

function createConnectedPanelsWithDuplicatedSeam(): WallTriMeshData {
  const source = createConnectedPanels();
  const vertices = Array.from(source.vertices);
  const indices = Array.from(source.indices);
  const rightOffset = vertices.length / 3;
  vertices.push(
    0, -1, 0,
    0, 1, 0,
    1, -1, 1,
    1, 1, 1,
  );
  indices.splice(6, 6,
    rightOffset, rightOffset + 2, rightOffset + 3,
    rightOffset, rightOffset + 3, rightOffset + 1,
  );
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

function createNearCoincidentSeam(): WallTriMeshData {
  return {
    vertices: new Float32Array([
      -1, -1, 0,
      0.000049, -1, 0,
      0.000049, 1, 0,
      0.000051, -1, 0,
      1, -1, 0.5,
      0.000051, 1, 0,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      3, 4, 5,
    ]),
  };
}

function createNarrowRealScaleTriangles(): WallTriMeshData {
  return {
    vertices: new Float32Array([
      -0.0022, 0.045, 0,
      -0.0020, -0.145, 0,
      0.189, -0.145, 0,
      -0.19, 0.045, 0,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      3, 1, 0,
    ]),
  };
}

function createPhotogrammetryScaleTriangles(): WallTriMeshData {
  return {
    vertices: new Float32Array([
      -0.00224617, 0.04536669, 0,
      -0.00205097, -0.14566602, 0,
      0.18897911, -0.14566602, 0,
      -0.00245062, -0.14529482, 0,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      0, 3, 1,
    ]),
  };
}

function createVertexFan(): WallTriMeshData {
  return {
    vertices: new Float32Array([
      -1, -1, 0,
      0, 0, 0,
      -1, 1, 0,
      0, -1, 0,
      1, 0, 0,
      0, 1, 0,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      0, 3, 1,
      1, 4, 5,
      1, 5, 2,
    ]),
  };
}

function createOrthogonalPanels(): WallTriMeshData {
  return {
    vertices: new Float32Array([
      -1, -1, 0,
      0, -1, 0,
      0, 1, 0,
      -1, 1, 0,
      0, -1, 1,
      0, 1, 1,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      0, 2, 3,
      1, 4, 5,
      1, 5, 2,
    ]),
  };
}

function createDenseStrip(cells: number): WallTriMeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= cells; index += 1) {
    const x = index * 0.01 / cells;
    vertices.push(x, -1, 0, x, 1, 0);
  }
  for (let index = 0; index < cells; index += 1) {
    const bottomLeft = index * 2;
    const topLeft = bottomLeft + 1;
    const bottomRight = bottomLeft + 2;
    const topRight = bottomLeft + 3;
    indices.push(bottomLeft, bottomRight, topRight, bottomLeft, topRight, topLeft);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}
