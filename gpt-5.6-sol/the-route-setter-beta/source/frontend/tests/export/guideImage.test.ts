import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import {
  calculateExportDimensions,
  GUIDE_JPEG_QUALITY,
  GUIDE_LONG_SIDE_PIXELS,
  snapshotCamera,
} from '../../src/export/guideImage';

describe('dimensioni immagine guida', () => {
  it('mantiene 2560 px sul lato lungo per scene orizzontali', () => {
    expect(calculateExportDimensions(20, 10)).toEqual({ width: 2560, height: 1280 });
  });

  it('mantiene 2560 px sul lato lungo per scene verticali', () => {
    expect(calculateExportDimensions(10, 20)).toEqual({ width: 1280, height: 2560 });
  });

  it('espone qualità JPEG e lato lungo vincolati', () => {
    expect(GUIDE_LONG_SIDE_PIXELS).toBe(2560);
    expect(GUIDE_JPEG_QUALITY).toBe(0.9);
  });

  it('rifiuta dimensioni non valide', () => {
    expect(() => calculateExportDimensions(0, 10)).toThrow('Dimensioni viewport non valide');
  });

  it('fotografa integralmente i parametri della camera prospettica', () => {
    const camera = new PerspectiveCamera(53, 16 / 9, 0.25, 900);
    camera.position.set(1, 2, 3);
    camera.rotation.set(0.1, 0.2, 0.3);
    camera.zoom = 1.7;

    const snapshot = snapshotCamera(camera);

    expect(snapshot.position).toEqual([1, 2, 3]);
    expect(snapshot.quaternion).toEqual(camera.quaternion.toArray());
    expect(snapshot.fov).toBe(53);
    expect(snapshot.zoom).toBe(1.7);
    expect(snapshot.near).toBe(0.25);
    expect(snapshot.far).toBe(900);
    expect(snapshot.aspect).toBe(16 / 9);
  });
});
