import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  addTwistAroundNormal,
  isWithinSnapDistance,
  orientationFromNormal,
  projectAxisOnTangent,
  resolveContactNormal,
  selectDeterministicContact,
} from '../../src/physics/snapMath';

describe('snap deterministico', () => {
  it('applica la soglia inclusiva di 5 cm', () => {
    expect(isWithinSnapDistance(0)).toBe(true);
    expect(isWithinSnapDistance(0.05)).toBe(true);
    expect(isWithinSnapDistance(0.050001)).toBe(false);
    expect(isWithinSnapDistance(-0.01)).toBe(false);
  });

  it('seleziona il contatto più vicino e usa featureId come tie-break', () => {
    const selected = selectDeterministicContact([
      { distance: 0.03, featureId: 8, label: 'later' },
      { distance: 0.02, featureId: 4, label: 'higher-id' },
      { distance: 0.02, featureId: 2, label: 'winner' },
    ]);

    expect(selected?.label).toBe('winner');
  });

  it('usa fallback normale triangolo, ultima valida e asse mondo', () => {
    expect(resolveContactNormal(new Vector3(0, 1, 0), new Vector3(1, 0, 0)).toArray()).toEqual([0, 1, 0]);
    expect(resolveContactNormal(new Vector3(), new Vector3(1, 0, 0)).toArray()).toEqual([1, 0, 0]);
    expect(resolveContactNormal(new Vector3(), new Vector3()).toArray()).toEqual([0, 0, 1]);
  });

  it('proietta gli assi sul piano tangente con fallback', () => {
    const normal = new Vector3(0, 0, 1);
    const tangent = projectAxisOnTangent(new Vector3(1, 1, 1), normal, new Vector3(1, 0, 0));
    const fallback = projectAxisOnTangent(new Vector3(0, 0, 1), normal, new Vector3(0, 1, 0));

    expect(tangent.dot(normal)).toBeCloseTo(0);
    expect(tangent.length()).toBeCloseTo(1);
    expect(fallback.toArray()).toEqual([0, 1, 0]);
  });

  it('allinea +Z alla normale e ruota soltanto attorno ad essa', () => {
    const normal = new Vector3(0, 1, 0);
    const orientation = orientationFromNormal(normal);
    const aligned = new Vector3(0, 0, 1).applyQuaternion(orientation);
    const twisted = addTwistAroundNormal(orientation, normal, Math.PI / 180);
    const relative = twisted.clone().multiply(orientation.clone().invert());

    expect(aligned.distanceTo(normal)).toBeLessThan(1e-6);
    expect(2 * Math.acos(Math.min(1, Math.abs(relative.w)))).toBeCloseTo(Math.PI / 180, 6);
  });

  it('mantiene orientamento normalizzato', () => {
    const result = addTwistAroundNormal(new Quaternion(), new Vector3(0, 0, 1), Math.PI / 3);
    expect(result.length()).toBeCloseTo(1);
  });
});
