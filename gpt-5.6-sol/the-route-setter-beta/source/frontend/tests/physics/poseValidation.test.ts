import RAPIER from '@dimforge/rapier3d-compat';
import { Object3D, Quaternion, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PHYSICS_CONFIG,
  HOLD_PENETRATION_TOLERANCE_METERS,
  parsePhysicsConfig,
} from '../../src/config/physicsConfig';
import {
  CONTACT_NUMERICAL_EPSILON,
  PhysicsWorld,
  type KinematicPhysicsObject,
} from '../../src/physics/physicsWorld';
import type { WallTriMeshData } from '../../src/scene/wallTriMesh';

const EPSILON = 2e-6;
const PENETRATIONS = [0, 0.0001, 0.0005, 0.0009, 0.001, 0.0011, 0.002];
const CONFIGURATIONS = [
  { name: 'identita', rotation: new Quaternion(), offset: new Vector3() },
  {
    name: 'rotazione e traslazione rigide',
    rotation: new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), 0.73),
    offset: new Vector3(0.37, -0.21, 0.16),
  },
];
const WINDINGS = [
  { name: 'originali', floor: false, wall: false },
  { name: 'pavimento invertito', floor: true, wall: false },
  { name: 'parete invertita', floor: false, wall: true },
  { name: 'entrambi invertiti', floor: true, wall: true },
];

let physics: PhysicsWorld | undefined;
let fetchSpy: ReturnType<typeof vi.fn<[], never>>;

beforeEach(() => {
  fetchSpy = vi.fn(() => { throw new Error('La validazione fisica non deve usare la rete.'); });
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('XMLHttpRequest', vi.fn(() => { throw new Error('XHR non consentito.'); }));
  vi.stubGlobal('WebSocket', vi.fn(() => { throw new Error('WebSocket non consentito.'); }));
});

afterEach(() => {
  try {
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(globalThis.XMLHttpRequest).not.toHaveBeenCalled();
    expect(globalThis.WebSocket).not.toHaveBeenCalled();
  } finally {
    physics?.dispose();
    physics = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

describe('validatePose con contatti Rapier nativi', () => {
  it('mantiene la tolleranza geometrica di 1 mm e quella numerica di 2 micrometri', () => {
    expect(HOLD_PENETRATION_TOLERANCE_METERS).toBe(0.001);
    expect(CONTACT_NUMERICAL_EPSILON).toBe(EPSILON);
  });

  describe.each(CONFIGURATIONS)('$name', ({ rotation, offset }) => {
    describe.each(WINDINGS)('corner90, winding $name', (winding) => {
      describe.each([1, -1])('lato %s delle due facce', (side) => {
        it.each(PENETRATIONS)('valida la penetrazione %s m con entrambe le normali uscenti', async (penetration) => {
          const floor = plane('z', 0, winding.floor);
          const wall = plane('x', 0, winding.wall);
          physics = await createPhysics(transformMesh({
            vertices: new Float32Array([...floor.vertices, ...wall.vertices]),
            indices: new Uint32Array([...floor.indices, ...Array.from(wall.indices, (index) => index + 4)]),
          }, rotation, offset));
          const moving = physics.createKinematicObject(
            RAPIER.ColliderDesc.cuboid(0.02, 0.015, 0.02),
            new Vector3(1, 1, 1),
            rotation,
          );
          const normals = [new Vector3(side, 0, 0), new Vector3(0, 0, side)]
            .map((normal) => normal.applyQuaternion(rotation));

          // La faccia non penetrata resta a contatto: la normale fornita non deve nascondere l'altra.
          for (const [depthX, depthZ] of [[penetration, 0], [0, penetration], [penetration, penetration]]) {
            const position = new Vector3(side * (0.02 - depthX), 0, side * (0.02 - depthZ))
              .applyQuaternion(rotation).add(offset);
            for (const normal of normals) {
              expect(physics.validatePose(moving, position, rotation, normal)).toEqual({
                valid: penetration <= 0.001,
                blocker: penetration <= 0.001 ? null : 'wall',
              });
              expect(Math.abs(physics.lastPoseDiagnostic!.penetrationMeters - penetration))
                .toBeLessThanOrEqual(EPSILON);
            }
          }
        });
      });
    });
  });

  it.each([1, -1])('applica epsilon senza aumentare la tolleranza geometrica, lato %s', async (side) => {
    physics = await createPhysics(plane('z'));
    const rotation = new Quaternion();
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003),
      new Vector3(0, 0, side * 0.01),
      rotation,
    );
    for (const [penetration, valid] of [[0.001 + EPSILON / 2, true], [0.001 + 2 * EPSILON, false]] as const) {
      expect(physics.validatePose(
        moving, new Vector3(0, 0, side * (0.003 - penetration)), rotation, new Vector3(0, 0, side),
      )).toEqual({ valid, blocker: valid ? null : 'wall' });
    }
  });

  it('rifiuta contatto negativo e intersezione falsa come incerti, senza certificare il percorso', async () => {
    physics = await createPhysics(plane('z'));
    const rotation = new Quaternion();
    const from = new Vector3(-0.01, 0, 0.0035);
    const to = new Vector3(0.01, 0, from.z);
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), from, rotation,
    );
    expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: true, blocker: null });
    const contactSpy = vi.spyOn(physics.wallCollider, 'contactShape').mockReturnValue({
      distance: -0.0005,
      point1: new Vector3(),
      point2: new Vector3(0, 0, -0.0005),
      normal1: new Vector3(0, 0, 1),
      normal2: new Vector3(0, 0, -1),
    });
    const intersectsSpy = vi.spyOn(physics.wallCollider, 'intersectsShape').mockReturnValue(false);

    // Anche una profondita entro 1 mm non e valida se le due query si contraddicono.
    expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: false, blocker: 'wall' });
    expect(physics.lastPoseDiagnostic).toMatchObject({
      uncertain: true, blocker: 'wall', colliderHandle: physics.wallCollider.handle,
    });
    expect(contactSpy).toHaveBeenCalled();
    expect(intersectsSpy).toHaveBeenCalled();
    contactSpy.mockClear();
    intersectsSpy.mockClear();
    expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation))
      .toEqual({ fraction: 0, blocker: 'wall', unresolved: true });
    expect(contactSpy).toHaveBeenCalled();
    expect(intersectsSpy).toHaveBeenCalled();
  });
});

