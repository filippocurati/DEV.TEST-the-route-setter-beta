import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, EventDispatcher, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3, type WebGLRenderer } from 'three';
import { createWallScene, type WallSceneController } from '../../src/scene/wallScene';
import { HoldDetailsModal } from '../../src/catalog/holdDetailsModal';
import { generateGuideImage, snapshotCamera } from '../../src/export/guideImage';
import { loadHoldModel, type HoldModelResource } from '../../src/holds/holdResources';
import { loadWall } from '../../src/scene/wallLoader';
import { PhysicsWorld } from '../../src/physics/physicsWorld';
import { DEFAULT_PHYSICS_CONFIG } from '../../src/config/physicsConfig';
import type { HoldManifest } from '../../src/api/holdApi';

const mocks = vi.hoisted(() => ({ renderers: [] as any[], controls: [] as any[], renderError: false }));

/** DOM minimo per verificare i lifecycle senza introdurre dipendenze browser. */
class ElementStub extends EventTarget {
  clientWidth = 800;
  clientHeight = 600;
  dataset: Record<string, string> = {};
  children: ElementStub[] = [];
  parent: ElementStub | null = null;
  textContent = '';
  open = false;
  captured = new Set<number>();
  elements = new Map<string, ElementStub>();
  /** Registra il figlio nella viewport simulata. */
  append(child: ElementStub): void { this.children.push(child); child.parent = this; }
  /** Scollega il canvas simulato. */
  remove(): void { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  /** Restituisce le dimensioni CSS correnti. */
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  /** Recupera il markup del modale simulato. */
  querySelector(selector: string) { return this.elements.get(selector); }
  /** Apre il dialog simulato. */
  showModal(): void { this.open = true; }
  /** Chiude il dialog simulato. */
  close(): void { this.open = false; }
  /** Cattura il puntatore della gesture. */
  setPointerCapture(id: number): void { this.captured.add(id); }
  /** Verifica la cattura corrente. */
  hasPointerCapture(id: number): boolean { return this.captured.has(id); }
  /** Simula il rilascio sincrono per scoprire rientranze nel cleanup. */
  releasePointerCapture(id: number): void {
    this.captured.delete(id);
    this.dispatchEvent(Object.assign(new Event('lostpointercapture'), { pointerId: id }));
  }
  /** Consegna un JPEG minimo al callback di esportazione. */
  toBlob(callback: BlobCallback): void { callback(new Blob(['jpeg'], { type: 'image/jpeg' })); }
}

vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = new ElementStub();
      shadowMap = { enabled: false, type: 1 };
      info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
      getContext = vi.fn(() => ({ getExtension: () => null, getParameter: () => 'test' }));
      render = vi.fn(() => { if (mocks.renderError) throw new Error('render'); });
      dispose = vi.fn();
      forceContextLoss = vi.fn();
      setPixelRatio = vi.fn();
      setSize = vi.fn();
      /** Traccia ogni renderer creato dal codice applicativo. */
      constructor() { mocks.renderers.push(this); }
    },
  };
});
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class extends EventDispatcher<any> {
    target = new Vector3();
    enabled = true;
    dispose = vi.fn();
    /** Conserva la camera per simulare zoom e orbita. */
    constructor(readonly camera: PerspectiveCamera) { super(); mocks.controls.push(this); }
    /** Aggiorna le matrici come i controlli reali. */
    update(): void { this.camera.updateMatrixWorld(true); }
  },
}));
vi.mock('../../src/scene/wallLoader', () => ({ loadWall: vi.fn() }));
vi.mock('../../src/holds/holdResources', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/holds/holdResources')>(), loadHoldModel: vi.fn(),
}));
vi.mock('../../src/api/holdApi', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/api/holdApi')>(),
  fetchHoldCollider: vi.fn(async () => ({
    sourceHash: 'sha256:test',
    vertices: [-.1,-.1,0, .1,-.1,0, .1,.1,0, -.1,.1,0, -.1,-.1,.1, .1,-.1,.1, .1,.1,.1, -.1,.1,.1],
    indices: [0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 1,2,6, 1,6,5, 2,3,7, 2,7,6, 3,0,4, 3,4,7],
  })),
}));

const hold: HoldManifest = { id: 'Hold1', modelUrl: '/hold', colliderUrl: '/collider', colliderStatus: 'Ready', previewUrl: null, optionalAssetUrls: [] };
let frames: Map<number, FrameRequestCallback>;
let observers: Array<{ callback: () => void; disconnect: ReturnType<typeof vi.fn> }>;
let controllers: WallSceneController[];
let models: HoldModelResource[];

