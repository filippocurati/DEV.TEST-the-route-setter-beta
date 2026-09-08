import RAPIER from '@dimforge/rapier3d-compat';
import { Group, Mesh, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { HoldColliderDocument } from '../../src/api/holdApi';
import { PhysicsWorld } from '../../src/physics/physicsWorld';
import { addTwistAroundNormal, orientationFromNormal, projectAxisOnTangent } from '../../src/physics/snapMath';
import { createWallTriMesh } from '../../src/scene/wallTriMesh';

const WALL_HASH = 'sha256:c8db4d75886f287cb638829bec7b9ee438e5d7ca7a4ed6e9ee7c3a636404fc21';
const HOLD_NAMES = ['Hold1', 'Hold2'] as const;
const HOLD_HASHES = {
  Hold1: 'sha256:892435e4d418ee7446d5c13c715aa0e12ac74837bf73d7ad3103024a4336ba6d',
  Hold2: 'sha256:ed047f3dafed8d4d42be6418e9005b12c50a22d7776d1b69907a25e045b5933f',
};
const SIDE_POSES = [
  { z: -4.25, valid: true },
  { z: -4.1, valid: false },
  { z: -4, valid: false },
  { z: -3.75, valid: false },
  { z: -3.5, valid: true },
  { z: -3.25, valid: true },
  { z: -3, valid: false },
  { z: -2.75, valid: false },
  { z: -2.5, valid: false },
] as const;
// Rapier 0.12.0, twist canonico: profondita native in mm nello stesso ordine di SIDE_POSES.
const SIDE_DEPTHS_MM = {
  Hold1: [0.011, 4.688, 1.357, 2.016, 0.676, 0.010, 1.359, 2.026, 4.935],
  Hold2: [0.202, 4.425, 1.398, 2.082, 0.705, 0.165, 1.401, 2.095, 4.708],
};
const DEEP_DEPTHS_MM = { Hold1: 120.428, Hold2: 200.328 };
const TOLERANCES = [
  { label: '1 mm', mm: 1, accepted: 3 },
  { label: '3 mm', mm: 3, accepted: 7 },
  { label: '5 mm', mm: 5, accepted: 9 },
  { label: '10 mm', mm: 10, accepted: 9 },
  { label: 'default 5 mm', mm: undefined, accepted: 9 },
] as const;
const FRONT_PANELS = [
  { panel: 'sinistro inclinato', x: -4, angle: -20 },
  { panel: 'centrale verticale', x: 0, angle: 0 },
  { panel: 'destro inclinato', x: 4, angle: 10 },
] as const;

describe('fisica sulla parete GLB reale invariata', () => {
  let wall: Group | undefined;
  let physics: PhysicsWorld;
  let wallHash: string;
  const holds = new Map<string, { document: HoldColliderDocument; hash: string }>();

  beforeAll(async () => {
    // Il tsconfig frontend non include @types/node: importa il modulo reale con il solo contratto usato.
    const { readFile } = await vi.importActual<{
      readFile(path: URL): Promise<Uint8Array>;
    }>('node:fs/promises');
    const bytes = await readFile(new URL('../../../../main-wall/modello_parete.glb', import.meta.url));
    wallHash = await sourceHash(bytes);
    const gltf = await new GLTFLoader().parseAsync(
      new Uint8Array(bytes).buffer,
      '',
    );
    wall = gltf.scene;
    physics = await PhysicsWorld.create(createWallTriMesh(wall), { wallPenetrationToleranceMm: 1 });
    await Promise.all(HOLD_NAMES.map(async (name) => {
      const directory = new URL(`../../../../holds/${name}/`, import.meta.url);
      const [model, collider] = await Promise.all([
        readFile(new URL(`${name.toLowerCase()}.glb`, directory)),
        readFile(new URL('collider.json', directory)),
      ]);
      holds.set(name, {
        document: JSON.parse(new TextDecoder().decode(collider)) as HoldColliderDocument,
        hash: await sourceHash(model),
      });
    }));
  });

  afterAll(() => {
    physics?.dispose();
    wall?.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  });

  it('blocca lo SHA-256 della parete reale usata dalle regressioni', () => {
    expect(wallHash).toBe(WALL_HASH);
  });

  describe.each(HOLD_NAMES)('%s con collider originale', (name) => {
    it('verifica che il collider appartenga al GLB reale', () => {
      const { document, hash } = holds.get(name)!;
      expect(hash).toBe(HOLD_HASHES[name]);
      expect(document.sourceHash).toBe(hash);
    });

    it.each(SIDE_POSES)('mantiene normale e validita laterale a z=$z: $valid', ({ z, valid }) => {
      assertStablePose(physics, holds.get(name)!.document, new Vector3(20, 7, z), new Vector3(-1, 0, 0), valid);
    });

    it.each(FRONT_PANELS)('accetta la posa centrale sul pannello $panel', ({ x, angle }) => {
      const camera = new Vector3(x, 0, 20);
      const direction = new Vector3(0, 0, -1);
      const hit = physics.castRayToWall(camera, direction, 50);
      expect(hit).not.toBeNull();
      expect(hit!.normal.x).toBeCloseTo(0, 6);
      expect(hit!.normal.y).toBeCloseTo(Math.sin(angle * Math.PI / 180), 6);
      expect(hit!.normal.z).toBeCloseTo(Math.cos(angle * Math.PI / 180), 6);
      assertStablePose(physics, holds.get(name)!.document, camera, direction, true);
    });

    it.each(TOLERANCES)('$label: accetta $accepted/9 laterali, 3/3 frontali e rifiuta lo scontro profondo', async ({ mm, accepted }) => {
      const configured = await PhysicsWorld.create(
        createWallTriMesh(wall!),
        mm === undefined ? undefined : { wallPenetrationToleranceMm: mm },
      );
      try {
        expect(configured.wallPenetrationToleranceMeters).toBe((mm ?? 5) / 1000);
        const document = holds.get(name)!.document;
        const rows = SIDE_POSES.map(({ z, valid }, index) => {
          const expected = mm === 1 ? valid : mm === 3 ? z !== -4.1 && z !== -2.5 : true;
          const measured = assertStablePose(configured, document, new Vector3(20, 7, z), new Vector3(-1, 0, 0), expected);
          expect(measured.depthMm, `z=${z}`).toBeCloseTo(SIDE_DEPTHS_MM[name][index], 2);
          return { z, ...measured };
        });
        expect(rows.filter(row => row.valid)).toHaveLength(accepted);
        const deep = assertStablePose(configured, document, new Vector3(20, 7, -4.5), new Vector3(-1, 0, 0), false);
        expect(deep.depthMm).toBeCloseTo(DEEP_DEPTHS_MM[name], 2);
        expect(deep.depthMm).toBeGreaterThan(100);
        const front = FRONT_PANELS.map(({ x }) => assertStablePose(
          configured, document, new Vector3(x, 0, 20), new Vector3(0, 0, -1), true,
        ));
        expect(front.filter(row => row.valid)).toHaveLength(3);
        for (const row of front) expect(row.depthMm).toBeLessThan(0.002);
        console.info(`${name}, ${mm ?? 'default 5'} mm: laterali ${accepted}/9, frontali 3/3, profondo rifiutato; profondita native mm`, {
          side: rows.map(row => Number(row.depthMm.toFixed(3))),
          deep: Number(deep.depthMm.toFixed(3)),
        });
      } finally {
        configured.dispose();
      }
    });

    it.each(TOLERANCES)('$label: confronta passi locali di 1 cm e twist di 1 grado sui target da 4 mm senza mutazioni', async ({ mm }) => {
      const configured = await PhysicsWorld.create(
        createWallTriMesh(wall!),
        mm === undefined ? undefined : { wallPenetrationToleranceMm: mm },
      );
      const stepSpy = vi.spyOn(configured.world, 'step');
      try {
        const valid = (mm ?? 5) >= 5;
        const document = holds.get(name)!.document;
        for (const z of [-4.1, -2.5]) {
          const hit = configured.castRayToWall(new Vector3(20, 7, z), new Vector3(-1, 0, 0), 50);
          expect(hit).not.toBeNull();
          const point = new Vector3().copy(hit!.point);
          const normal = new Vector3().copy(hit!.normal).normalize();
          const rotation = orientationFromNormal(normal);
          const hold = configured.createKinematicObject(RAPIER.ColliderDesc.convexMesh(
            new Float32Array(document.vertices), new Uint32Array(document.indices),
          )!, point, rotation);
          try {
            // Destinazioni distinte: una query non deve nemmeno programmare un commit al prossimo step.
            hold.body.setNextKinematicTranslation(point.clone().addScalar(0.1));
            hold.body.setNextKinematicRotation(addTwistAroundNormal(rotation, normal, 0.2));
            const state = () => ({
              position: { ...hold.body.translation() },
              rotation: { ...hold.body.rotation() },
              nextPosition: { ...hold.body.nextTranslation() },
              nextRotation: { ...hold.body.nextRotation() },
              colliderPosition: { ...hold.collider.translation() },
              colliderRotation: { ...hold.collider.rotation() },
              bodies: configured.world.bodies.len(),
              colliders: configured.world.colliders.len(),
            });
            const initial = state();
            expect(configured.validatePose(hold, point, rotation, normal)).toEqual({ valid, blocker: valid ? null : 'wall' });
            expect(configured.lastPoseDiagnostic!.penetrationMeters).toBeGreaterThan(0.004);
            expect(configured.lastPoseDiagnostic!.penetrationMeters).toBeLessThan(0.005);
            expect(state()).toEqual(initial);

            for (const sign of [-1, 1]) {
              // Come moveSelected: asse vista up proiettato, raggio locale 2 cm, gap e angolo limitati.
              const delta = projectAxisOnTangent(new Vector3(0, 1, 0), normal, new Vector3(0, 1, 0))
                .multiplyScalar(sign * 0.01);
              expect(delta.length()).toBeCloseTo(0.01, 12);
              const candidate = point.clone().add(delta);
              const localHit = configured.castRayToWall(candidate.clone().addScaledVector(normal, 0.02), normal.clone().negate(), 0.04);
              expect(localHit).not.toBeNull();
              const projected = new Vector3().copy(localHit!.point);
              const projectedNormal = new Vector3().copy(localHit!.normal).normalize();
              if (projectedNormal.dot(normal) < 0) projectedNormal.negate();
              expect(projected.distanceTo(candidate)).toBeLessThan(0.005);
              expect(projectedNormal.angleTo(normal)).toBeLessThan(Math.PI / 36);
              const current = new Quaternion().copy(hold.body.rotation());
              const twisted = addTwistAroundNormal(current, normal, sign * Math.PI / 180);
              // angleTo richiede quaternioni unitari; Rapier restituisce componenti float32.
              expect(current.clone().normalize().angleTo(twisted)).toBeCloseTo(Math.PI / 180, 8);

              for (const target of [
                { from: point, to: projected, rotation: orientationFromNormal(projectedNormal), normal: projectedNormal },
                { from: new Vector3().copy(hold.body.translation()), to: new Vector3().copy(hold.body.translation()), rotation: twisted, normal },
              ]) {
                const argumentsBefore = [target.from.toArray(), current.toArray(), target.to.toArray(), target.rotation.toArray(), target.normal.toArray()];
                for (let repeat = 0; repeat < 3; repeat += 1) {
                  expect(configured.maximumValidPoseFraction(hold, target.from, current, target.to, target.rotation))
                    .toEqual({ fraction: valid ? 1 : 0, blocker: valid ? null : 'wall', unresolved: false });
                  expect(state()).toEqual(initial);
                  expect(configured.validatePose(hold, target.to, target.rotation, target.normal))
                    .toEqual({ valid, blocker: valid ? null : 'wall' });
                  expect(state()).toEqual(initial);
                  expect([target.from.toArray(), current.toArray(), target.to.toArray(), target.rotation.toArray(), target.normal.toArray()])
                    .toEqual(argumentsBefore);
                }
              }
            }
          } finally {
            configured.removeKinematicObject(hold);
          }
        }
        expect(stepSpy).not.toHaveBeenCalled();
      } finally {
        stepSpy.mockRestore();
        configured.dispose();
      }
    });
  });
});

/** Calcola lo stesso hash SHA-256 registrato nei collider pre-calcolati. */
async function sourceHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Ripete raycast e validazione senza correggere normale o posa, con una sola presa nel mondo. */
function assertStablePose(
  physics: PhysicsWorld,
  document: HoldColliderDocument,
  camera: Vector3,
  direction: Vector3,
  valid: boolean,
): { valid: boolean; depthMm: number } {
  const descriptor = RAPIER.ColliderDesc.convexMesh(
    new Float32Array(document.vertices),
    new Uint32Array(document.indices),
  );
  expect(descriptor).not.toBeNull();
  const hold = physics.createKinematicObject(descriptor!, camera, new Quaternion());
  try {
    const initial = physics.castRayToWall(camera, direction, 50);
    expect(initial).not.toBeNull();
    let measured = { valid: false, depthMm: 0 };
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const hit = physics.castRayToWall(camera, direction, 50);
      expect(hit).toEqual(initial);
      if (!hit) throw new Error('Il raggio non incontra la parete reale.');
      expect(hit.distance).toBeGreaterThan(0);
      const point = new Vector3().copy(hit.point);
      const normal = new Vector3().copy(hit.normal);
      expect(normal.length()).toBeCloseTo(1, 6);
      expect(normal.dot(camera.clone().sub(point).normalize())).toBeGreaterThan(0);
      expect(point.distanceTo(camera.clone().addScaledVector(direction, hit.distance))).toBeLessThan(1e-5);
      const rotation = orientationFromNormal(normal);
      const outward = new Vector3(0, 0, 1).applyQuaternion(rotation);
      expect(outward.dot(normal)).toBeCloseTo(1, 6);
      expect(outward.dot(camera.clone().sub(point).normalize())).toBeGreaterThan(0);
      const contact = physics.wallCollider.contactShape(hold.collider.shape, point, rotation, 0.01);
      expect(contact).not.toBeNull();
      expect(physics.wallCollider.intersectsShape(hold.collider.shape, point, rotation)).toBe(true);
      const result = physics.validatePose(hold, point, rotation, normal);
      expect(result).toEqual({
        valid,
        blocker: valid ? null : 'wall',
      });
      expect(physics.lastPoseDiagnostic!.uncertain).toBe(false);
      expect(physics.lastPoseDiagnostic!.penetrationMeters).toBeCloseTo(Math.max(0, -contact!.distance), 6);
      const current = { valid: result.valid, depthMm: Math.max(0, -contact!.distance) * 1000 };
      if (iteration > 0) expect(current).toEqual(measured);
      measured = current;
    }
    return measured;
  } finally {
    physics.removeKinematicObject(hold);
  }
}
