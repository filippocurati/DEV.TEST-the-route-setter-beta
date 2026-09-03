import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PhysicsWorld } from '../../src/physics/physicsWorld';
import { limitMovementToFrontSurface } from '../../src/physics/normalMovement';

describe('suite fisica headless', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('inizializza mondo, parete statica e controller senza gravita', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());

    expect(physics.world.gravity).toEqual({ x: 0, y: 0, z: 0 });
    expect(physics.wallBody.isFixed()).toBe(true);
    expect(physics.wallCollider.isValid()).toBe(true);
    expect(physics.characterController.slideEnabled()).toBe(true);
    expect(physics.characterController.autostepEnabled()).toBe(false);
    expect(physics.characterController.snapToGroundEnabled()).toBe(false);

    physics.dispose();
  });

  it('crea corpi cinematici con CCD, attrito e rimbalzo nulli', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const object = physics.createKinematicObject(
      RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1),
      new Vector3(0, 0, 1),
      new Quaternion(),
    );

    expect(object.body.isKinematic()).toBe(true);
    expect(object.body.isCcdEnabled()).toBe(true);
    expect(object.collider.friction()).toBe(0);
    expect(object.collider.restitution()).toBe(0);

    physics.dispose();
  });

  it('sincronizza la trasformazione fisica verso la mesh', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const object = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 1),
      new Quaternion(),
    );
    const rendered = new Vector3(0, 0, 0);
    const mesh = {
      position: { set: vi.fn((x: number, y: number, z: number) => rendered.set(x, y, z)) },
      quaternion: { set: vi.fn() },
      updateMatrix: vi.fn(),
    };
    physics.bindRenderingObject(object.body, mesh as never);
    object.body.setNextKinematicTranslation({ x: 0.25, y: -0.5, z: 0.75 });

    physics.step();

    expect(rendered.x).toBeCloseTo(0.25);
    expect(rendered.y).toBeCloseTo(-0.5);
    expect(rendered.z).toBeCloseTo(0.75);
    expect(mesh.updateMatrix).toHaveBeenCalledOnce();
    physics.dispose();
  });

  it('trasla deterministicamente una presa non ancora agganciata', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const object = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 1),
      new Quaternion(),
    );

    physics.translateKinematicObject(object, { x: 0.01, y: 0, z: 0 });
    physics.step();

    expect(object.body.translation().x).toBeCloseTo(0.01);
    physics.dispose();
  });

  it('consente movimento libero e limita la compenetrazione con il fronte parete', () => {
    const front = new Vector3(0, 0, 0);
    const normal = new Vector3(0, 0, 1);

    expect(limitMovementToFrontSurface(new Vector3(0, 0, 2), front, normal, -0.01)).toBe(-0.01);
    expect(limitMovementToFrontSurface(new Vector3(0, 0, 0.005), front, normal, -0.01)).toBeCloseTo(-0.004);
    expect(limitMovementToFrontSurface(new Vector3(0, 0, 0.001), front, normal, -0.01)).toBe(0);
    expect(limitMovementToFrontSurface(new Vector3(0, 0, 0.001), front, normal, 0.01)).toBe(0.01);
  });

  it('blocca avanti contro un altro collider hold', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 1),
      new Quaternion(),
    );
    physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 0.805),
      new Quaternion(),
    );
    physics.world.updateSceneQueries();

    const movement = physics.movePreSnapWithCollisions(moving, { x: 0, y: 0, z: -0.01 });

    expect(movement.z).toBeGreaterThanOrEqual(-0.005);
    physics.dispose();
  });

  it('restituisce punto e normale del contatto parete', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());

    const contact = physics.castRayToWall({ x: 0, y: 0, z: 0.04 }, { x: 0, y: 0, z: -1 }, 1);

    expect(contact?.distance).toBeCloseTo(0.04);
    expect(contact?.point.z).toBeCloseTo(0);
    expect(Math.abs(contact?.normal.z ?? 0)).toBeCloseTo(1);
    physics.dispose();
  });

  it('move-and-slide tangenziale non attraversa un’altra hold', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 0.1),
      new Quaternion(),
    );
    physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0.21, 0, 0.1),
      new Quaternion(),
    );
    physics.world.updateSceneQueries();

    const movement = physics.moveTangentialWithCollisions(moving, { x: 0.1, y: 0.1, z: 0 });

    expect(movement.x).toBeLessThan(0.1);
    expect(movement.y).toBeGreaterThan(0.05);
    physics.dispose();
  });

  it('rifiuta una trasformazione candidata sovrapposta a un’altra hold', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 0.2),
      new Quaternion(),
    );
    physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0.15, 0, 0.2),
      new Quaternion(),
    );

    expect(physics.canPlaceWithoutHoldOverlap(moving, { x: 0.15, y: 0, z: 0.2 }, new Quaternion())).toBe(false);
    expect(physics.canPlaceWithoutHoldOverlap(moving, { x: -0.5, y: 0, z: 0.2 }, new Quaternion())).toBe(true);
    physics.dispose();
  });

  it('valida le pose 9UX contro parete e altre hold', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const moving = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 1),
      new Quaternion(),
    );
    physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0.5, 0, 0.2),
      new Quaternion(),
    );

    expect(physics.validatePose(moving, { x: 0, y: 0, z: 0.05 }, new Quaternion())).toEqual({
      valid: false,
      blocker: 'wall',
    });
    expect(physics.validatePose(moving, { x: 0.5, y: 0, z: 0.2 }, new Quaternion())).toEqual({
      valid: false,
      blocker: 'hold',
    });
    expect(physics.validatePose(moving, { x: -0.5, y: 0, z: 0.2 }, new Quaternion())).toEqual({
      valid: true,
      blocker: null,
    });
    physics.dispose();
  });

  it('usa move-and-slide bloccando la parete e mantenendo la componente libera', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const object = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 1),
      new Quaternion(),
    );
    physics.step();

    const movement = physics.moveKinematicObject(object, { x: 0.5, y: 0, z: -2 });

    expect(movement.z).toBeGreaterThan(-1);
    expect(movement.x).toBeGreaterThan(0.45);
    physics.step();
    expect(object.body.translation().z).toBeGreaterThanOrEqual(0.1);
    physics.dispose();
  });

  it('non effettua chiamate di rete durante movimento e step', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const physics = await PhysicsWorld.create(createPlaneTriMesh());
    const object = physics.createKinematicObject(
      RAPIER.ColliderDesc.ball(0.1),
      new Vector3(0, 0, 1),
      new Quaternion(),
    );

    for (let index = 0; index < 20; index += 1) {
      physics.moveKinematicObject(object, { x: 0.01, y: 0, z: 0 });
      physics.step();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    physics.dispose();
    fetchSpy.mockRestore();
  });

  it('rifiuta TriMesh malformati prima della creazione WASM', async () => {
    await expect(PhysicsWorld.create({
      vertices: new Float32Array([0, 0, 0]),
      indices: new Uint32Array([0, 1, 2]),
    })).rejects.toThrow('Il TriMesh deve contenere vertici XYZ validi.');

    await expect(PhysicsWorld.create({
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 4]),
    })).rejects.toThrow('Il TriMesh contiene indici fuori intervallo.');
  });

  it('rende idempotente il rilascio e blocca operazioni successive', async () => {
    const physics = await PhysicsWorld.create(createPlaneTriMesh());

    physics.dispose();
    physics.dispose();

    expect(() => physics.step()).toThrow('Il mondo fisico e gia stato rilasciato.');
  });
});

/** Crea un quadrato TriMesh sul piano Z=0, sufficiente per i test headless. */
function createPlaneTriMesh() {
  return {
    vertices: new Float32Array([
      -2, -2, 0,
      2, -2, 0,
      2, 2, 0,
      -2, 2, 0,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}
