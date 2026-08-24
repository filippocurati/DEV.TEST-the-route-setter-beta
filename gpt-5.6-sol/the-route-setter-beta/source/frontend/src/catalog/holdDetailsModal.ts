import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  MathUtils,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HoldManifest } from '../api/holdApi';
import { loadHoldModel, normalizeForPreview } from '../holds/holdResources';

/** Gestisce il modale dettagli con renderer e risorse creati e distrutti a ogni apertura. */
export class HoldDetailsModal {
  private readonly dialog: HTMLDialogElement;
  private readonly title: HTMLElement;
  private readonly viewport: HTMLElement;
  private cleanup: (() => void) | undefined;

  /** Collega il controller agli elementi del dialog già presenti nella pagina. */
  constructor(dialog: HTMLDialogElement) {
    this.dialog = dialog;
    this.title = dialog.querySelector<HTMLElement>('[data-details-title]')!;
    this.viewport = dialog.querySelector<HTMLElement>('[data-details-viewport]')!;
    dialog.querySelector<HTMLButtonElement>('[data-close-details]')!
      .addEventListener('click', () => this.close());
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
    });
  }

  /** Carica il GLB soltanto all'apertura e crea una viewport Three.js isolata. */
  async open(hold: HoldManifest): Promise<void> {
    this.close();
    this.title.textContent = `Dettagli ${hold.id}`;
    this.viewport.textContent = 'Caricamento modello...';
    this.dialog.showModal();

    const resource = await loadHoldModel(hold);
    if (!this.dialog.open) {
      resource.dispose();
      return;
    }

    this.viewport.textContent = '';
    const scene = new Scene();
    scene.background = new Color(0x121816);
    const object = resource.createInstance();
    const { size } = normalizeForPreview(object);
    scene.add(object);
    scene.add(new AmbientLight(0xffffff, 1.6));
    const light = new DirectionalLight(0xffffff, 3);
    light.position.set(2, 3, 4);
    scene.add(light);

    const camera = new PerspectiveCamera(40, 1, 0.001, 100_000);
    const maxDimension = Math.max(size.x, size.y, size.z, 0.1);
    camera.position.set(0, maxDimension * 0.1, (maxDimension / 2) / Math.tan(MathUtils.degToRad(20)) * 1.5);
    camera.lookAt(new Vector3());
    camera.near = Math.max(maxDimension / 10_000, 0.001);
    camera.far = maxDimension * 100;
    camera.updateProjectionMatrix();

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.detailsCanvas = 'true';
    this.viewport.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);

    const render = (): void => renderer.render(scene, camera);
    controls.addEventListener('change', render);
    const resize = (): void => {
      const width = Math.max(this.viewport.clientWidth, 1);
      const height = Math.max(this.viewport.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(this.viewport);
    resize();

    this.cleanup = () => {
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      disposeInstanceOnly(object);
      resource.dispose();
    };
  }

  /** Chiude il dialog e libera renderer, controlli e modello. */
  close(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    if (this.dialog.open) {
      this.dialog.close();
    }
    this.viewport.textContent = '';
  }
}

/** Scollega l'istanza; la risorsa modello dispone geometrie e materiali condivisi. */
function disposeInstanceOnly(object: Group): void {
  object.removeFromParent();
}
