import { Quaternion, Vector3 } from 'three';
import {
  AMBIGUOUS_NEIGHBOR,
  NO_NEIGHBOR,
  type WallTopology,
} from '../scene/wallTopology';
import { GEOMETRY_CONFIG } from './geometryConfig';

export const SURFACE_TOLERANCE_METERS = GEOMETRY_CONFIG.supportToleranceMeters;
const NORMAL_EPSILON = GEOMETRY_CONFIG.normalEpsilon;
const MAX_TRANSITIONS_PER_STEP = GEOMETRY_CONFIG.maximumTransitionsPerStep;

export interface SurfaceSupport {
  readonly triangleId: number;
  readonly point: Vector3;
  readonly normal: Vector3;
}

export interface SurfaceWaypoint extends SurfaceSupport {
  readonly consumedDistance: number;
  readonly kind: 'translation' | 'normal-change';
}

export interface SurfaceWalkResult {
  readonly support: SurfaceSupport;
  readonly waypoints: readonly SurfaceWaypoint[];
  readonly completed: boolean;
  readonly stopReason: 'complete' | 'boundary' | 'ambiguous' | 'degenerate' | 'transition-limit';
  readonly consumedDistance: number;
  readonly transitions: number;
}

/** Trova la massima frazione valida del primo intervallo monotono valido/non valido. */
export function findMaximumValidFraction(
  isValid: (fraction: number) => boolean,
  iterations = GEOMETRY_CONFIG.maximumFractionIterations,
  samples = 32,
): number {
  let low = 0;
  let high = 1;
  for (let sample = 1; sample <= samples; sample += 1) {
    const fraction = sample / samples;
    if (isValid(fraction)) {
      low = fraction;
      continue;
    }
    high = fraction;
    low = (sample - 1) / samples;
    break;
  }
  if (low === 1) return 1;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const middle = (low + high) / 2;
    if (isValid(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/** Segue triangoli contigui consumando una sola volta la lunghezza del passo richiesto. */
export function walkSurface(
  topology: WallTopology,
  initial: SurfaceSupport,
  requestedDelta: Vector3,
): SurfaceWalkResult {
  const requestedLength = requestedDelta.length();
  if (requestedLength <= NORMAL_EPSILON) return result(initial, [], true, 'complete', 0, 0);

  let support = cloneSupport(initial);
  let direction = projectDirection(requestedDelta, support.normal);
  if (!direction) return result(support, [], false, 'degenerate', 0, 0);
  let remaining = requestedLength;
  let consumed = 0;
  let transitions = 0;
  let zeroProgressTransitions = 0;
  const waypoints: SurfaceWaypoint[] = [];

  while (remaining > SURFACE_TOLERANCE_METERS * 0.01) {
    const crossing = firstEdgeCrossing(topology, support, direction, remaining);
    if (!crossing) {
      support = {
        triangleId: support.triangleId,
        point: support.point.clone().addScaledVector(direction, remaining),
        normal: support.normal.clone(),
      };
      consumed += remaining;
      waypoints.push({ ...cloneSupport(support), consumedDistance: consumed, kind: 'translation' });
      return result(support, waypoints, true, 'complete', consumed, transitions);
    }

    if (crossing.distance > 0) {
      support = {
        triangleId: support.triangleId,
        point: crossing.point,
        normal: support.normal.clone(),
      };
      consumed += crossing.distance;
      remaining -= crossing.distance;
      zeroProgressTransitions = 0;
    } else {
      zeroProgressTransitions += 1;
    }

    const neighbor = topology.neighborAcross(support.triangleId, crossing.edge);
    if (neighbor === NO_NEIGHBOR || neighbor === AMBIGUOUS_NEIGHBOR) {
      waypoints.push({ ...cloneSupport(support), consumedDistance: consumed, kind: 'translation' });
      return result(
        support,
        waypoints,
        false,
        neighbor === NO_NEIGHBOR ? 'boundary' : 'ambiguous',
        consumed,
        transitions,
      );
    }
    const transition = findContiguousTransition(
      topology,
      support,
      neighbor,
      crossing.point,
      direction,
    );
    if (!transition) {
      waypoints.push({ ...cloneSupport(support), consumedDistance: consumed, kind: 'translation' });
      return result(support, waypoints, false, 'degenerate', consumed, transitions);
    }
    const { triangleId: nextTriangle, normal: candidateNormal, direction: nextDirection } = transition;
    const normalChanged = candidateNormal.angleTo(support.normal) >= GEOMETRY_CONFIG.normalChangeRadians;
    if (!normalChanged) candidateNormal.copy(support.normal);

    if (normalChanged) {
      waypoints.push({ ...cloneSupport(support), consumedDistance: consumed, kind: 'translation' });
    }
    support = { triangleId: nextTriangle, point: crossing.point.clone(), normal: candidateNormal };
    direction = nextDirection;
    transitions += 1;
    if (normalChanged) {
      waypoints.push({ ...cloneSupport(support), consumedDistance: consumed, kind: 'normal-change' });
    }
    if (zeroProgressTransitions >= MAX_TRANSITIONS_PER_STEP) {
      return result(support, waypoints, false, 'transition-limit', consumed, transitions);
    }

    const nudge = Math.min(remaining, SURFACE_TOLERANCE_METERS * 0.01);
    if (nudge > 0) {
      support = { ...support, point: support.point.clone().addScaledVector(direction, nudge) };
      consumed += nudge;
      remaining -= nudge;
    }
  }

  if (waypoints.length === 0 || waypoints[waypoints.length - 1].point.distanceTo(support.point) > NORMAL_EPSILON) {
    waypoints.push({ ...cloneSupport(support), consumedDistance: consumed, kind: 'translation' });
  }
  return result(support, waypoints, true, 'complete', consumed, transitions);
}

function firstEdgeCrossing(
  topology: WallTopology,
  support: SurfaceSupport,
  direction: Vector3,
  distance: number,
): { readonly edge: number; readonly distance: number; readonly point: Vector3 } | null {
  const vertices = topology.triangleVertices(support.triangleId);
  const start = barycentric(support.point, vertices);
  const endPoint = support.point.clone().addScaledVector(direction, distance);
  const end = barycentric(endPoint, vertices);
  let fraction = Number.POSITIVE_INFINITY;
  let edge = -1;
  for (let coordinate = 0; coordinate < 3; coordinate += 1) {
    if (end[coordinate] >= -1e-7 || start[coordinate] <= end[coordinate]) continue;
    const candidate = start[coordinate] / (start[coordinate] - end[coordinate]);
    if (candidate >= 0 && candidate < fraction) {
      fraction = candidate;
      edge = coordinate;
    }
  }
  if (edge < 0 || fraction > 1) return null;
  const crossingDistance = Math.max(0, Math.min(distance, distance * fraction));
  return {
    edge,
    distance: crossingDistance,
    point: support.point.clone().addScaledVector(direction, crossingDistance),
  };
}

function entersTriangle(topology: WallTopology, triangleId: number, point: Vector3, direction: Vector3): boolean {
  const probe = point.clone().addScaledVector(direction, SURFACE_TOLERANCE_METERS * 0.01);
  return barycentric(probe, topology.triangleVertices(triangleId)).every((value) => value >= -1e-4);
}

/** Cerca nella sola fan contigua del bordo/vertice una faccia realmente raggiunta dal moto. */
function findContiguousTransition(
  topology: WallTopology,
  current: SurfaceSupport,
  firstNeighbor: number,
  point: Vector3,
  incomingDirection: Vector3,
): { readonly triangleId: number; readonly normal: Vector3; readonly direction: Vector3 } | null {
  const queue = [firstNeighbor];
  const visited = new Set<number>([current.triangleId]);
  const candidates: Array<{ triangleId: number; normal: Vector3; direction: Vector3 }> = [];
  while (queue.length > 0 && visited.size <= 64) {
    const triangleId = queue.shift()!;
    if (triangleId < 0 || visited.has(triangleId)) continue;
    visited.add(triangleId);
    const normal = topology.triangleNormal(triangleId);
    if (!normal) continue;
    if (normal.dot(current.normal) < 0) normal.negate();
    const direction = transportDirection(incomingDirection, current.normal, normal);
    if (direction && entersTriangle(topology, triangleId, point, direction)) {
      candidates.push({ triangleId, normal, direction });
    }
    if (!pointTouchesTriangle(point, topology.triangleVertices(triangleId))) continue;
    for (let edge = 0; edge < 3; edge += 1) {
      const neighbor = topology.neighborAcross(triangleId, edge);
      if (neighbor >= 0 && !visited.has(neighbor)) queue.push(neighbor);
    }
  }
  return candidates.sort((left, right) =>
    right.direction.dot(incomingDirection) - left.direction.dot(incomingDirection)
    || left.triangleId - right.triangleId)[0] ?? null;
}

function pointTouchesTriangle(point: Vector3, vertices: readonly [Vector3, Vector3, Vector3]): boolean {
  return barycentric(point, vertices).every((value) => value >= -1e-4 && value <= 1.0001);
}

function barycentric(point: Vector3, [a, b, c]: readonly [Vector3, Vector3, Vector3]): [number, number, number] {
  const v0 = b.clone().sub(a);
  const v1 = c.clone().sub(a);
  const v2 = point.clone().sub(a);
  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);
  const denominator = d00 * d11 - d01 * d01;
  if (Math.abs(denominator) <= NORMAL_EPSILON) return [-Infinity, -Infinity, -Infinity];
  const v = (d11 * d20 - d01 * d21) / denominator;
  const w = (d00 * d21 - d01 * d20) / denominator;
  return [1 - v - w, v, w];
}

function projectDirection(direction: Vector3, normal: Vector3): Vector3 | null {
  const projected = direction.clone().addScaledVector(normal, -direction.dot(normal));
  return projected.lengthSq() > NORMAL_EPSILON ? projected.normalize() : null;
}

/** Trasporta la tangente attraverso lo spigolo usando la rotazione fra le due normali. */
function transportDirection(direction: Vector3, fromNormal: Vector3, toNormal: Vector3): Vector3 | null {
  const transported = direction.clone().applyQuaternion(
    new Quaternion().setFromUnitVectors(fromNormal.clone().normalize(), toNormal.clone().normalize()),
  );
  return projectDirection(transported, toNormal);
}

function cloneSupport(support: SurfaceSupport): SurfaceSupport {
  return {
    triangleId: support.triangleId,
    point: support.point.clone(),
    normal: support.normal.clone(),
  };
}

function result(
  support: SurfaceSupport,
  waypoints: readonly SurfaceWaypoint[],
  completed: boolean,
  stopReason: SurfaceWalkResult['stopReason'],
  consumedDistance: number,
  transitions: number,
): SurfaceWalkResult {
  return { support: cloneSupport(support), waypoints, completed, stopReason, consumedDistance, transitions };
}