describe('maximumValidPoseFraction con clearance Rapier nativa', () => {
  it('arresta il cubo gia appoggiato al pavimento contro una pinna nello stesso TriMesh', async () => {
    const floor = plane('z');
    physics = await createPhysics({
      vertices: new Float32Array([
        ...floor.vertices,
        0, -0.05, 0.001, 0, 0.05, 0.001, 0, 0.05, 0.05, 0, -0.05, 0.05,
      ]),
      indices: new Uint32Array([...floor.indices, 4, 5, 6, 4, 6, 7]),
    });
    const rotation = new Quaternion();
    const from = new Vector3(-0.01, 0, 0.003);
    const to = new Vector3(0.01, 0, from.z);
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), from, rotation,
    );
    const normal = new Vector3(0, 0, 1);
    expect(physics.world.colliders.len()).toBe(2);
    expect(physics.validatePose(moving, from, rotation, normal)).toEqual({ valid: true, blocker: null });
    expect(physics.validatePose(moving, to, rotation, normal)).toEqual({ valid: true, blocker: null });
    expect(physics.validatePose(moving, from.clone().lerp(to, 0.5), rotation, normal))
      .toEqual({ valid: false, blocker: 'wall' });

    const result = physics.maximumValidPoseFraction(moving, from, rotation, to, rotation);
    expect(result.fraction).toBeGreaterThan(0);
    expect(result.fraction).toBeLessThan(0.5);
    expect(result.blocker).toBe('wall');
    expect(physics.validatePose(moving, from.clone().lerp(to, result.fraction), rotation, normal))
      .toEqual({ valid: true, blocker: null });
  });

  describe.each(['wall', 'hold'] as const)('cuboide originale sottile contro %s', (blockerKind) => {
    it.each([1, -1])('arresta lo sweep fra endpoint liberi, direzione %s', async (direction) => {
      physics = await createPhysics(blockerKind === 'wall' ? plane('x') : plane('z', -1));
      const rotation = new Quaternion();
      const from = new Vector3(-direction * 0.01, 0, 0);
      const to = new Vector3(direction * 0.01, 0, 0);
      const moving = physics.createKinematicObject(
        RAPIER.ColliderDesc.cuboid(0.003, 0.0005, 0.0005), from, rotation,
      );
      if (blockerKind === 'hold') {
        physics.createKinematicObject(
          RAPIER.ColliderDesc.cuboid(0.0005, 0.004, 0.004), new Vector3(), rotation,
        );
      }
      expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: true, blocker: null });
      expect(physics.validatePose(moving, to, rotation)).toEqual({ valid: true, blocker: null });
      // Nessuna garanzia di profondita alle giunzioni interne: limite noto in docs/applicazione.md, DEC-025.
      const result = physics.maximumValidPoseFraction(moving, from, rotation, to, rotation);
      expect(result.fraction).toBeGreaterThan(0);
      expect(result.fraction).toBeLessThan(0.5);
      expect(result.blocker).toBe(blockerKind);
    });
  });

  it('esclude 40 cuboidi lontani dalle query native di posa e percorso', async () => {
    physics = await createPhysics(plane('z', -1));
    const rotation = new Quaternion();
    const from = new Vector3(-0.01, 0, 0);
    const to = new Vector3(0.01, 0, 0);
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), from, rotation,
    );
    physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.0005, 0.004, 0.004), new Vector3(), rotation,
    );
    // Le query convex/convex passano dalle shape normalizzate, non dai metodi del collider.
    const nativeSpies = [
      vi.spyOn(RAPIER.Shape.prototype, 'contactShape'),
      vi.spyOn(RAPIER.Shape.prototype, 'intersectsShape'),
      vi.spyOn(RAPIER.Collider.prototype, 'contactShape'),
      vi.spyOn(RAPIER.Collider.prototype, 'castShape'),
    ];
    const query = () => ({
      pose: physics!.validatePose(moving, new Vector3(), rotation),
      path: physics!.maximumValidPoseFraction(moving, from, rotation, to, rotation),
    });
    const baseline = query();
    expect(baseline.pose).toEqual({ valid: false, blocker: 'hold' });
    expect(baseline.path.fraction).toBeGreaterThan(0);
    expect(baseline.path.fraction).toBeLessThan(0.5);
    expect(baseline.path.blocker).toBe('hold');
    const counts = nativeSpies.map((spy) => spy.mock.calls.length);
    for (const count of counts) expect(count).toBeGreaterThan(0);
    for (const spy of nativeSpies) spy.mockClear();

    const farSpies = Array.from({ length: 40 }, (_, index) => {
      const far = physics!.createKinematicObject(
        RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), new Vector3(10 + index, 10, 10), rotation,
      );
      return [
        vi.spyOn(far.collider, 'contactShape'),
        vi.spyOn(far.collider, 'intersectsShape'),
        vi.spyOn(far.collider, 'castShape'),
      ];
    }).flat();
    expect(query()).toEqual(baseline);
    expect(nativeSpies.map((spy) => spy.mock.calls.length)).toEqual(counts);
    for (const spy of farSpies) expect(spy).not.toHaveBeenCalled();
  });

  describe.each(CONFIGURATIONS)('$name', ({ rotation, offset }) => {
    describe.each(['wall', 'hold'] as const)('ostacolo sottile %s', (blockerKind) => {
      it.each([1, -1])('arresta il percorso fra endpoint liberi, direzione %s', async (direction) => {
        physics = await createPhysics(transformMesh(
          blockerKind === 'wall' ? plane('x') : plane('z', -1), rotation, offset,
        ));
        const from = new Vector3(-direction * 0.01, 0, 0).applyQuaternion(rotation).add(offset);
        const to = new Vector3(direction * 0.01, 0, 0).applyQuaternion(rotation).add(offset);
        // Il raggio del cuboide e circa 3 mm; la parete TriMesh ha spessore nullo.
        const moving = physics.createKinematicObject(
          RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), from, rotation,
        );
        const blocker = blockerKind === 'hold' ? physics.createKinematicObject(
          RAPIER.ColliderDesc.cuboid(0.0005, 0.004, 0.004), offset, rotation,
        ) : undefined;
        expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: true, blocker: null });
        expect(physics.validatePose(moving, to, rotation)).toEqual({ valid: true, blocker: null });
        expect.soft(physics.validatePose(moving, offset, rotation)).toEqual({ valid: false, blocker: blockerKind });

        const result = physics.maximumValidPoseFraction(moving, from, rotation, to, rotation);
        // Lo sweep arresta al primo contatto; la tolleranza endpoint non autorizza attraversamenti.
        const limit = (0.01 - 0.003 - (blocker ? 0.0005 : 0)) / 0.02;
        expect(result.fraction).toBeGreaterThan(0);
        expect.soft(result.fraction).toBeGreaterThanOrEqual(limit - 0.01);
        expect.soft(result.fraction).toBeLessThanOrEqual(limit + EPSILON / 0.02);
        expect.soft(result.blocker).toBe(blockerKind);
        // Un arresto conservativo puo lasciare irrisolto il microintervallo sulla soglia.
        expect(typeof result.unresolved).toBe('boolean');
        expect(physics.validatePose(moving, from.clone().lerp(to, result.fraction), rotation))
          .toEqual({ valid: true, blocker: null });
        for (let repeat = 0; repeat < 5; repeat += 1) {
          expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation)).toEqual(result);
        }

        if (blocker) physics.removeKinematicObject(blocker);
        else physics.world.removeCollider(physics.wallCollider, false);
        expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation))
          .toEqual({ fraction: 1, blocker: null, unresolved: false });
      });
    });
  });

  it('ferma una rotazione di un grado per un piccolo ostacolo a meta arco, con endpoint liberi', async () => {
    physics = await createPhysics(plane('z', -1));
    const position = new Vector3();
    const fromRotation = new Quaternion();
    const toRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 180);
    const middleRotation = fromRotation.clone().slerp(toRotation, 0.5);
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(1, 0.00075, 0.00075), position, fromRotation,
    );
    // A 99 cm dal perno l'arco misura circa 17 mm, ben oltre lo spessore dei due collider.
    const blocker = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.0015),
      new Vector3(0.99, 0, 0).applyQuaternion(middleRotation),
      new Quaternion(),
    );
    expect(physics.validatePose(moving, position, fromRotation)).toEqual({ valid: true, blocker: null });
    expect(physics.validatePose(moving, position, toRotation)).toEqual({ valid: true, blocker: null });
    expect(physics.validatePose(moving, position, middleRotation)).toEqual({ valid: false, blocker: 'hold' });
    expect(physics.lastPoseDiagnostic!.penetrationMeters).toBeGreaterThan(0.001 + EPSILON);

    const result = physics.maximumValidPoseFraction(moving, position, fromRotation, position, toRotation);
    expect(result.fraction).toBeGreaterThan(0);
    expect(result.fraction).toBeLessThan(0.5);
    expect(result.blocker).toBe('hold');
    expect(typeof result.unresolved).toBe('boolean');
    expect(physics.validatePose(moving, position, fromRotation.clone().slerp(toRotation, result.fraction)))
      .toEqual({ valid: true, blocker: null });
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(physics.maximumValidPoseFraction(moving, position, fromRotation, position, toRotation)).toEqual(result);
    }
    physics.removeKinematicObject(blocker);
    expect(physics.maximumValidPoseFraction(moving, position, fromRotation, position, toRotation))
      .toEqual({ fraction: 1, blocker: null, unresolved: false });
  });

  describe.each([false, true])('pavimento con winding invertito: %s', (flipped) => {
    it.each([1, -1])('consente tangente e distacco dal contatto sul lato %s', async (side) => {
      physics = await createPhysics(plane('z', 0, flipped));
      const rotation = new Quaternion();
      const from = new Vector3(-0.01, 0, side * 0.003);
      const moving = physics.createKinematicObject(RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), from, rotation);
      expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: true, blocker: null });
      for (const to of [new Vector3(0.01, 0, from.z), new Vector3(from.x, 0, side * 0.02)]) {
        expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation))
          .toEqual({ fraction: 1, blocker: null, unresolved: false });
      }
    });
  });

  it('mantiene il contratto endpoint per un percorso di lunghezza nulla', async () => {
    physics = await createPhysics(plane('z'));
    const rotation = new Quaternion();
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), new Vector3(0, 0, 0.01), rotation,
    );
    for (const [z, valid] of [[0.003, true], [0.001, false]] as const) {
      const position = new Vector3(0, 0, z);
      expect(physics.validatePose(moving, position, rotation)).toEqual({ valid, blocker: valid ? null : 'wall' });
      expect(physics.maximumValidPoseFraction(moving, position, rotation, position, rotation))
        .toEqual({ fraction: valid ? 1 : 0, blocker: valid ? null : 'wall', unresolved: false });
    }
  });

  it('non modifica pose, destinazioni cinematiche, collider, rendering o argomenti e non avanza il mondo', async () => {
    physics = await createPhysics(plane('z', -1));
    const from = new Vector3(-0.01, 0, 0);
    const to = new Vector3(0.01, 0, 0);
    const fromRotation = new Quaternion();
    const toRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 180);
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), from, fromRotation,
    );
    const blocker = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.0005, 0.004, 0.004), new Vector3(), new Quaternion(),
    );
    moving.body.setNextKinematicTranslation({ x: 0.2, y: 0.3, z: 0.4 });
    moving.body.setNextKinematicRotation(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.4));
    const rendered = new Object3D();
    rendered.position.set(3, 2, 1);
    rendered.updateMatrix();
    physics.bindRenderingObject(moving.body, rendered);
    const snapshot = () => ({
      moving: objectState(moving),
      blocker: objectState(blocker),
      wall: objectState({ body: physics!.wallBody, collider: physics!.wallCollider }),
      bodyCount: physics!.world.bodies.len(),
      colliderCount: physics!.world.colliders.len(),
      rendering: [rendered.position.toArray(), rendered.quaternion.toArray(), rendered.matrix.toArray()],
      arguments: [from.toArray(), to.toArray(), fromRotation.toArray(), toRotation.toArray()],
    });
    const initial = snapshot();
    const stepSpy = vi.spyOn(physics.world, 'step');
    const result = physics.maximumValidPoseFraction(moving, from, fromRotation, to, toRotation);
    expect(result.fraction).toBeGreaterThan(0);
    expect.soft(result.fraction).toBeLessThan(1);
    expect.soft(result.blocker).toBe('hold');
    expect(snapshot()).toEqual(initial);
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(physics.maximumValidPoseFraction(moving, from, fromRotation, to, toRotation)).toEqual(result);
      expect(snapshot()).toEqual(initial);
    }
    expect(stepSpy).not.toHaveBeenCalled();
  });

  it('riproduce la stessa frazione ricreando il mondo nativo', async () => {
    const results = [];
    for (let repeat = 0; repeat < 4; repeat += 1) {
      physics = await createPhysics(plane('x'));
      const from = new Vector3(-0.01, 0, 0);
      const to = new Vector3(0.01, 0, 0);
      const rotation = new Quaternion();
      const moving = physics.createKinematicObject(
        RAPIER.ColliderDesc.cuboid(0.003, 0.003, 0.003), from, rotation,
      );
      const result = physics.maximumValidPoseFraction(moving, from, rotation, to, rotation);
      expect(result.fraction).toBeGreaterThan(0);
      expect.soft(result.fraction).toBeLessThan(0.5);
      expect.soft(result.blocker).toBe('wall');
      results.push(result);
      physics.dispose();
      physics = undefined;
    }
    expect(results).toEqual(Array(4).fill(results[0]));
  });
});

