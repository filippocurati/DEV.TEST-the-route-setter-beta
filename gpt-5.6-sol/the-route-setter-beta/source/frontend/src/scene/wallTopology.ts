import { Vector3 } from 'three';
import type { WallTriMeshData } from './wallTriMesh';
import { GEOMETRY_CONFIG } from '../physics/geometryConfig';

export const NO_NEIGHBOR = -1;
export const AMBIGUOUS_NEIGHBOR = -2;
const SEAM_WELD_METERS = GEOMETRY_CONFIG.seamWeldMeters;
const NORMAL_EPSILON = GEOMETRY_CONFIG.normalEpsilon;

/** Topologia compatta del TriMesh usata per seguire soltanto facce contigue. */
export interface WallTopology {
  readonly mesh: WallTriMeshData;
  readonly neighbors: Int32Array;
  readonly triangleCount: number;
  triangleVertices(triangleId: number): readonly [Vector3, Vector3, Vector3];
  triangleNormal(triangleId: number): Vector3 | null;
  neighborAcross(triangleId: number, edge: number): number;
  areLocallyConnected(fromTriangle: number, toTriangle: number, maximumVisited?: number): boolean;
}

/** Costruisce adiacenze esatte e salda soltanto i bordi geometricamente coincidenti. */
export function buildWallTopology(mesh: WallTriMeshData): WallTopology {
  const triangleCount = mesh.indices.length / 3;
  const vertexCount = mesh.vertices.length / 3;
  const neighbors = new Int32Array(triangleCount * 3);
  neighbors.fill(NO_NEIGHBOR);

  const offsets = new Uint32Array(vertexCount + 1);
  for (const vertex of mesh.indices) offsets[vertex + 1] += 1;
  for (let index = 1; index < offsets.length; index += 1) offsets[index] += offsets[index - 1];
  const cursor = offsets.slice();
  const incidents = new Uint32Array(mesh.indices.length);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = mesh.indices[triangle * 3 + corner];
      incidents[cursor[vertex]++] = triangle;
    }
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let edge = 0; edge < 3; edge += 1) {
      const [first, second] = edgeVertices(mesh.indices, triangle, edge);
      let match = NO_NEIGHBOR;
      for (let cursorIndex = offsets[first]; cursorIndex < offsets[first + 1]; cursorIndex += 1) {
        const candidate = incidents[cursorIndex];
        if (candidate === triangle || !triangleContains(mesh.indices, candidate, second)) continue;
        if (match !== NO_NEIGHBOR && match !== candidate) {
          match = AMBIGUOUS_NEIGHBOR;
          break;
        }
        match = candidate;
      }
      neighbors[triangle * 3 + edge] = match;
    }
  }

  weldOpenSeams(mesh, neighbors);
  const visitMarks = new Uint32Array(triangleCount);
  const visitQueue = new Uint32Array(Math.min(triangleCount, 8192));
  let visitStamp = 0;
  return {
    mesh,
    neighbors,
    triangleCount,
    triangleVertices: (triangleId) => triangleVertices(mesh, triangleId),
    triangleNormal: (triangleId) => triangleNormal(mesh, triangleId),
    neighborAcross: (triangleId, edge) => neighbors[triangleId * 3 + edge] ?? NO_NEIGHBOR,
    areLocallyConnected: (fromTriangle, toTriangle, maximumVisited = 512) => {
      visitStamp += 1;
      if (visitStamp === 0xffffffff) {
        visitMarks.fill(0);
        visitStamp = 1;
      }
      return areLocallyConnected(
        neighbors,
        triangleCount,
        fromTriangle,
        toTriangle,
        Math.min(maximumVisited, visitQueue.length),
        visitMarks,
        visitQueue,
        visitStamp,
      );
    },
  };
}

/** Verifica la raggiungibilita mediante una catena breve di soli lati condivisi. */
function areLocallyConnected(
  neighbors: Int32Array,
  triangleCount: number,
  fromTriangle: number,
  toTriangle: number,
  maximumVisited: number,
  visitMarks: Uint32Array,
  queue: Uint32Array,
  stamp: number,
): boolean {
  if (fromTriangle === toTriangle) return true;
  if (fromTriangle < 0 || toTriangle < 0 || fromTriangle >= triangleCount || toTriangle >= triangleCount) return false;
  let queueLength = 1;
  queue[0] = fromTriangle;
  visitMarks[fromTriangle] = stamp;
  for (let cursor = 0; cursor < queueLength && queueLength < maximumVisited; cursor += 1) {
    const triangle = queue[cursor];
    for (let edge = 0; edge < 3; edge += 1) {
      const neighbor = neighbors[triangle * 3 + edge];
      if (neighbor < 0 || visitMarks[neighbor] === stamp) continue;
      if (neighbor === toTriangle) return true;
      visitMarks[neighbor] = stamp;
      queue[queueLength++] = neighbor;
    }
  }
  return false;
}

/** Restituisce i tre vertici di un triangolo in coordinate mondo. */
export function triangleVertices(mesh: WallTriMeshData, triangleId: number): readonly [Vector3, Vector3, Vector3] {
  if (!Number.isInteger(triangleId) || triangleId < 0 || triangleId * 3 + 2 >= mesh.indices.length) {
    throw new Error('Indice triangolo parete fuori intervallo.');
  }
  return [0, 1, 2].map((corner) => {
    const offset = mesh.indices[triangleId * 3 + corner] * 3;
    return new Vector3(mesh.vertices[offset], mesh.vertices[offset + 1], mesh.vertices[offset + 2]);
  }) as unknown as readonly [Vector3, Vector3, Vector3];
}

