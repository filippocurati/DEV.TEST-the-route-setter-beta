import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  clampTargetDiameter,
  createTargetAdjacency,
  createTargetSamples,
  quantizeRotationDelta,
  selectDominantSurface,
  type SurfaceSampleHit,
} from '../../src/interaction/targetSampling';

describe('targeting 9UX', () => {
  it('genera 37 campioni e un grafo deterministico', () => {
    const samples = createTargetSamples();
    const edges = createTargetAdjacency(samples);
    expect(samples).toHaveLength(37);
    expect(samples.filter((sample) => sample.ring === 1)).toHaveLength(6);
    expect(samples.filter((sample) => sample.ring === 2)).toHaveLength(12);
    expect(samples.filter((sample) => sample.ring === 3)).toHaveLength(18);
    expect(edges).toEqual([...edges].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  });

  it('seleziona il gruppo più numeroso senza copertura minima', () => {
    const dominant = selectDominantSurface([
      hit(1, 0, 'b'), hit(2, 0.01, 'b'), hit(3, 0.02, 'b'),
      hit(19, 1, 'a'),
    ], 1);
    expect(dominant?.hitCount).toBe(3);
    expect(dominant?.stableId).toBe('b');
  });

  it('applica tie-break centro, distanza camera e id stabile', () => {
    expect(selectDominantSurface([hit(0, 0, 'z'), hit(7, 2, 'a')], 0.1)?.containsCenter).toBe(true);
    expect(selectDominantSurface([hit(1, 1, 'z', 3), hit(7, 2, 'a', 2)], 0.1)?.cameraDistance).toBe(2);
    expect(selectDominantSurface([hit(1, 1, 'z'), hit(7, 2, 'a')], 0.1)?.stableId).toBe('a');
  });

  it('non unisce campioni oltre distanza o oltre cinque gradi', () => {
    const far = selectDominantSurface([hit(1, 0, 'a'), hit(2, 2, 'b')], 0.5);
    const tilted = selectDominantSurface([
      hit(1, 0, 'a'),
      { ...hit(2, 0.01, 'b'), normal: new Vector3(0, Math.sin(Math.PI / 18), Math.cos(Math.PI / 18)) },
    ], 1);
    expect(far?.hitCount).toBe(1);
    expect(tilted?.hitCount).toBe(1);
  });

  it('limita il diametro e quantizza il drag a un grado', () => {
    expect(clampTargetDiameter(10)).toBe(48);
    expect(clampTargetDiameter(200)).toBe(160);
    const first = quantizeRotationDelta(0, Math.PI / 120, 0);
    expect(first.steps).toBe(1);
    const second = quantizeRotationDelta(Math.PI / 120, Math.PI / 90, first.residual);
    expect(second.steps).toBe(1);
  });
});

function hit(sampleIndex: number, x: number, stableId: string, cameraDistance = 1): SurfaceSampleHit {
  return {
    sampleIndex,
    point: new Vector3(x, 0, 0),
    normal: new Vector3(0, 0, 1),
    cameraDistance,
    stableId,
    screenDistanceSquared: sampleIndex,
  };
}