describe('tolleranze distinte per parete e hold', () => {
  it('usa 5 mm per la parete di default e mantiene 1 mm per le hold', async () => {
    expect(DEFAULT_PHYSICS_CONFIG).toEqual({ wallPenetrationToleranceMm: 5 });
    expect(HOLD_PENETRATION_TOLERANCE_METERS).toBe(0.001);
    physics = await PhysicsWorld.create(plane('z'));
    expect(physics.wallPenetrationToleranceMeters).toBe(0.005);
    const rotation = new Quaternion();
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02), new Vector3(0, 0, 0.03), rotation,
    );
    expect(physics.validatePose(moving, new Vector3(0, 0, 0.016), rotation))
      .toEqual({ valid: true, blocker: null });
    expect(physics.lastPoseDiagnostic!.penetrationMeters).toBeCloseTo(0.004, 6);
    expect(physics.lastPoseDiagnostic!.toleranceMeters).toBe(0.005);
  });

  describe.each([1, 3, 5, 10])('limite parete %s mm', (wallPenetrationToleranceMm) => {
    describe.each(['wall', 'hold'] as const)('endpoint contro %s', (blockerKind) => {
      it.each([1, -1])('verifica uguaglianza ed epsilon sul lato %s, anche a percorso nullo', async (side) => {
        physics = await PhysicsWorld.create(
          blockerKind === 'wall' ? plane('z') : plane('z', -1), { wallPenetrationToleranceMm },
        );
        const rotation = new Quaternion();
        const moving = physics.createKinematicObject(
          RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02), new Vector3(0, 0, side * 0.1), rotation,
        );
        const hold = blockerKind === 'hold' ? physics.createKinematicObject(
          RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02), new Vector3(), rotation,
        ) : undefined;
        const tolerance = blockerKind === 'wall' ? wallPenetrationToleranceMm / 1000 : 0.001;
        for (const [delta, valid] of [
          [-2 * EPSILON, true], [-EPSILON / 2, true], [0, true],
          [EPSILON / 2, true], [2 * EPSILON, false],
        ] as const) {
          const penetration = tolerance + delta;
          const position = new Vector3(0, 0, side * ((hold ? 0.04 : 0.02) - penetration));
          const blocker = valid ? null : blockerKind;
          expect(physics.validatePose(moving, position, rotation)).toEqual({ valid, blocker });
          expect(physics.lastPoseDiagnostic).toMatchObject({
            toleranceMeters: tolerance,
            colliderHandle: hold?.collider.handle ?? physics.wallCollider.handle,
            uncertain: false,
          });
          expect(Math.abs(physics.lastPoseDiagnostic!.penetrationMeters - penetration))
            .toBeLessThanOrEqual(EPSILON);
          expect(physics.maximumValidPoseFraction(moving, position, rotation, position, rotation))
            .toEqual({ fraction: valid ? 1 : 0, blocker, unresolved: false });
        }
      });
    });
  });

  describe.each([
    { wallDepth: 0.004, holdDepth: 0.002, valid: false, limiting: 'hold' },
    { wallDepth: 0.004, holdDepth: 0.0005, valid: true, limiting: 'hold' },
    { wallDepth: 0.006, holdDepth: 0.0005, valid: false, limiting: 'wall' },
  ] as const)('parete $wallDepth m, hold $holdDepth m', ({ wallDepth, holdDepth, valid, limiting }) => {
    it.each(['wall-first', 'hold-first'])('aggrega min(distance + tolerance), ordine %s', async (order) => {
      physics = await PhysicsWorld.create(plane('z'));
      const rotation = new Quaternion();
      const position = new Vector3(0, 0, 0.02 - wallDepth);
      const moving = physics.createKinematicObject(
        RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02), position, rotation,
      );
      const hold = physics.createKinematicObject(
        RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02), new Vector3(0.04 - holdDepth, 0, position.z), rotation,
      );
      // Si controlla solo l'ordine broad phase; distanze e intersezioni restano native.
      const candidates = order === 'wall-first'
        ? [physics.wallCollider, hold.collider] : [hold.collider, physics.wallCollider];
      const querySpy = vi.spyOn(physics.world, 'collidersWithAabbIntersectingAabb')
        .mockImplementation((_center, _extent, callback) => {
          for (const candidate of candidates) if (callback(candidate) === false) break;
        });
      const blocker = valid ? null : limiting;
      expect(physics.validatePose(moving, position, rotation)).toEqual({ valid, blocker });
      expect(physics.lastPoseDiagnostic).toMatchObject({
        blocker,
        colliderHandle: limiting === 'wall' ? physics.wallCollider.handle : hold.collider.handle,
        toleranceMeters: limiting === 'wall' ? 0.005 : 0.001,
        uncertain: false,
      });
      expect(physics.lastPoseDiagnostic!.penetrationMeters)
        .toBeCloseTo(limiting === 'wall' ? wallDepth : holdDepth, 6);
      expect(physics.maximumValidPoseFraction(moving, position, rotation, position, rotation))
        .toEqual({ fraction: valid ? 1 : 0, blocker, unresolved: false });
      expect(querySpy).toHaveBeenCalledTimes(2);
    });
  });

  it.each(['wall-first', 'hold-first'])('priorita alla hold confermata rispetto alla parete incerta, ordine %s', async (order) => {
    physics = await PhysicsWorld.create(plane('z'));
    expect(physics.wallPenetrationToleranceMeters).toBe(0.005);
    const rotation = new Quaternion();
    const from = new Vector3(0, 0, 0.016);
    const to = new Vector3(0, 0.001, from.z);
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02), from, rotation,
    );
    const hold = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02), new Vector3(0.038, 0, from.z), rotation,
    );
    const contactSpy = vi.spyOn(physics.wallCollider, 'contactShape').mockReturnValue({
      distance: -0.004,
      point1: new Vector3(),
      point2: new Vector3(0, 0, -0.004),
      normal1: new Vector3(0, 0, 1),
      normal2: new Vector3(0, 0, -1),
    });
    const intersectsSpy = vi.spyOn(physics.wallCollider, 'intersectsShape').mockReturnValue(false);
    const candidates = order === 'wall-first'
      ? [physics.wallCollider, hold.collider] : [hold.collider, physics.wallCollider];
    vi.spyOn(physics.world, 'collidersWithAabbIntersectingAabb')
      .mockImplementation((_center, _extent, callback) => {
        for (const candidate of candidates) if (callback(candidate) === false) break;
      });

    expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: false, blocker: 'hold' });
    expect(physics.lastPoseDiagnostic).toMatchObject({
      blocker: 'hold', colliderHandle: hold.collider.handle, toleranceMeters: 0.001, uncertain: false,
    });
    expect(physics.lastPoseDiagnostic!.penetrationMeters).toBeCloseTo(0.002, 6);
    expect(contactSpy).toHaveBeenCalled();
    expect(intersectsSpy).toHaveBeenCalled();
    expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation))
      .toEqual({ fraction: 0, blocker: 'hold', unresolved: false });

    candidates.splice(candidates.indexOf(hold.collider), 1);
    physics.removeKinematicObject(hold);
    expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: false, blocker: 'wall' });
    expect(physics.lastPoseDiagnostic).toMatchObject({
      blocker: 'wall', colliderHandle: physics.wallCollider.handle,
      penetrationMeters: 0.004, toleranceMeters: 0.005, uncertain: true,
    });
    expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation))
      .toEqual({ fraction: 0, blocker: 'wall', unresolved: true });
  });

  it.each([1, 5])('percorso tangente da 3 mm di penetrazione, limite parete %s mm', async (wallPenetrationToleranceMm) => {
    physics = await PhysicsWorld.create(plane('z'), { wallPenetrationToleranceMm });
    const rotation = new Quaternion();
    const from = new Vector3(-0.01, 0, 0.007);
    const to = new Vector3(0.01, 0, from.z);
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.01, 0.01, 0.01), from, rotation,
    );
    const valid = wallPenetrationToleranceMm === 5;
    const blocker = valid ? null : 'wall';
    for (const position of [from, to]) {
      expect(physics.validatePose(moving, position, rotation)).toEqual({ valid, blocker });
      expect(physics.lastPoseDiagnostic!.penetrationMeters).toBeCloseTo(0.003, 6);
    }
    expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation))
      .toEqual({ fraction: valid ? 1 : 0, blocker, unresolved: false });
  });

  it('una hold arresta il percorso anche se la parete ha una penetrazione consentita piu profonda', async () => {
    physics = await PhysicsWorld.create(plane('z'));
    const rotation = new Quaternion();
    const from = new Vector3(0, 0, 0.006);
    const to = new Vector3(0, 0.0015, from.z);
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.01, 0.01, 0.01), from, rotation,
    );
    expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: true, blocker: null });
    expect(physics.lastPoseDiagnostic!.penetrationMeters).toBeCloseTo(0.004, 6);
    expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation))
      .toEqual({ fraction: 1, blocker: null, unresolved: false });
    const hold = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.01, 0.01, 0.01), new Vector3(0, 0.0195, from.z), rotation,
    );
    // Entrambi i contatti esistono gia all'inizio: lo shape cast non basta a fermare il percorso.
    expect(physics.validatePose(moving, from, rotation)).toEqual({ valid: true, blocker: null });
    expect(physics.lastPoseDiagnostic!.penetrationMeters).toBeCloseTo(0.0005, 6);
    expect(physics.validatePose(moving, to, rotation)).toEqual({ valid: false, blocker: 'hold' });
    expect(physics.lastPoseDiagnostic!.penetrationMeters).toBeCloseTo(0.002, 6);
    const result = physics.maximumValidPoseFraction(moving, from, rotation, to, rotation);
    expect(result.fraction).toBeGreaterThan(0);
    expect(result.fraction).toBeLessThanOrEqual(1 / 3 + EPSILON / from.distanceTo(to));
    expect(result.blocker).toBe('hold');
    expect(physics.validatePose(moving, from.clone().lerp(to, result.fraction), rotation))
      .toEqual({ valid: true, blocker: null });
    physics.removeKinematicObject(hold);
    expect(physics.maximumValidPoseFraction(moving, from, rotation, to, rotation))
      .toEqual({ fraction: 1, blocker: null, unresolved: false });
  });
});

