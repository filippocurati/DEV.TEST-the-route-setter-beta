import type RAPIER from '@dimforge/rapier3d-compat';
import type { Object3D, Quaternion, Vector3 } from 'three';
import type { WallTriMeshData } from '../scene/wallTriMesh';
import { initializeRapier, type RapierApi } from './rapierRuntime';
import {
  synchronizePhysicsToRendering,
  type PhysicsRenderBinding,
} from './transformSync';

const ZERO_GRAVITY = Object.freeze({ x: 0, y: 0, z: 0 });
const CHARACTER_OFFSET_METERS = 0.001;

/** Corpo cinematico predisposto per una futura presa e collegabile alla relativa mesh grafica. */
export interface KinematicPhysicsObject {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
}

/** Fondazione fisica client-side della sessione, priva di dipendenze REST. */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly wallBody: RAPIER.RigidBody;
  readonly wallCollider: RAPIER.Collider;
  readonly characterController: RAPIER.KinematicCharacterController;

  private readonly rapier: RapierApi;
  private readonly bindings = new Set<PhysicsRenderBinding>();
  private disposed = false;

  /** Crea mondo, parete TriMesh statica e controller move-and-slide. */
  private constructor(rapier: RapierApi, triMesh: WallTriMeshData) {
    this.rapier = rapier;
    this.world = new rapier.World(ZERO_GRAVITY);
    this.wallBody = this.world.createRigidBody(rapier.RigidBodyDesc.fixed());
    this.wallCollider = this.world.createCollider(
      rapier.ColliderDesc.trimesh(triMesh.vertices, triMesh.indices)
        .setFriction(0)
        .setRestitution(0)
        .setActiveCollisionTypes(rapier.ActiveCollisionTypes.ALL),
      this.wallBody,
    );
    this.characterController = this.world.createCharacterController(CHARACTER_OFFSET_METERS);
    this.characterController.setSlideEnabled(true);
    this.characterController.setApplyImpulsesToDynamicBodies(false);
    this.characterController.disableAutostep();
    this.characterController.disableSnapToGround();
  }

  /** Inizializza Rapier WASM e crea la fondazione fisica per il TriMesh indicato. */
  static async create(triMesh: WallTriMeshData): Promise<PhysicsWorld> {
    validateTriMesh(triMesh);
    return new PhysicsWorld(await initializeRapier(), triMesh);
  }

  /** Predispone un corpo cinematico CCD con collider già calcolato, senza generare hull. */
  createKinematicObject(
    colliderDescriptor: RAPIER.ColliderDesc,
    position: Vector3,
    rotation: Quaternion,
  ): KinematicPhysicsObject {
    this.ensureActive();
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(position.x, position.y, position.z)
        .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
        .setCcdEnabled(true)
        .setGravityScale(0),
    );
    const collider = this.world.createCollider(
      colliderDescriptor
        .setFriction(0)
        .setRestitution(0)
        .setActiveCollisionTypes(this.rapier.ActiveCollisionTypes.ALL),
      body,
    );
    return { body, collider };
  }

  /** Registra una mesh grafica da sincronizzare con il relativo corpo Rapier. */
  bindRenderingObject(body: RAPIER.RigidBody, object: Object3D): () => void {
    this.ensureActive();
    const binding = { body, object };
    this.bindings.add(binding);
    return () => this.bindings.delete(binding);
  }

  /** Calcola move-and-slide e programma la posizione cinematica consentita. */
  moveKinematicObject(object: KinematicPhysicsObject, desiredDelta: RAPIER.Vector): RAPIER.Vector {
    this.ensureActive();
    this.characterController.computeColliderMovement(object.collider, desiredDelta);
    const movement = this.characterController.computedMovement();
    const current = object.body.translation();
    object.body.setNextKinematicTranslation({
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    });
    return { x: movement.x, y: movement.y, z: movement.z };
  }

  /** Programma la rotazione cinematica che verrà applicata al prossimo step. */
  rotateKinematicObject(object: KinematicPhysicsObject, rotation: RAPIER.Rotation): void {
    this.ensureActive();
    object.body.setNextKinematicRotation(rotation);
  }

  /** Rimuove corpo e collider associati a un'istanza che lascia la scena. */
  removeKinematicObject(object: KinematicPhysicsObject): void {
    this.ensureActive();
    this.world.removeRigidBody(object.body);
  }

  /** Avanza il mondo con passo deterministico e sincronizza tutte le mesh registrate. */
  step(): void {
    this.ensureActive();
    this.world.step();
    synchronizePhysicsToRendering(this.bindings);
  }

  /** Rilascia controller e mondo WASM appartenenti alla sessione. */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.bindings.clear();
    this.world.removeCharacterController(this.characterController);
    this.world.free();
    this.disposed = true;
  }

  /** Impedisce operazioni su risorse WASM già rilasciate. */
  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Il mondo fisico e gia stato rilasciato.');
    }
  }
}

/** Valida il contratto geometrico prima di attraversare il confine WASM. */
function validateTriMesh(triMesh: WallTriMeshData): void {
  if (triMesh.vertices.length < 9 || triMesh.vertices.length % 3 !== 0) {
    throw new Error('Il TriMesh deve contenere vertici XYZ validi.');
  }
  if (triMesh.indices.length < 3 || triMesh.indices.length % 3 !== 0) {
    throw new Error('Il TriMesh deve contenere indici triangolari validi.');
  }
  const vertexCount = triMesh.vertices.length / 3;
  if (triMesh.indices.some((index) => index >= vertexCount)) {
    throw new Error('Il TriMesh contiene indici fuori intervallo.');
  }
}
