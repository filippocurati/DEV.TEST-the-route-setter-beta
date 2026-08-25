import { describe, expect, it } from 'vitest';
import { createSpawnCandidateOffsets, findFirstAvailableSpawn } from '../../src/scene/spawnCandidates';

describe('candidati spawn deterministici', () => {
  it('parte dal centro e visita cardinali e diagonali in ordine stabile', () => {
    const candidates = createSpawnCandidateOffsets({ halfWidth: 0.6, halfHeight: 0.6, step: 0.3, margin: 0 });

    expect(candidates.slice(0, 9).map((point) => point.toArray())).toEqual([
      [0, 0],
      [0, 0.3],
      [0.3, 0],
      [0, -0.3],
      [-0.3, 0],
      [0.3, 0.3],
      [0.3, -0.3],
      [-0.3, -0.3],
      [-0.3, 0.3],
    ]);
  });

  it('limita tutti i candidati al bounding frontale esteso dal margine', () => {
    const candidates = createSpawnCandidateOffsets({ halfWidth: 0.45, halfHeight: 0.75, step: 0.3, margin: 0.3 });

    expect(candidates.every((point) => Math.abs(point.x) <= 0.75 && Math.abs(point.y) <= 1.05)).toBe(true);
    expect(new Set(candidates.map((point) => point.toArray().join(','))).size).toBe(candidates.length);
  });

  it('rifiuta configurazioni non valide', () => {
    expect(() => createSpawnCandidateOffsets({ halfWidth: 1, halfHeight: 1, step: 0 })).toThrow(
      'Configurazione griglia spawn non valida.',
    );
  });

  it('seleziona il primo libero e restituisce null solo dopo esaurimento', () => {
    const candidates = ['center', 'up', 'right'];

    expect(findFirstAvailableSpawn(candidates, (candidate) => candidate === 'right')).toEqual({
      candidate: 'right',
      index: 2,
    });
    expect(findFirstAvailableSpawn(candidates, () => false)).toBeNull();
  });
});