describe('configurazione fisica immutabile e locale alla sessione', () => {
  it('congela default e copia validata senza modificare il chiamante', () => {
    const input = { wallPenetrationToleranceMm: 3 };
    const config = parsePhysicsConfig(input);
    expect(config).toEqual(input);
    expect(config).not.toBe(input);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(DEFAULT_PHYSICS_CONFIG)).toBe(true);
    expect(Reflect.set(config, 'wallPenetrationToleranceMm', 10)).toBe(false);
    expect(Reflect.set(DEFAULT_PHYSICS_CONFIG, 'wallPenetrationToleranceMm', 10)).toBe(false);
    input.wallPenetrationToleranceMm = 1;
    expect(config.wallPenetrationToleranceMm).toBe(3);
    expect(DEFAULT_PHYSICS_CONFIG.wallPenetrationToleranceMm).toBe(5);
  });

  it('isola mondi simultanei e acquisisce la configurazione prima dell\'inizializzazione asincrona', async () => {
    const worlds: PhysicsWorld[] = [];
    try {
      const input = { wallPenetrationToleranceMm: 3 };
      const pending = PhysicsWorld.create(plane('z'), input);
      input.wallPenetrationToleranceMm = 10;
      worlds.push(await pending);
      worlds.push(await PhysicsWorld.create(plane('z'), input));
      worlds.push(await PhysicsWorld.create(plane('z')));
      input.wallPenetrationToleranceMm = 1;
      expect(worlds.map(world => world.wallPenetrationToleranceMeters)).toEqual([0.003, 0.01, 0.005]);
      for (const [index, world] of worlds.entries()) {
        const rotation = new Quaternion();
        const moving = world.createKinematicObject(
          RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02), new Vector3(0, 0, 0.03), rotation,
        );
        expect(world.validatePose(moving, new Vector3(0, 0, 0.016), rotation))
          .toEqual({ valid: index !== 0, blocker: index === 0 ? 'wall' : null });
      }
      expect(input).toEqual({ wallPenetrationToleranceMm: 1 });
      expect(DEFAULT_PHYSICS_CONFIG).toEqual({ wallPenetrationToleranceMm: 5 });
    } finally {
      for (const world of worlds) world.dispose();
    }
  });

  it.each([1, 1.5, 3, 5, 10])('accetta %s mm, inclusi estremi e valori frazionari', async (wallPenetrationToleranceMm) => {
    const config = { wallPenetrationToleranceMm };
    expect(parsePhysicsConfig(config)).toEqual(config);
    physics = await PhysicsWorld.create(plane('z'), config);
    expect(physics.wallPenetrationToleranceMeters).toBe(wallPenetrationToleranceMm / 1000);
  });

  it.each([
    0, 0.999, 10.001, -1, NaN, Infinity, -Infinity, '5', null, undefined,
  ])('rifiuta la soglia non valida %s senza fallback al default', async (wallPenetrationToleranceMm) => {
    const config = { wallPenetrationToleranceMm };
    expect(() => parsePhysicsConfig(config)).toThrow(/tra 1 e 10 mm/);
    await expect(PhysicsWorld.create(plane('z'), config as Parameters<typeof PhysicsWorld.create>[1]))
      .rejects.toThrow(/tra 1 e 10 mm/);
  });
});

