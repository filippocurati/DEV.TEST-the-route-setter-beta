import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PhysicsContext } from '../physics/wallCollider';
import { createPhysicsContext } from '../physics/wallCollider';

export interface WallScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  wallRoot: THREE.Object3D;
  physics: PhysicsContext;
  dispose: () => void;
}

export async function createWallScene(
  mountElement: HTMLElement,
  wallModelUrl: string
): Promise<WallScene> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8edf2');

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  camera.position.set(0, 1.2, 2.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mountElement.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.2, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
  keyLight.position.set(2.5, 4, 2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-2.5, 2.2, -1.5);
  scene.add(fillLight);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(wallModelUrl);
  const wallRoot = gltf.scene;
  scene.add(wallRoot);

  fitCameraToObject(camera, controls, wallRoot);

  const physics = await createPhysicsContext(wallRoot);

  const resizeObserver = new ResizeObserver(() => {
    resizeRenderer(renderer, camera, mountElement);
  });
  resizeObserver.observe(mountElement);
  resizeRenderer(renderer, camera, mountElement);

  let animationFrameHandle = 0;
  const renderLoop = () => {
    controls.update();
    renderer.render(scene, camera);
    animationFrameHandle = window.requestAnimationFrame(renderLoop);
  };
  renderLoop();

  return {
    renderer,
    scene,
    camera,
    controls,
    wallRoot,
    physics,
    dispose: () => {
      window.cancelAnimationFrame(animationFrameHandle);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      physics.world.free();
    }
  };
}

function resizeRenderer(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, container: HTMLElement): void {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D
): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDimension = Math.max(size.x, size.y, size.z);
  const distance = Math.max(1.5, (maxDimension * 1.35) / Math.tan((Math.PI * camera.fov) / 360));

  camera.position.set(center.x, center.y + size.y * 0.15, center.z + distance);
  camera.near = 0.01;
  camera.far = Math.max(500, distance * 8);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}
