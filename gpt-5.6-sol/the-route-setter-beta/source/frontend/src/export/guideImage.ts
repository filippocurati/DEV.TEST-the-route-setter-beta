import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

export const GUIDE_LONG_SIDE_PIXELS = 2560;
export const GUIDE_JPEG_QUALITY = 0.90;

/** Dimensioni proporzionali dell'immagine con lato lungo vincolato a 2560 px. */
export interface ExportDimensions {
  readonly width: number;
  readonly height: number;
}

/** Parametri della camera usati per verificare equivalenza tra viewport ed export. */
export interface CameraSnapshot {
  readonly position: readonly number[];
  readonly quaternion: readonly number[];
  readonly fov: number;
  readonly zoom: number;
  readonly near: number;
  readonly far: number;
  readonly aspect: number;
}

/** Risultato binario e metadati della generazione guida. */
export interface GuideImageResult extends ExportDimensions {
  readonly blob: Blob;
  readonly camera: CameraSnapshot;
}

/** Calcola dimensioni intere mantenendo il rapporto d'aspetto della viewport corrente. */
export function calculateExportDimensions(width: number, height: number): ExportDimensions {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('Dimensioni viewport non valide per l’esportazione.');
  }
  if (width >= height) {
    return { width: GUIDE_LONG_SIDE_PIXELS, height: Math.max(1, Math.round(GUIDE_LONG_SIDE_PIXELS * height / width)) };
  }
  return { width: Math.max(1, Math.round(GUIDE_LONG_SIDE_PIXELS * width / height)), height: GUIDE_LONG_SIDE_PIXELS };
}

/** Restituisce un'istantanea serializzabile della camera prospettica. */
export function snapshotCamera(camera: PerspectiveCamera): CameraSnapshot {
  return {
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    fov: camera.fov,
    zoom: camera.zoom,
    near: camera.near,
    far: camera.far,
    aspect: camera.aspect,
  };
}

/**
 * Renderizza esattamente la vista corrente su un canvas temporaneo ad alta risoluzione.
 * Il renderer interattivo, la camera originale, la scena e lo sfondo non vengono modificati.
 */
export async function generateGuideImage(
  scene: Scene,
  interactiveCamera: PerspectiveCamera,
  interactiveRenderer: WebGLRenderer,
  viewportWidth: number,
  viewportHeight: number,
): Promise<GuideImageResult> {
  const dimensions = calculateExportDimensions(viewportWidth, viewportHeight);
  const exportCamera = interactiveCamera.clone();
  exportCamera.aspect = dimensions.width / dimensions.height;
  exportCamera.updateProjectionMatrix();
  exportCamera.updateMatrixWorld(true);
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });

  try {
    renderer.outputColorSpace = interactiveRenderer.outputColorSpace;
    renderer.toneMapping = interactiveRenderer.toneMapping;
    renderer.toneMappingExposure = interactiveRenderer.toneMappingExposure;
    renderer.shadowMap.enabled = interactiveRenderer.shadowMap.enabled;
    renderer.shadowMap.type = interactiveRenderer.shadowMap.type;
    renderer.setPixelRatio(1);
    renderer.setSize(dimensions.width, dimensions.height, false);
    renderer.render(scene, exportCamera);
    const blob = await canvasToJpeg(renderer.domElement);
    return { ...dimensions, blob, camera: snapshotCamera(exportCamera) };
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
}

/** Scarica il blob con un object URL temporaneo e lo revoca al tick successivo. */
export function downloadGuideImage(blob: Blob, fileName = 'the-route-setter-guide.jpg'): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Converte il canvas in JPEG alla qualità vincolata, fallendo se il browser non produce il blob. */
function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Il browser non ha generato l’immagine JPG.'));
    }, 'image/jpeg', GUIDE_JPEG_QUALITY);
  });
}
