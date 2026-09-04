import { Vector3 } from 'three';

const MAX_NORMAL_ANGLE_RADIANS = Math.PI / 36;
export const TARGET_MIN_DIAMETER_PX = 48;
export const TARGET_MAX_DIAMETER_PX = 160;

export interface TargetSample {
  readonly index: number;
  readonly ring: number;
  readonly ringIndex: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

export interface SurfaceSampleHit {
  readonly sampleIndex: number;
  readonly point: Vector3;
  readonly normal: Vector3;
  readonly cameraDistance: number;
  readonly stableId: string;
  readonly screenDistanceSquared: number;
}

export interface DominantSurface {
  readonly point: Vector3;
  readonly normal: Vector3;
  readonly hitCount: number;
  readonly containsCenter: boolean;
  readonly cameraDistance: number;
  readonly stableId: string;
}

/** Genera centro e tre anelli deterministici da 6, 12 e 18 campioni. */
export function createTargetSamples(): readonly TargetSample[] {
  const samples: TargetSample[] = [{ index: 0, ring: 0, ringIndex: 0, x: 0, y: 0, angle: 0 }];
  [6, 12, 18].forEach((count, ringIndex) => {
    const radius = (ringIndex + 1) / 3;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      samples.push({
        index: samples.length,
        ring: ringIndex + 1,
        ringIndex: index,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        angle,
      });
    }
  });
  return samples;
}

/** Costruisce il grafo locale dei campioni usando vicini circolari e radiali. */
export function createTargetAdjacency(samples: readonly TargetSample[]): readonly (readonly [number, number])[] {
  const rings = [1, 2, 3].map((ring) => samples.filter((sample) => sample.ring === ring));
  const edges = new Set<string>();
  const add = (left: number, right: number): void => {
    const a = Math.min(left, right);
    const b = Math.max(left, right);
    if (a !== b) edges.add(`${a}:${b}`);
  };
  rings[0].forEach((sample) => add(0, sample.index));
  rings.forEach((ring) => ring.forEach((sample, index) => {
    add(sample.index, ring[(index + 1) % ring.length].index);
  }));
  for (let ringIndex = 1; ringIndex < rings.length; ringIndex += 1) {
    const inner = rings[ringIndex - 1];
    const outer = rings[ringIndex];
    outer.forEach((sample) => {
      const scaled = (sample.ringIndex * inner.length) / outer.length;
      const lower = Math.floor(scaled) % inner.length;
      const upper = Math.ceil(scaled) % inner.length;
      add(sample.index, inner[lower].index);
      add(sample.index, inner[upper === lower ? (lower + 1) % inner.length : upper].index);
    });
  }
  return [...edges]
    .map((edge) => edge.split(':').map(Number) as [number, number])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

/** Seleziona la superficie dominante usando il grafo locale e tie-break stabili. */
export function selectDominantSurface(
  hits: readonly SurfaceSampleHit[],
  physicalDiameter: number,
  samples = createTargetSamples(),
  adjacency = createTargetAdjacency(samples),
): DominantSurface | null {
  if (hits.length === 0) return null;
  const hitBySample = new Map(hits.map((hit) => [hit.sampleIndex, hit]));
  const parent = new Int16Array(samples.length);
  for (let index = 0; index < parent.length; index += 1) parent[index] = index;
  const find = (value: number): number => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const unite = (left: number, right: number): void => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  };
  adjacency.forEach(([left, right]) => {
    const a = hitBySample.get(left);
    const b = hitBySample.get(right);
    if (!a || !b || a.point.distanceTo(b.point) > physicalDiameter) return;
    if (a.normal.angleTo(b.normal) > MAX_NORMAL_ANGLE_RADIANS) return;
    unite(left, right);
  });

  const clusters = new Map<number, SurfaceSampleHit[]>();
  hits.forEach((hit) => {
    const root = find(hit.sampleIndex);
    const members = clusters.get(root);
    if (members) members.push(hit);
    else clusters.set(root, [hit]);
  });
  const ranked = [...clusters.values()].map((members) => {
    const normal = members.reduce((sum, hit) => sum.add(hit.normal), new Vector3());
    if (!isFiniteVector(normal) || normal.lengthSq() < 1e-16) return null;
    const pointHit = [...members].sort((left, right) =>
      left.screenDistanceSquared - right.screenDistanceSquared || left.sampleIndex - right.sampleIndex)[0];
    return {
      point: pointHit.point.clone(),
      normal: normal.normalize(),
      hitCount: members.length,
      containsCenter: members.some((hit) => hit.sampleIndex === 0),
      cameraDistance: Math.min(...members.map((hit) => hit.cameraDistance)),
      stableId: [...members.map((hit) => hit.stableId)].sort()[0],
    } satisfies DominantSurface;
  }).filter((cluster): cluster is DominantSurface => cluster !== null);
  return ranked.sort((left, right) =>
    right.hitCount - left.hitCount
    || Number(right.containsCenter) - Number(left.containsCenter)
    || left.cameraDistance - right.cameraDistance
    || left.stableId.localeCompare(right.stableId))[0] ?? null;
}

/** Limita il diametro screen-space del footprint per garantire campioni leggibili e stabili. */
export function clampTargetDiameter(diameter: number): number {
  return Math.min(TARGET_MAX_DIAMETER_PX, Math.max(TARGET_MIN_DIAMETER_PX, diameter));
}

/** Accumula il delta pointer e restituisce i passi interi di un grado. */
export function quantizeRotationDelta(
  previousAngle: number,
  currentAngle: number,
  residual: number,
): { readonly steps: number; readonly residual: number } {
  let delta = currentAngle - previousAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const total = residual + delta;
  const oneDegree = Math.PI / 180;
  const steps = Math.trunc(total / oneDegree);
  return { steps, residual: total - steps * oneDegree };
}

/** Verifica che una normale candidata non contenga componenti non finite. */
function isFiniteVector(vector: Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}
