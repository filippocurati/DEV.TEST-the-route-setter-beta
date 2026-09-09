import type RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3, type Object3D } from 'three';
import type { WallTriMeshData } from '../scene/wallTriMesh';
import { initializeRapier, type RapierApi } from './rapierRuntime';
import { DEFAULT_PHYSICS_CONFIG, HOLD_PENETRATION_TOLERANCE_METERS, parsePhysicsConfig, type PhysicsConfig } from '../config/physicsConfig';
import {
  synchronizePhysicsToRendering,
  type PhysicsRenderBinding,
} from './transformSync';

const ZERO_GRAVITY = Object.freeze({ x: 0, y: 0, z: 0 });
const CHARACTER_OFFSET_METERS = 0.001;
const COLLISION_MARGIN_METERS = 0.001;
// Margine di arrotondamento WASM float32, distinto dalla tolleranza geometrica.
export const CONTACT_NUMERICAL_EPSILON = 0.000002;

/** Arresto conservativo di una trasformazione incrementale, senza modificare il corpo. */
export interface PosePathValidation {
  readonly fraction: number;
  readonly blocker: PoseValidation['blocker'];
  readonly unresolved: boolean;
}

/** Ultima query endpoint, disponibile per il troubleshooting senza log per frame. */
export interface PoseDiagnostic {
  readonly position: readonly number[];
  readonly rotation: readonly number[];
  readonly blocker: PoseValidation['blocker'];
  readonly penetrationMeters: number;
  readonly colliderHandle: number | null;
  readonly uncertain: boolean;
  readonly toleranceMeters: number;
}

/** Corpo cinematico predisposto per una futura presa e collegabile alla relativa mesh grafica. */
export interface KinematicPhysicsObject {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
}

/** Contatto raycast con la parete fisica. */
export interface WallRayContact {
  readonly point: RAPIER.Vector;
  readonly normal: RAPIER.Vector;
  readonly distance: number;
  readonly featureId: number;
}

/** Esito della verifica di una posa e tipo di ostacolo che eventualmente la impedisce. */
export interface PoseValidation {
  readonly valid: boolean;
  readonly blocker: 'wall' | 'hold' | null;
}