/** Crea un modello piccolo con la base nel piano locale Z=0. */
function model(): HoldModelResource {
  const template = new Group();
  const geometry = new BoxGeometry(.2, .2, .1).translate(0, 0, .05);
  template.add(new Mesh(geometry, new MeshStandardMaterial()));
  const resource = { definition: hold, template, createInstance: vi.fn(() => template.clone(true)), dispose: vi.fn() };
  models.push(resource);
  return resource;
}

/** Crea una promessa controllabile per le race di caricamento. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Consuma solo i RAF gia accodati, come un singolo frame del browser. */
function frame(): void {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback(0));
}

/** Costruisce il markup minimo del dialog dettagli. */
function details() {
  const dialog = new ElementStub();
  for (const selector of ['[data-details-title]', '[data-details-viewport]', '[data-close-details]']) dialog.elements.set(selector, new ElementStub());
  return { dialog, modal: new HoldDetailsModal(dialog as unknown as HTMLDialogElement), viewport: dialog.querySelector('[data-details-viewport]')! };
}

/** Crea una scena con fisica reale e rendering simulato. */
async function wallScene(onError?: (error: unknown) => void) {
  const container = new ElementStub();
  const controller = await createWallScene(container as unknown as HTMLElement, new ElementStub() as unknown as HTMLElement, DEFAULT_PHYSICS_CONFIG, onError);
  controllers.push(controller);
  return { controller, container, renderer: mocks.renderers[0], controls: mocks.controls[0] };
}

/** Aggancia la presa al centro della parete piana del test. */
async function attachedScene() {
  const setup = await wallScene();
  await setup.controller.addHold(hold);
  setup.controller.beginAttachTargeting();
  expect(setup.controller.commitAttachTarget({ x: 400, y: 300 }).status).toBe('applied');
  setup.controller.beginMoving();
  frame();
  return setup;
}

/** Invia un evento puntatore con coordinate CSS locali. */
function pointer(canvas: ElementStub, type: string, x: number, y: number): void {
  canvas.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y }));
}

beforeAll(async () => { const { default: rapier } = await import('@dimforge/rapier3d-compat'); await rapier.init(); });
beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(loadWall).mockReset();
  vi.mocked(loadHoldModel).mockReset();
  models = [];
  controllers = [];
  frames = new Map();
  observers = [];
  mocks.renderers.length = 0;
  mocks.controls.length = 0;
  mocks.renderError = false;
  let nextFrame = 0;
  vi.stubGlobal('window', { devicePixelRatio: 1, location: { search: '' } });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn();
    observe = vi.fn();
    /** Conserva il callback per pilotare resize deterministici. */
    constructor(readonly callback: () => void) { observers.push(this); }
  });
  vi.mocked(loadWall).mockImplementation(async () => {
    const object = new Group();
    object.add(new Mesh(new PlaneGeometry(20, 20), new MeshStandardMaterial()));
    object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(object);
    return { object, bounds, center: new Vector3(), size: new Vector3(20, 20, 0), triMesh: {
      vertices: new Float32Array([-10,-10,0, 10,-10,0, 10,10,0, -10,10,0]), indices: new Uint32Array([0,1,2, 0,2,3]),
    } };
  });
  vi.mocked(loadHoldModel).mockImplementation(async () => model());
});
afterEach(() => {
  controllers.forEach(controller => controller.dispose());
  vi.unstubAllGlobals();
});

