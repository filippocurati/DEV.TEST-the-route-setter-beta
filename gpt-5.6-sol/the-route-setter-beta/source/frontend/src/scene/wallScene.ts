import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  MathUtils,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadWall } from './wallLoader';

/** Riferimenti della scena esposti esclusivamente per diagnostica e test E2E. */
export interface WallSceneDebug {
  readonly wallLoaded: boolean;
  readonly triMeshVertexCount: number;
  readonly triMeshIndexCount: number;
  readonly cameraPosition: readonly number[];
  readonly controlsTarget: readonly number[];
  readonly wallCenter: readonly number[];
  readonly wallMaxDimension: number;
}

declare global {
  interface Window {
    __ROUTE_SETTER_SCENE__?: WallSceneDebug;
  }
}

/** Crea la scena, carica automaticamente la parete e avvia il rendering interattivo. */
export async function createWallScene(container: HTMLElement, status: HTMLElement): Promise<void> {
  const scene = new Scene();
  scene.background = new Color(0x101713);

  const camera = new PerspectiveCamera(42, 1, 0.01, 100_000);
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.tabIndex = 0;
  renderer.domElement.dataset.sceneCanvas = 'true';
  container.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.screenSpacePanning = true;

  scene.add(new AmbientLight(0xffffff, 1.4));
  const keyLight = new DirectionalLight(0xfff3df, 3.2);
  keyLight.position.set(1, 2, 4);
  scene.add(keyLight);
  const fillLight = new DirectionalLight(0xb9d8ff, 1.6);
  fillLight.position.set(-3, 1, -2);
  scene.add(fillLight);

  const wall = await loadWall();
  scene.add(wall.object);
  frameWall(camera, controls, wall.bounds, wall.center, wall.size);
  status.textContent = 'Parete pronta';
  status.dataset.state = 'ready';

  const updateDebugState = (): void => {
    window.__ROUTE_SETTER_SCENE__ = {
      wallLoaded: true,
      triMeshVertexCount: wall.triMesh.vertices.length / 3,
      triMeshIndexCount: wall.triMesh.indices.length,
      cameraPosition: camera.position.toArray(),
      controlsTarget: controls.target.toArray(),
      wallCenter: wall.center.toArray(),
      wallMaxDimension: Math.max(wall.size.x, wall.size.y, wall.size.z),
    };
  };
  const render = (): void => {
    updateDebugState();
    renderer.render(scene, camera);
  };
  controls.addEventListener('change', render);
  updateDebugState();

  const resize = (): void => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
}

/** Posiziona camera e target in funzione del bounding box reale della parete. */
function frameWall(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bounds: Box3,
  center: Vector3,
  size: Vector3,
): void {
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const halfFieldOfView = MathUtils.degToRad(camera.fov / 2);
  const distance = (maxDimension / 2) / Math.tan(halfFieldOfView) * 1.35;
  camera.position.copy(center).add(new Vector3(0, maxDimension * 0.08, distance));
  camera.near = Math.max(distance / 10_000, 0.001);
  camera.far = Math.max(distance * 100, bounds.max.length() * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(center);

  controls.target.copy(center);
  controls.minDistance = Math.max(maxDimension * 0.05, 0.01);
  controls.maxDistance = maxDimension * 20;
  controls.update();
}