/** Fondazione fisica client-side della sessione, priva di dipendenze REST. */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly wallBody: RAPIER.RigidBody;
  readonly wallCollider: RAPIER.Collider;
  readonly characterController: RAPIER.KinematicCharacterController;
  readonly wallPenetrationToleranceMeters: number;

  private readonly rapier: RapierApi;
  private readonly bindings = new Set<PhysicsRenderBinding>();
  private disposed = false;
  private readonly normalizedShapes = new Map<number, RAPIER.Shape>();
  private readonly colliderRadii = new Map<number, number>();
  lastPoseDiagnostic: PoseDiagnostic | null = null;

  /** Crea mondo, parete TriMesh statica e controller move-and-slide. */
  private constructor(rapier: RapierApi, triMesh: WallTriMeshData, config: PhysicsConfig) {
    this.rapier = rapier;
    this.wallPenetrationToleranceMeters = config.wallPenetrationToleranceMm / 1000;
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
  static async create(triMesh: WallTriMeshData, config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG): Promise<PhysicsWorld> {
    validateTriMesh(triMesh);
    const validatedConfig = parsePhysicsConfig(config);
    return new PhysicsWorld(await initializeRapier(), triMesh, validatedConfig);
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

  /** Esegue move-and-slide immediato contro le altre hold, escludendo il TriMesh parete. */
  moveTangentialWithCollisions(
    object: KinematicPhysicsObject,
    desiredDelta: RAPIER.Vector,
  ): RAPIER.Vector {
    this.ensureActive();
    this.world.updateSceneQueries();
    this.characterController.computeColliderMovement(
      object.collider,
      desiredDelta,
      undefined,
      undefined,
      (candidate) => candidate.handle !== this.wallCollider.handle,
    );
    const movement = this.characterController.computedMovement();
    const current = object.body.translation();
    this.setKinematicTransform(object, {
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    }, object.body.rotation());
    return { x: movement.x, y: movement.y, z: movement.z };
  }

  /** Cerca il contatto più vicino con il solo collider parete lungo il raggio indicato. */
  castRayToWall(origin: RAPIER.Vector, direction: RAPIER.Vector, maxDistance: number): WallRayContact | null {
    this.ensureActive();
    const directionLength = Math.hypot(direction.x, direction.y, direction.z);
    if (directionLength === 0) return null;
    const ray = new this.rapier.Ray(origin, direction);
    const hit = this.wallCollider.castRayAndGetNormal(ray, maxDistance, true);
    if (!hit) return null;
    return {
      point: {
        x: origin.x + direction.x * hit.toi,
        y: origin.y + direction.y * hit.toi,
        z: origin.z + direction.z * hit.toi,
      },
      normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
      distance: hit.toi * directionLength,
      featureId: hit.featureId ?? Number.MAX_SAFE_INTEGER,
    };
  }

  /** Valida ogni contatto con la sua soglia: parete configurabile, altre prese sempre 1 mm. */
  validatePose(
    object: KinematicPhysicsObject,
    translation: RAPIER.Vector,
    rotation: RAPIER.Rotation,
    outwardNormal?: RAPIER.Vector,
  ): PoseValidation {
    this.ensureActive();
    this.world.updateSceneQueries();
    if (outwardNormal && (!Number.isFinite(Math.hypot(outwardNormal.x, outwardNormal.y, outwardNormal.z))
      || Math.hypot(outwardNormal.x, outwardNormal.y, outwardNormal.z) < 1e-8)) {
      throw new Error('La normale della posa non e valida.');
    }
    const contact = this.poseClearance(object, translation, rotation, this.wallPenetrationToleranceMeters);
    const blocker = contact.uncertain || contact.margin < -CONTACT_NUMERICAL_EPSILON
      ? contact.blocker : null;
    this.lastPoseDiagnostic = {
      position: [translation.x, translation.y, translation.z],
      rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
      blocker,
      penetrationMeters: Math.max(0, -contact.distance),
      colliderHandle: contact.handle,
      uncertain: contact.uncertain,
      toleranceMeters: contact.tolerance,
    };
    return { valid: blocker === null, blocker };
  }

  /** Misura la posa originale contro tutti i collider, senza offset legati al pannello. */
  private poseClearance(
    object: KinematicPhysicsObject,
    translation: RAPIER.Vector,
    rotation: RAPIER.Rotation,
    prediction: number,
  ): { distance: number; margin: number; tolerance: number; blocker: PoseValidation['blocker']; handle: number | null; uncertain: boolean } {
    let distance = prediction;
    let tolerance = HOLD_PENETRATION_TOLERANCE_METERS;
    let margin = prediction + tolerance;
    let blocker: PoseValidation['blocker'] = null;
    let handle: number | null = null;
    const uncertainContacts: Array<{ distance: number; tolerance: number; blocker: PoseValidation['blocker']; handle: number }> = [];
    const extent = this.colliderRadius(object.collider) + prediction;
    this.world.collidersWithAabbIntersectingAabb(translation, { x: extent, y: extent, z: extent }, (candidate) => {
      if (candidate.handle === object.collider.handle) return true;
      const shape = object.collider.shape;
      // Normalizzazione solo delle query convex/convex: evita l'early exit GJK su collider millimetrici.
      // Nessuna rigenerazione dell'hull: si scalano gli stessi vertici precalcolati.
      const normalizedMoving = candidate.handle === this.wallCollider.handle ? null : this.normalizedShape(object.collider);
      const normalizedOther = normalizedMoving ? this.normalizedShape(candidate) : null;
      const relative = new Vector3().copy(translation).sub(candidate.translation()).multiplyScalar(100);
      const contact = normalizedMoving && normalizedOther
        ? normalizedOther.contactShape(ZERO_GRAVITY, candidate.rotation(), normalizedMoving, relative, rotation, prediction * 100)
        : candidate.contactShape(shape, translation, rotation, prediction);
      const contactDistance = contact ? contact.distance / (normalizedMoving && normalizedOther ? 100 : 1) : prediction;
      // Le query di contatto possono produrre profondita spurie su triangoli molto allungati.
      // Un contatto negativo deve essere confermato dalla query nativa di intersezione.
      const intersects = normalizedMoving && normalizedOther
        ? normalizedOther.intersectsShape(ZERO_GRAVITY, candidate.rotation(), normalizedMoving, relative, rotation)
        : candidate.intersectsShape(shape, translation, rotation);
      const contradictory = (intersects && (!contact || contactDistance > CONTACT_NUMERICAL_EPSILON))
        || (contactDistance < -CONTACT_NUMERICAL_EPSILON && !intersects);
      const candidateTolerance = candidate.handle === this.wallCollider.handle
        ? this.wallPenetrationToleranceMeters : HOLD_PENETRATION_TOLERANCE_METERS;
      // Non trasformare una risposta contraddittoria in una clearance positiva certificata.
      if (contradictory) {
        const candidateBlocker = candidate.handle === this.wallCollider.handle ? 'wall' : 'hold';
        if (!uncertainContacts[0] || candidate.handle < uncertainContacts[0].handle) {
          uncertainContacts[0] = { distance: contactDistance, tolerance: candidateTolerance, blocker: candidateBlocker, handle: candidate.handle };
        }
        return true;
      }
      const measured = contactDistance;
      const candidateMargin = measured + candidateTolerance;
      // Il contatto piu profondo non e necessariamente quello che supera la propria soglia.
      if (candidateMargin >= margin) return true;
      distance = measured;
      tolerance = candidateTolerance;
      margin = candidateMargin;
      blocker = candidate.handle === this.wallCollider.handle ? 'wall' : 'hold';
      handle = candidate.handle;
      return true;
    });
    // Una violazione accertata prevale sull'incertezza di un altro collider; i campi restano coerenti.
    if (uncertainContacts[0] && margin >= -CONTACT_NUMERICAL_EPSILON) {
      return { ...uncertainContacts[0], margin: 0, uncertain: true };
    }
    return { distance, margin, tolerance, blocker, handle, uncertain: false };
  }

  /** Raggio conservativo intorno al pivot per broad phase e massimo spostamento rotazionale. */
  private colliderRadius(collider: RAPIER.Collider): number {
    const cached = this.colliderRadii.get(collider.handle);
    if (cached !== undefined) return cached;
    const shape = collider.shape;
    let radius = Infinity;
    if (shape.type === this.rapier.ShapeType.ConvexPolyhedron) {
      const vertices = (shape as RAPIER.ConvexPolyhedron).vertices;
      radius = 0;
      for (let i = 0; i < vertices.length; i += 3) radius = Math.max(radius, Math.hypot(vertices[i], vertices[i + 1], vertices[i + 2]));
    } else if (shape.type === this.rapier.ShapeType.Cuboid) {
      const half = (shape as RAPIER.Cuboid).halfExtents;
      radius = Math.hypot(half.x, half.y, half.z);
    } else if (shape.type === this.rapier.ShapeType.Ball) radius = (shape as RAPIER.Ball).radius;
    this.colliderRadii.set(collider.handle, radius);
    return radius;
  }

  /** Memorizza copie geometriche scalate per le query native, senza aggiungerle al mondo. */
  private normalizedShape(collider: RAPIER.Collider): RAPIER.Shape | null {
    const cached = this.normalizedShapes.get(collider.handle);
    if (cached) return cached;
    const source = collider.shape;
    let scaled: RAPIER.Shape;
    if (source.type === this.rapier.ShapeType.Cuboid) {
      const half = (source as RAPIER.Cuboid).halfExtents;
      scaled = new this.rapier.Cuboid(half.x * 100, half.y * 100, half.z * 100);
    } else if (source.type === this.rapier.ShapeType.Ball) {
      scaled = new this.rapier.Ball((source as RAPIER.Ball).radius * 100);
    } else if (source.type === this.rapier.ShapeType.ConvexPolyhedron) {
      const convex = source as RAPIER.ConvexPolyhedron;
      scaled = new this.rapier.ConvexPolyhedron(convex.vertices.map(value => value * 100), convex.indices);
    } else return null;
    this.normalizedShapes.set(collider.handle, scaled);
    return scaled;
  }

  /**
   * Certifica intervalli mediante distanza Rapier e massimo spostamento di ogni punto del collider.
   * La suddivisione include la rotazione: endpoint liberi non permettono di saltare un ostacolo.
   * Un intervallo non risolto entro il budget viene bloccato, mai accettato per campionamento.
   */
  maximumValidPoseFraction(
    object: KinematicPhysicsObject,
    fromPosition: RAPIER.Vector,
    fromRotation: RAPIER.Rotation,
    toPosition: RAPIER.Vector,
    toRotation: RAPIER.Rotation,
  ): PosePathValidation {
    this.ensureActive();
    this.world.updateSceneQueries();
    const start = new Vector3().copy(fromPosition);
    const end = new Vector3().copy(toPosition);
    const rotationStart = new Quaternion().copy(fromRotation);
    const rotationEnd = new Quaternion().copy(toRotation);
    const shape = object.collider.shape;
    const radius = this.colliderRadius(object.collider);
    if (!Number.isFinite(radius)) {
      return { fraction: 0, blocker: null, unresolved: true };
    }
    const travel = start.distanceTo(end) + radius * rotationStart.angleTo(rotationEnd);
    if (travel < 1e-12) {
      const pose = this.validatePose(object, toPosition, toRotation);
      return { fraction: pose.valid ? 1 : 0, blocker: pose.blocker, unresolved: false };
    }
    let sweepLimit = 1;
    let sweepBlocker: PoseValidation['blocker'] = null;
    const displacement = end.clone().sub(start);
    if (displacement.lengthSq() > 1e-16 && rotationStart.angleTo(rotationEnd) < 1e-8) {
      const sweepCenter = start.clone().lerp(end, 0.5);
      const extent = radius + displacement.length() / 2 + CONTACT_NUMERICAL_EPSILON;
      this.world.collidersWithAabbIntersectingAabb(sweepCenter, { x: extent, y: extent, z: extent }, (candidate) => {
        if (candidate.handle === object.collider.handle) return true;
        const initialContact = candidate.contactShape(shape, start, rotationStart, CONTACT_NUMERICAL_EPSILON);
        if (initialContact && initialContact.distance <= CONTACT_NUMERICAL_EPSILON) return true;
        const hit = candidate.castShape(
          { x: 0, y: 0, z: 0 }, shape, start, rotationStart, displacement, 1, false,
        );
        // I contatti gia presenti (appoggio/tangente) sono verificati dagli intervalli sotto.
        if (hit && hit.toi > 1e-6 && hit.toi < sweepLimit) {
          sweepLimit = Math.max(0, hit.toi - CONTACT_NUMERICAL_EPSILON / travel);
          sweepBlocker = candidate.handle === this.wallCollider.handle ? 'wall' : 'hold';
        }
        return true;
      });
    }
    const pending: Array<readonly [number, number]> = [[0, sweepLimit]];
    let fraction = 0;
    let blocker: PoseValidation['blocker'] = null;
    for (let queries = 0; pending.length > 0 && queries < 512; queries += 1) {
      const [a, b] = pending.pop()!;
      const mid = (a + b) / 2;
      const bound = travel * (b - a) / 2;
      const contact = this.poseClearance(object, start.clone().lerp(end, mid), rotationStart.clone().slerp(rotationEnd, mid), bound + this.wallPenetrationToleranceMeters);
      if (contact.uncertain) return { fraction, blocker: contact.blocker, unresolved: true };
      if (contact.margin >= bound + CONTACT_NUMERICAL_EPSILON) {
        fraction = b;
        continue;
      }
      blocker = contact.blocker;
      if (bound <= CONTACT_NUMERICAL_EPSILON) {
        return { fraction, blocker, unresolved: contact.margin >= -CONTACT_NUMERICAL_EPSILON };
      }
      pending.push([mid, b], [a, mid]);
    }
    return { fraction, blocker: fraction === 1 ? null : sweepBlocker ?? blocker, unresolved: pending.length > 0 };
  }

  /** Verifica una trasformazione candidata contro le altre hold, escludendo la parete. */
  canPlaceWithoutHoldOverlap(
    object: KinematicPhysicsObject,
    translation: RAPIER.Vector,
    rotation: RAPIER.Rotation,
  ): boolean {
    this.ensureActive();
    let valid = true;
    this.world.forEachCollider((candidate) => {
      if (!valid || candidate.handle === object.collider.handle || candidate.handle === this.wallCollider.handle) return;
      if (object.collider.shape.intersectsShape(
        translation,
        rotation,
        candidate.shape,
        candidate.translation(),
        candidate.rotation(),
      )) valid = false;
    });
    return valid;
  }

  /** Programma la rotazione cinematica che verrà applicata al prossimo step. */
  rotateKinematicObject(object: KinematicPhysicsObject, rotation: RAPIER.Rotation): void {
    this.ensureActive();
    object.body.setNextKinematicRotation(rotation);
  }

  /** Trasla direttamente un corpo cinematico non ancora agganciato alla parete. */
  translateKinematicObject(object: KinematicPhysicsObject, delta: RAPIER.Vector): void {
    this.ensureActive();
    const current = object.body.translation();
    object.body.setNextKinematicTranslation({
      x: current.x + delta.x,
      y: current.y + delta.y,
      z: current.z + delta.z,
    });
  }

  /** Applica subito una trasformazione pre-snap, senza avviare query collisioni sul TriMesh. */
  setKinematicTransform(
    object: KinematicPhysicsObject,
    translation: RAPIER.Vector,
    rotation: RAPIER.Rotation,
  ): void {
    this.ensureActive();
    object.body.setTranslation(translation, false);
    object.body.setRotation(rotation, false);
  }

  /** Sincronizza le mesh registrate senza avanzare il mondo fisico. */
  synchronizeRendering(): void {
    this.ensureActive();
    synchronizePhysicsToRendering(this.bindings);
  }

  /**
   * Trasla una hold pre-snap con shape cast, fermandola prima di parete o altre hold.
   * Il vettore `desiredDelta` rappresenta l'intero passo richiesto e `toi` ne restituisce la frazione valida.
   */
  movePreSnapWithCollisions(
    object: KinematicPhysicsObject,
    desiredDelta: RAPIER.Vector,
  ): RAPIER.Vector {
    this.ensureActive();
    const current = object.body.translation();
    const rotation = object.body.rotation();
    const requestedLength = Math.hypot(desiredDelta.x, desiredDelta.y, desiredDelta.z);
    if (requestedLength === 0) return { x: 0, y: 0, z: 0 };

    let firstToi: number | null = null;
    this.world.forEachCollider((candidate) => {
      if (candidate.handle === object.collider.handle || candidate.handle === this.wallCollider.handle) return;
      const hit = object.collider.shape.castShape(
        current,
        rotation,
        desiredDelta,
        candidate.shape,
        candidate.translation(),
        candidate.rotation(),
        { x: 0, y: 0, z: 0 },
        1,
        true,
      );
      if (hit && (firstToi === null || hit.toi < firstToi)) firstToi = hit.toi;
    });
    const marginFraction = COLLISION_MARGIN_METERS / requestedLength;
    const allowedFraction = firstToi === null ? 1 : Math.max(0, Math.min(1, firstToi - marginFraction));
    const movement = {
      x: desiredDelta.x * allowedFraction,
      y: desiredDelta.y * allowedFraction,
      z: desiredDelta.z * allowedFraction,
    };
    this.setKinematicTransform(object, {
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    }, rotation);
    return movement;
  }

  /** Verifica se il collider indicato interseca un altro collider del mondo. */
  hasIntersections(object: KinematicPhysicsObject): boolean {
    this.ensureActive();
    this.world.updateSceneQueries();
    return this.world.intersectionWithShape(
      object.body.translation(),
      object.body.rotation(),
      object.collider.shape,
      undefined,
      undefined,
      object.collider,
      object.body,
    ) !== null;
  }

  /** Rimuove corpo e collider associati a un'istanza che lascia la scena. */
  removeKinematicObject(object: KinematicPhysicsObject): void {
    this.ensureActive();
    this.normalizedShapes.delete(object.collider.handle);
    this.colliderRadii.delete(object.collider.handle);
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
    this.normalizedShapes.clear();
    this.colliderRadii.clear();
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