function createPhysics(triMesh: WallTriMeshData): Promise<PhysicsWorld> {
  return PhysicsWorld.create(triMesh, { wallPenetrationToleranceMm: 1 });
}

/** Costruisce una superficie finita a due triangoli, anche con winding inverso. */
function plane(axis: 'x' | 'z', coordinate = 0, flipped = false): WallTriMeshData {
  const vertices = axis === 'z'
    ? [-2, -2, coordinate, 2, -2, coordinate, 2, 2, coordinate, -2, 2, coordinate]
    : [coordinate, -2, -2, coordinate, 2, -2, coordinate, 2, 2, coordinate, -2, 2];
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(flipped ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]),
  };
}

/** Applica una trasformazione rigida alla fixture senza cambiarne la topologia. */
function transformMesh(mesh: WallTriMeshData, rotation: Quaternion, offset: Vector3): WallTriMeshData {
  const vertices = mesh.vertices.slice();
  for (let index = 0; index < vertices.length; index += 3) {
    new Vector3().fromArray(vertices, index).applyQuaternion(rotation).add(offset).toArray(vertices, index);
  }
  return { vertices, indices: mesh.indices.slice() };
}

/** Fotografa lo stato fisico per verificare che le query non producano commit. */
function objectState({ body, collider }: KinematicPhysicsObject) {
  return {
    position: { ...body.translation() },
    rotation: { ...body.rotation() },
    nextPosition: { ...body.nextTranslation() },
    nextRotation: { ...body.nextRotation() },
    linearVelocity: { ...body.linvel() },
    angularVelocity: { ...body.angvel() },
    sleeping: body.isSleeping(),
    colliderPosition: { ...collider.translation() },
    colliderRotation: { ...collider.rotation() },
    shape: collider.shape,
  };
}