describe('CON04 dettagli e risorse', () => {
  it('scarta un successo obsoleto dopo close/reopen senza creare un secondo renderer', async () => {
    const first = deferred<HoldModelResource>();
    vi.mocked(loadHoldModel).mockReturnValueOnce(first.promise);
    const { modal, viewport } = details();
    const opening = modal.open(hold);
    modal.close();
    await modal.open({ ...hold, id: 'Hold2' });
    const stale = model();
    first.resolve(stale);
    await opening;
    expect(stale.dispose).toHaveBeenCalledOnce();
    expect(stale.createInstance).not.toHaveBeenCalled();
    expect(mocks.renderers).toHaveLength(1);
    expect(viewport.children).toHaveLength(1);
    modal.close();
    modal.close();
    expect(mocks.renderers[0].dispose).toHaveBeenCalledOnce();
    expect(mocks.renderers[0].forceContextLoss).toHaveBeenCalledOnce();
  });

  it('assorbe un errore obsoleto ma propaga e chiude quello corrente', async () => {
    const first = deferred<HoldModelResource>();
    vi.mocked(loadHoldModel).mockReturnValueOnce(first.promise);
    const { modal, dialog } = details();
    const opening = modal.open(hold);
    await modal.open(hold);
    first.reject(new Error('stale'));
    await expect(opening).resolves.toBeUndefined();
    expect(dialog.open).toBe(true);
    vi.mocked(loadHoldModel).mockRejectedValueOnce(new Error('current'));
    await expect(modal.open(hold)).rejects.toThrow('current');
    expect(dialog.open).toBe(false);
  });

  it('libera risorse parziali se il primo rendering dettagli fallisce', async () => {
    const { modal, viewport } = details();
    const opening = modal.open(hold);
    // Il modello viene risolto prima che il renderer venga costruito.
    const observe = vi.fn(() => { mocks.renderers[0].render.mockImplementation(() => { throw new Error('render'); }); });
    vi.stubGlobal('ResizeObserver', class { disconnect = vi.fn(); observe = observe; });
    await expect(opening).rejects.toThrow('render');
    expect(viewport.children).toHaveLength(0);
    expect(models[0].dispose).toHaveBeenCalledOnce();
    expect(mocks.controls[0].dispose).toHaveBeenCalledOnce();
    expect(mocks.renderers[0].forceContextLoss).toHaveBeenCalledOnce();
  });

  it('ignora un close DOM accodato prima della riapertura', async () => {
    const { modal, dialog } = details();
    await modal.open(hold);
    await modal.open(hold);
    dialog.dispatchEvent(new Event('close'));
    expect(dialog.open).toBe(true);
    expect(mocks.renderers[1].dispose).not.toHaveBeenCalled();
    modal.close();
  });
});

