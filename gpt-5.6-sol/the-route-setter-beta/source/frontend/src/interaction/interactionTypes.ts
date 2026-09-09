export type HoldPhysicalState = 'detached' | 'attached';
export type InteractionMode = 'idle' | 'attach-targeting' | 'moving' | 'rotating';
export type MoveDirection = 'up' | 'down' | 'left' | 'right';
export type RotationDirection = 'clockwise' | 'counterclockwise';
export type SceneActionStatus =
  | 'applied'
  | 'blocked'
  | 'invalid-target'
  | 'not-available'
  | 'previewing'
  | 'committed'
  | 'cancelled'
  | 'invalid-endpoint'
  | 'surface-limit';

/** Coordinate in pixel nello spazio della viewport usato dall'interazione. */
export interface ViewportPoint {
  readonly x: number;
  readonly y: number;
}

/** Ingombro proiettato della presa e indicazione della sua visibilita. */
export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly visible: boolean;
}

/** Esito comunicabile alla UI, separato dall'eventuale causa diagnostica. */
export interface SceneActionResult {
  readonly status: SceneActionStatus;
  readonly message: string;
  /** Causa diagnostica dell'esito, assente quando non applicabile. */
  readonly reason?: 'wall-collision' | 'hold-collision' | 'no-surface' | 'surface-gap'
    | 'normal-limit' | 'no-change' | 'path-unresolved';
}

/** Footprint del bersaglio con deformazione prospettica e feedback di validita. */
export interface TargetPreview {
  readonly center: ViewportPoint;
  readonly diameterPx: number;
  readonly visible: boolean;
  readonly feedback: 'normal' | 'invalid';
  readonly minorAxisRatio: number;
  readonly rotationRadians: number;
}

/** Confronta richiesta del puntatore e posa candidata dell'anteprima durante il drag. */
export interface DragPreview {
  readonly kind: 'move' | 'rotate';
  readonly start: ViewportPoint;
  readonly requested: ViewportPoint;
  readonly candidate: ViewportPoint;
  readonly angleDegrees: number | null;
}

/** Stato della presa selezionata necessario a posizionare i controlli senza accedere alla scena. */
export interface SelectedHoldSnapshot {
  readonly id: string;
  readonly physicalState: HoldPhysicalState;
  readonly screenBounds: ScreenRect;
  readonly contactScreenPoint: ViewportPoint | null;
}

/** Vista immutabile dell'interazione corrente consumata da UI e overlay. */
export interface InteractionSnapshot {
  /** Scena non piu interattiva dopo un fault o il rilascio delle risorse. */
  readonly failed?: boolean;
  readonly selected: SelectedHoldSnapshot | null;
  readonly mode: InteractionMode;
  readonly target: TargetPreview | null;
  readonly exporting: boolean;
  readonly lastActionResult: SceneActionResult | null;
  readonly dragPreview: DragPreview | null;
}

/** Restituisce la modalità richiesta se compatibile con lo stato fisico. */
export function nextInteractionMode(
  state: HoldPhysicalState | null,
  action: 'attach' | 'move' | 'rotate' | 'cancel',
): InteractionMode {
  if (action === 'cancel') return 'idle';
  if (action === 'attach' && state === 'detached') return 'attach-targeting';
  if (action === 'move' && state === 'attached') return 'moving';
  if (action === 'rotate' && state === 'attached') return 'rotating';
  return 'idle';
}