/** Calcola la normale geometrica finita del triangolo indicato. */
export function triangleNormal(mesh: WallTriMeshData, triangleId: number): Vector3 | null {
  const [a, b, c] = triangleVertices(mesh, triangleId);
  const normal = b.sub(a).cross(c.sub(a));
  return normal.lengthSq() > NORMAL_EPSILON ? normal.normalize() : null;
}

function edgeVertices(indices: Uint32Array, triangle: number, edge: number): readonly [number, number] {
  const offset = triangle * 3;
  if (edge === 0) return [indices[offset + 1], indices[offset + 2]];
  if (edge === 1) return [indices[offset + 2], indices[offset]];
  return [indices[offset], indices[offset + 1]];
}

function triangleContains(indices: Uint32Array, triangle: number, vertex: number): boolean {
  const offset = triangle * 3;
  return indices[offset] === vertex || indices[offset + 1] === vertex || indices[offset + 2] === vertex;
}

/** Collega seam fra primitive con vertici duplicati senza confondere superfici solo vicine. */
function weldOpenSeams(mesh: WallTriMeshData, neighbors: Int32Array): void {
  const openEdges: number[] = [];
  for (let edgeRef = 0; edgeRef < neighbors.length; edgeRef += 1) {
    if (neighbors[edgeRef] === NO_NEIGHBOR) openEdges.push(edgeRef);
  }
  if (openEdges.length === 0) return;

  const weldedVertices = weldOpenEdgeVertices(mesh, openEdges);
  const byGeometry = new Map<string, number[]>();
  for (const edgeRef of openEdges) {
    const triangle = Math.floor(edgeRef / 3);
    const edge = edgeRef % 3;
    const [first, second] = edgeVertices(mesh.indices, triangle, edge);
    const firstKey = weldedVertices.get(first)!;
    const secondKey = weldedVertices.get(second)!;
    const key = firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
    const matches = byGeometry.get(key);
    if (matches) matches.push(edgeRef);
    else byGeometry.set(key, [edgeRef]);
  }

  for (const matches of byGeometry.values()) {
    if (matches.length === 2) {
      const firstTriangle = Math.floor(matches[0] / 3);
      const secondTriangle = Math.floor(matches[1] / 3);
      if (firstTriangle !== secondTriangle && edgesCoincide(mesh, matches[0], matches[1])) {
        neighbors[matches[0]] = secondTriangle;
        neighbors[matches[1]] = firstTriangle;
      }
    } else if (matches.length > 2) {
      for (const edgeRef of matches) neighbors[edgeRef] = AMBIGUOUS_NEIGHBOR;
    }
  }
}

/** Assegna lo stesso ID a vertici entro tolleranza cercando anche nelle celle adiacenti. */
function weldOpenEdgeVertices(mesh: WallTriMeshData, openEdges: readonly number[]): Map<number, number> {
  const result = new Map<number, number>();
  const buckets = new Map<string, number[]>();
  const representatives: Vector3[] = [];
  for (const edgeRef of openEdges) {
    const triangle = Math.floor(edgeRef / 3);
    const edge = edgeRef % 3;
    for (const vertexIndex of edgeVertices(mesh.indices, triangle, edge)) {
      if (result.has(vertexIndex)) continue;
      const point = vertex(mesh.vertices, vertexIndex);
      const cell = cellCoordinates(point);
      let weldedId: number | undefined;
      for (let x = -1; x <= 1 && weldedId === undefined; x += 1) {
        for (let y = -1; y <= 1 && weldedId === undefined; y += 1) {
          for (let z = -1; z <= 1 && weldedId === undefined; z += 1) {
            for (const candidate of buckets.get(cellKey(cell[0] + x, cell[1] + y, cell[2] + z)) ?? []) {
              if (representatives[candidate].distanceTo(point) <= SEAM_WELD_METERS) {
                weldedId = candidate;
                break;
              }
            }
          }
        }
      }
      if (weldedId === undefined) {
        weldedId = representatives.length;
        representatives.push(point);
        const key = cellKey(cell[0], cell[1], cell[2]);
        const bucket = buckets.get(key);
        if (bucket) bucket.push(weldedId);
        else buckets.set(key, [weldedId]);
      }
      result.set(vertexIndex, weldedId);
    }
  }
  return result;
}

function edgesCoincide(mesh: WallTriMeshData, firstEdgeRef: number, secondEdgeRef: number): boolean {
  const first = edgePoints(mesh, firstEdgeRef);
  const second = edgePoints(mesh, secondEdgeRef);
  return (first[0].distanceTo(second[0]) <= SEAM_WELD_METERS
      && first[1].distanceTo(second[1]) <= SEAM_WELD_METERS)
    || (first[0].distanceTo(second[1]) <= SEAM_WELD_METERS
      && first[1].distanceTo(second[0]) <= SEAM_WELD_METERS);
}

function edgePoints(mesh: WallTriMeshData, edgeRef: number): readonly [Vector3, Vector3] {
  const triangle = Math.floor(edgeRef / 3);
  const edge = edgeRef % 3;
  const [first, second] = edgeVertices(mesh.indices, triangle, edge);
  return [vertex(mesh.vertices, first), vertex(mesh.vertices, second)];
}

function vertex(vertices: Float32Array, index: number): Vector3 {
  const offset = index * 3;
  return new Vector3(vertices[offset], vertices[offset + 1], vertices[offset + 2]);
}

function cellCoordinates(point: Vector3): readonly [number, number, number] {
  return [
    Math.floor(point.x / SEAM_WELD_METERS),
    Math.floor(point.y / SEAM_WELD_METERS),
    Math.floor(point.z / SEAM_WELD_METERS),
  ];
}

function cellKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}