describe('CON04 scena transazionale e interazioni', () => {
  it.each(['wall', 'physics'])('ripulisce il bootstrap fallito in %s', async stage => {
    if (stage === 'wall') vi.mocked(loadWall).mockRejectedValueOnce(new Error(stage));
    else vi.spyOn(PhysicsWorld, 'create').mockRejectedValueOnce(new Error(stage));
    await expect(wallScene()).rejects.toThrow(stage);
    expect(mocks.renderers[0].dispose).toHaveBeenCalledOnce();
    expect(mocks.renderers[0].forceContextLoss).toHaveBeenCalledOnce();
    expect(mocks.controls[0].dispose).toHaveBeenCalledOnce();
    expect(mocks.renderers[0].domElement.parent.children).toHaveLength(0);
    expect(frames.size).toBe(0);
  });

  it('annulla corpo, binding, selezione e modello dopo un errore tardivo di addHold', async () => {
    const { controller } = await wallScene();
    const unbind = vi.fn();
    vi.spyOn(PhysicsWorld.prototype, 'bindRenderingObject').mockReturnValueOnce(unbind);
    vi.spyOn(PhysicsWorld.prototype, 'step').mockImplementationOnce(() => { throw new Error('step'); });
    await expect(controller.addHold(hold)).rejects.toThrow('step');
    frame();
    expect(controller.hasHold(hold.id)).toBe(false);
    expect(controller.selectedHoldId()).toBeNull();
    expect(window.__ROUTE_SETTER_SCENE__!.rigidBodyCount).toBe(1);
    expect(window.__ROUTE_SETTER_SCENE__!.colliderCount).toBe(1);
    expect(unbind).toHaveBeenCalledOnce();
    expect(models[0].dispose).toHaveBeenCalledOnce();
    await controller.addHold(hold);
    expect(controller.hasHold(hold.id)).toBe(true);
  });

  it('rilascia un modello arrivato dopo dispose e impedisce add concorrenti duplicati', async () => {
    const pending = deferred<HoldModelResource>();
    vi.mocked(loadHoldModel).mockReturnValueOnce(pending.promise);
    const { controller } = await wallScene();
    const adding = controller.addHold(hold);
    await expect(controller.addHold(hold)).rejects.toThrow('gia presente');
    controller.dispose();
    const resource = model();
    pending.resolve(resource);
    await expect(adding).rejects.toThrow('non e disponibile');
    expect(resource.dispose).toHaveBeenCalledOnce();
    expect(resource.createInstance).not.toHaveBeenCalled();
  });

  it.each(['commit', 'cancel'])('applica il resize differito dopo %s', async end => {
    const { controller, container, renderer } = await attachedScene();
    controller.beginMoveDrag('right', { x: 400, y: 300 }, 1);
    const aspect = window.__ROUTE_SETTER_SCENE__!.cameraAspect;
    container.clientWidth = 1000;
    observers[0].callback();
    container.clientWidth = 1200;
    observers[0].callback();
    expect(window.__ROUTE_SETTER_SCENE__!.cameraAspect).toBe(aspect);
    if (end === 'commit') controller.commitMoveDrag(1);
    else controller.cancelTransformDrag();
    expect(renderer.setSize).toHaveBeenLastCalledWith(1200, 600, false);
    expect(window.__ROUTE_SETTER_SCENE__!.cameraAspect).toBe(2);
    expect(window.__ROUTE_SETTER_SCENE__!.orbitControlsEnabled).toBe(true);
  });

  it('ritargetizza il puntatore fermo su zoom e resize senza loop RAF', async () => {
    const { controller, controls, container } = await wallScene();
    await controller.addHold(hold);
    controller.beginAttachTargeting();
    const raycast = vi.spyOn(PhysicsWorld.prototype, 'castRayToWall');
    controller.updateAttachTarget({ x: 400, y: 300 });
    raycast.mockClear();
    controls.camera.position.multiplyScalar(.8);
    controls.dispatchEvent({ type: 'change' });
    expect(raycast).toHaveBeenCalledOnce();
    expect(controller.interactionSnapshot().target?.center).toEqual({ x: 400, y: 300 });
    frame();
    expect(frames.size).toBe(0);
    expect(raycast).toHaveBeenCalledOnce();
    container.clientWidth = 900;
    observers[0].callback();
    expect(raycast).toHaveBeenCalledTimes(2);
  });

  it('coalesca il drag libero e usa l ultimo pointerup cancellando il RAF pendente', async () => {
    const { controller, renderer } = await attachedScene();
    const [x, y] = window.__ROUTE_SETTER_SCENE__!.holdScreenPositions.Hold1;
    const start = { x: (x + 1) * 400, y: (1 - y) * 300 };
    const raycast = vi.spyOn(PhysicsWorld.prototype, 'castRayToWall');
    pointer(renderer.domElement, 'pointerdown', start.x, start.y);
    for (let dx = 5; dx <= 20; dx += 5) pointer(renderer.domElement, 'pointermove', start.x + dx, start.y);
    expect(raycast).not.toHaveBeenCalled();
    frame();
    expect(raycast).toHaveBeenCalledOnce();
    expect(controller.interactionSnapshot().dragPreview?.requested.x).toBe(start.x + 20);
    pointer(renderer.domElement, 'pointermove', start.x + 30, start.y);
    const requests: number[] = [];
    const unsubscribe = controller.onInteractionChange(snapshot => {
      if (snapshot.dragPreview) requests.push(snapshot.dragPreview.requested.x);
    });
    pointer(renderer.domElement, 'pointerup', start.x + 40, start.y);
    unsubscribe();
    expect(requests[requests.length - 1]).toBe(start.x + 40);
    const count = raycast.mock.calls.length;
    frame();
    expect(raycast).toHaveBeenCalledTimes(count);
    expect(controller.interactionSnapshot().dragPreview).toBeNull();
    expect(window.__ROUTE_SETTER_SCENE__!.orbitControlsEnabled).toBe(true);
  });

  it.each(['pointercancel', 'lostpointercapture', 'cancelInteraction', 'clearSelection', 'removeHold'])(
    'elimina il RAF libero pendente su %s senza applicare la posa', async action => {
      const { controller, renderer } = await attachedScene();
      const before = window.__ROUTE_SETTER_SCENE__!.selectedHoldPosition;
      const [x, y] = window.__ROUTE_SETTER_SCENE__!.holdScreenPositions.Hold1;
      const start = { x: (x + 1) * 400, y: (1 - y) * 300 };
      const raycast = vi.spyOn(PhysicsWorld.prototype, 'castRayToWall');
      pointer(renderer.domElement, 'pointerdown', start.x, start.y);
      pointer(renderer.domElement, 'pointermove', start.x + 20, start.y);
      if (action === 'cancelInteraction') controller.cancelInteraction();
      else if (action === 'clearSelection') controller.clearSelection();
      else if (action === 'removeHold') controller.removeHold('Hold1');
      else pointer(renderer.domElement, action, start.x + 20, start.y);
      frame();
      expect(raycast).not.toHaveBeenCalled();
      expect(controller.interactionSnapshot().dragPreview).toBeNull();
      expect(window.__ROUTE_SETTER_SCENE__!.previewObjectCount).toBe(0);
      expect(window.__ROUTE_SETTER_SCENE__!.orbitControlsEnabled).toBe(true);
      if (controller.selectedHoldId()) expect(window.__ROUTE_SETTER_SCENE__!.selectedHoldPosition).toEqual(before);
    },
  );

  it('sopprime il click di selezione che segue un aggancio riuscito', async () => {
    const { controller, renderer } = await wallScene();
    await controller.addHold(hold);
    controller.beginAttachTargeting();
    pointer(renderer.domElement, 'pointerdown', 400, 300);
    pointer(renderer.domElement, 'pointerup', 400, 300);
    // Un click fuori dalla presa non deve deselezionare il commit appena eseguito.
    pointer(renderer.domElement, 'click', 0, 0);
    expect(controller.selectedHoldId()).toBe('Hold1');
    pointer(renderer.domElement, 'click', 0, 0);
    expect(controller.selectedHoldId()).toBeNull();
  });

  it.each(['target', 'move', 'rotate'])('dispose elimina preview, listener e callback in %s', async mode => {
    const { controller, renderer } = await attachedScene();
    if (mode === 'target') { controller.detachSelected(); controller.beginAttachTargeting(); controller.updateAttachTarget({ x: 400, y: 300 }); }
    else if (mode === 'move') controller.beginMoveDrag('free', { x: 400, y: 300 }, 1);
    else { controller.beginRotating(); controller.beginRotationDrag({ x: 450, y: 300 }, 1); }
    const disposePhysics = vi.spyOn(PhysicsWorld.prototype, 'dispose');
    controller.dispose();
    controller.dispose();
    pointer(renderer.domElement, 'click', 400, 300);
    frame();
    expect(window.__ROUTE_SETTER_SCENE__).toBeUndefined();
    expect(frames.size).toBe(0);
    expect(models[0].dispose).toHaveBeenCalledOnce();
    expect(disposePhysics).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });

  it('segnala una sola volta un errore render e contiene anche un reporter fallito', async () => {
    const reporter = vi.fn(() => { throw new Error('reporter'); });
    const { controller, renderer, controls } = await wallScene(reporter);
    await controller.addHold(hold);
    controller.beginAttachTargeting();
    controller.updateAttachTarget({ x: 400, y: 300 });
    const error = new Error('render');
    renderer.render.mockImplementation(() => { throw error; });
    expect(frame).not.toThrow();
    controls.dispatchEvent({ type: 'change' });
    expect(reporter).toHaveBeenCalledOnce();
    expect(reporter).toHaveBeenCalledWith(error);
    expect(controller.interactionSnapshot().mode).toBe('idle');
    expect(window.__ROUTE_SETTER_SCENE__!.previewObjectCount).toBe(0);
    expect(controls.enabled).toBe(false);
  });

  it.each(['failed', 'disposed'])('blocca tutti i comandi pubblici dopo %s senza mutazioni invisibili', async state => {
    const { controller, renderer, controls, container } = await attachedScene();
    const before = window.__ROUTE_SETTER_SCENE__!;
    controller.beginMoveDrag('free', { x: 400, y: 300 }, 1);
    const listener = vi.fn();
    controller.onInteractionChange(listener);
    listener.mockClear();
    if (state === 'failed') {
      renderer.render.mockImplementation(() => { throw new Error('render'); });
      frame();
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        failed: true, selected: null, mode: 'idle', target: null, dragPreview: null,
      }));
      expect(window.__ROUTE_SETTER_SCENE__).toMatchObject({
        failed: true, selectedHoldPosition: before.selectedHoldPosition,
        selectedHoldRotation: before.selectedHoldRotation,
        rigidBodyCount: before.rigidBodyCount, colliderCount: before.colliderCount,
      });
      expect(controller.hasHold('Hold1')).toBe(true);
      expect(controller.selectedHoldId()).toBe('Hold1');
    } else controller.dispose();

    const snapshot = controller.interactionSnapshot();
    expect(snapshot.failed).toBe(true);
    const transform = vi.spyOn(PhysicsWorld.prototype, 'setKinematicTransform');
    const remove = vi.spyOn(PhysicsWorld.prototype, 'removeKinematicObject');
    const validate = vi.spyOn(PhysicsWorld.prototype, 'validatePose');
    const selection = controller.selectedHoldId();
    const orbitEnabled = controls.enabled;
    const camera = controls.camera.position.clone();
    renderer.render.mockClear();
    renderer.setSize.mockClear();
    vi.mocked(loadHoldModel).mockClear();
    listener.mockClear();

    expect(controller.removeHold('Hold1')).toBe(false);
    controller.clearSelection();
    for (const outcome of [
      controller.beginAttachTargeting(), controller.commitAttachTarget({ x: 400, y: 300 }),
      controller.detachSelected(), controller.beginMoving(), controller.moveSelected('up'),
      controller.beginMoveDrag('free', { x: 400, y: 300 }, 1), controller.commitMoveDrag(1),
      controller.beginRotating(), controller.rotateSelected('clockwise'),
      controller.beginRotationDrag({ x: 450, y: 300 }, 1), controller.commitRotationDrag(1),
    ]) expect(outcome.status).toBe('not-available');
    expect(controller.updateAttachTarget({ x: 410, y: 310 })).toBeNull();
    controller.updateMoveDrag({ x: 410, y: 310 }, 1);
    controller.updateRotationDrag({ x: 450, y: 310 }, 1);
    controller.cancelTransformDrag();
    controller.cancelInteraction();
    controller.setOrbitEnabled(!orbitEnabled);
    await expect(controller.addHold({ ...hold, id: 'Hold2' })).rejects.toThrow('non e disponibile');
    await expect(controller.generateGuideImage()).rejects.toThrow('non e disponibile');
    container.clientWidth = 1200;
    observers[0].callback();
    pointer(renderer.domElement, 'click', 0, 0);
    controls.dispatchEvent({ type: 'change' });
    frame();

    expect(transform).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(loadHoldModel).not.toHaveBeenCalled();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.setSize).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(controller.selectedHoldId()).toBe(selection);
    expect(controller.interactionSnapshot()).toEqual(snapshot);
    expect(controls.enabled).toBe(orbitEnabled);
    expect(controls.camera.position).toEqual(camera);
    expect(listener).not.toHaveBeenCalled();
    const lateListener = vi.fn();
    controller.onInteractionChange(lateListener)();
    expect(lateListener).toHaveBeenCalledWith(snapshot);
    controller.dispose();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it('notifica tutti gli osservatori del fault anche se uno fallisce o tenta comandi rientranti', async () => {
    const reporter = vi.fn();
    const { controller, renderer } = await wallScene(reporter);
    await controller.addHold(hold);
    controller.onInteractionChange(snapshot => {
      if (snapshot.failed) {
        expect(controller.removeHold('Hold1')).toBe(false);
        throw new Error('listener');
      }
    });
    const listener = vi.fn();
    controller.onInteractionChange(listener);
    listener.mockClear();
    const error = new Error('render');
    renderer.render.mockImplementation(() => { throw error; });
    expect(frame).not.toThrow();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].failed).toBe(true);
    expect(controller.hasHold('Hold1')).toBe(true);
    expect(reporter).toHaveBeenCalledOnce();
    expect(reporter).toHaveBeenCalledWith(error);
  });

  it('rifiuta un caricamento iniziato prima del fault e rilascia solo la risorsa pendente', async () => {
    const { controller, renderer } = await attachedScene();
    const pending = deferred<HoldModelResource>();
    vi.mocked(loadHoldModel).mockReturnValueOnce(pending.promise);
    const adding = controller.addHold({ ...hold, id: 'Hold2' });
    controller.beginMoveDrag('free', { x: 400, y: 300 }, 1);
    renderer.render.mockImplementation(() => { throw new Error('render'); });
    frame();
    const resource = model();
    pending.resolve(resource);
    await expect(adding).rejects.toThrow('non e disponibile');
    expect(resource.dispose).toHaveBeenCalledOnce();
    expect(resource.createInstance).not.toHaveBeenCalled();
    expect(models[0].dispose).not.toHaveBeenCalled();
    expect(controller.hasHold('Hold1')).toBe(true);
    expect(controller.hasHold('Hold2')).toBe(false);
  });

  it('blocca anche selezione e animazione del controller benchmark dopo un fault', async () => {
    window.location.search = '?performance=1';
    const { controller, renderer, controls } = await attachedScene();
    const benchmark = window.__ROUTE_SETTER_PERFORMANCE__!;
    benchmark.start();
    renderer.render.mockImplementation(() => { throw new Error('render'); });
    frame();
    const camera = controls.camera.position.clone();
    const selection = controller.selectedHoldId();
    renderer.render.mockClear();
    benchmark.start();
    expect(benchmark.selectHold('Hold1')).toBe(false);
    expect(benchmark.stop().active).toBe(false);
    frame();
    expect(controls.camera.position).toEqual(camera);
    expect(controller.selectedHoldId()).toBe(selection);
    expect(renderer.render).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
});

describe('CON04 export', () => {
  it.each(['success', 'render', 'blob'])('mantiene la camera esatta e rilascia il renderer: %s', async outcome => {
    const camera = new PerspectiveCamera(53, 803 / 601, .1, 100);
    camera.position.set(1, 2, 3);
    camera.zoom = 1.4;
    camera.updateProjectionMatrix();
    const snapshot = snapshotCamera(camera);
    const projection = camera.projectionMatrix.clone();
    const interactive = { shadowMap: { enabled: false, type: 1 } } as WebGLRenderer;
    if (outcome === 'render') mocks.renderError = true;
    if (outcome === 'blob') vi.spyOn(ElementStub.prototype, 'toBlob').mockImplementation(callback => callback(null));
    const generating = generateGuideImage(new Scene(), camera, interactive, 803, 601);
    if (outcome === 'success') {
      const result = await generating;
      expect(result.camera).toEqual(snapshot);
      expect(result.width / result.height).not.toBe(snapshot.aspect);
    } else await expect(generating).rejects.toThrow();
    expect(camera.projectionMatrix).toEqual(projection);
    expect(snapshotCamera(camera)).toEqual(snapshot);
    const renderer = mocks.renderers[0];
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
  });

  it('esclude la shadow e ripristina solo la selezione corrente senza nuove risorse modello', async () => {
    const { controller } = await wallScene();
    await controller.addHold(hold);
    controller.beginAttachTargeting();
    controller.updateAttachTarget({ x: 400, y: 300 });
    let encode!: BlobCallback;
    vi.spyOn(ElementStub.prototype, 'toBlob').mockImplementation(callback => { encode = callback; });
    const exporting = controller.generateGuideImage();
    const exportRenderer = mocks.renderers[1];
    const renderedScene = exportRenderer.render.mock.calls[0][0] as Scene;
    expect(renderedScene.getObjectByName('HoldPreviewGroup')!.visible).toBe(false);
    controller.clearSelection();
    encode(new Blob(['jpeg']));
    await exporting;
    expect(controller.selectedHoldId()).toBeNull();
    const object = renderedScene.children.find(child => child.userData.holdModelId === hold.id)!;
    object.traverse(child => { if (child instanceof Mesh) expect(child.material).toBe((models[0].template.children[0] as Mesh).material); });
    expect(loadHoldModel).toHaveBeenCalledOnce();
    expect(models[0].dispose).not.toHaveBeenCalled();
    expect(exportRenderer.dispose).toHaveBeenCalledOnce();
    expect(exportRenderer.forceContextLoss).toHaveBeenCalledOnce();
  });

  it('ripristina highlight e preview anche quando la codifica JPEG fallisce', async () => {
    const { controller } = await wallScene();
    await controller.addHold(hold);
    controller.beginAttachTargeting();
    controller.updateAttachTarget({ x: 400, y: 300 });
    vi.spyOn(ElementStub.prototype, 'toBlob').mockImplementation(callback => callback(null));
    await expect(controller.generateGuideImage()).rejects.toThrow();
    const renderedScene = mocks.renderers[1].render.mock.calls[0][0] as Scene;
    expect(renderedScene.getObjectByName('HoldPreviewGroup')!.visible).toBe(true);
    expect(controller.interactionSnapshot().exporting).toBe(false);
    const object = renderedScene.children.find(child => child.userData.holdModelId === hold.id)!;
    object.traverse(child => {
      if (child instanceof Mesh) expect((child.material as MeshStandardMaterial).emissive.getHex()).toBe(0xe6a25c);
    });
    expect(loadHoldModel).toHaveBeenCalledOnce();
    expect(mocks.renderers[1].dispose).toHaveBeenCalledOnce();
  });
});
