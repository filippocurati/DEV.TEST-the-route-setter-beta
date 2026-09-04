import { quantizeRotationDelta } from './targetSampling';
import type {
  InteractionSnapshot,
  MoveDirection,
  RotationDirection,
  SceneActionResult,
} from './interactionTypes';

export interface HoldOverlayActions {
  details(): void;
  attach(): SceneActionResult;
  detach(): SceneActionResult;
  moveMode(): SceneActionResult;
  move(direction: MoveDirection): SceneActionResult;
  rotateMode(): SceneActionResult;
  rotate(direction: RotationDirection, steps?: number): SceneActionResult;
  beginMoveDrag(direction: MoveDirection | 'free', point: { x: number; y: number }, pointerId: number): SceneActionResult;
  updateMoveDrag(point: { x: number; y: number }, pointerId: number): void;
  commitMoveDrag(pointerId: number): SceneActionResult;
  beginRotationDrag(point: { x: number; y: number }, pointerId: number): SceneActionResult;
  updateRotationDrag(point: { x: number; y: number }, pointerId: number): void;
  commitRotationDrag(pointerId: number): SceneActionResult;
  cancelTransformDrag(): void;
  remove(): void;
  cancel(): void;
  setOrbitEnabled(enabled: boolean): void;
  feedback(result: SceneActionResult): void;
}

/** Overlay DOM unico per popup, hint e gizmo della hold selezionata. */
export class HoldOverlay {
  private readonly root: HTMLDivElement;
  private readonly menu: HTMLDivElement;
  private readonly hint: HTMLParagraphElement;
  private readonly moveHandles: HTMLDivElement;
  private readonly rotationHandles: HTMLDivElement;
  private readonly dragIndicator: HTMLDivElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private movePointer: {
    id: number;
    startX: number;
    startY: number;
    dragging: boolean;
    direction: MoveDirection;
    element: HTMLElement;
  } | null = null;
  private rotationPointer: {
    id: number;
    startX: number;
    startY: number;
    dragged: boolean;
    direction: RotationDirection;
    element: HTMLElement;
  } | null = null;
  private moveFrame: number | null = null;
  private pendingMovePoint: { x: number; y: number } | null = null;
  private rotationFrame: number | null = null;
  private pendingRotationPoint: { x: number; y: number } | null = null;
  private contactScreenPoint: { x: number; y: number } | null = null;

  constructor(private readonly container: HTMLElement, private readonly actions: HoldOverlayActions) {
    this.root = document.createElement('div');
    this.root.className = 'hold-overlay';
    this.root.dataset.holdOverlay = 'true';
    this.root.innerHTML = `
      <div class="hold-context-menu" role="toolbar" aria-label="Azioni presa selezionata" data-context-menu hidden>
        <button type="button" data-action="details">Dettagli</button>
        <button type="button" data-action="attach">Aggancia</button>
        <button type="button" data-action="detach">Sgancia</button>
        <button type="button" data-action="rotate">Ruota</button>
        <button type="button" data-action="move">Sposta</button>
        <button type="button" data-action="remove" class="danger">Rimuovi</button>
      </div>
      <div class="move-handles" data-move-handles hidden>
        <span data-move="up" aria-hidden="true">↑</span>
        <span data-move="left" aria-hidden="true">←</span>
        <span data-move="right" aria-hidden="true">→</span>
        <span data-move="down" aria-hidden="true">↓</span>
      </div>
      <div class="rotation-handles" data-rotation-handles hidden>
        <span data-rotate="counterclockwise" aria-hidden="true">↶</span>
        <span data-rotate="clockwise" aria-hidden="true">↷</span>
      </div>
      <div class="drag-indicator" data-drag-indicator hidden></div>
      <p class="interaction-hint" role="status" data-interaction-hint hidden>Premi Escape per terminare</p>
    `;
    container.append(this.root);
    this.menu = required<HTMLDivElement>(this.root, '[data-context-menu]');
    this.hint = required<HTMLParagraphElement>(this.root, '[data-interaction-hint]');
    this.moveHandles = required<HTMLDivElement>(this.root, '[data-move-handles]');
    this.rotationHandles = required<HTMLDivElement>(this.root, '[data-rotation-handles]');
    this.dragIndicator = required<HTMLDivElement>(this.root, '[data-drag-indicator]');
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => this.buttons.set(button.dataset.action!, button));
    this.bindMenu();
    this.bindMoveHandles();
    this.bindRotationHandles();
  }

  update(snapshot: InteractionSnapshot): void {
    const selected = snapshot.selected;
    this.contactScreenPoint = selected?.contactScreenPoint ?? null;
    const showMenu = Boolean(selected?.screenBounds.visible) && snapshot.mode !== 'attach-targeting' && !snapshot.exporting;
    this.menu.hidden = !showMenu;
    this.root.hidden = snapshot.exporting;
    if (selected && showMenu) {
      const centerX = (selected.screenBounds.left + selected.screenBounds.right) / 2;
      const top = selected.screenBounds.top;
      const menuWidth = Math.max(this.menu.offsetWidth, 1);
      const menuHeight = Math.max(this.menu.offsetHeight, 1);
      this.menu.style.left = `${Math.max(8, Math.min(this.container.clientWidth - menuWidth - 8, centerX - menuWidth / 2))}px`;
      this.menu.style.top = `${Math.max(8, Math.min(this.container.clientHeight - menuHeight - 8, top - menuHeight - 8))}px`;
      const detached = selected.physicalState === 'detached';
      this.buttons.get('attach')!.disabled = !detached;
      this.buttons.get('detach')!.disabled = detached;
      this.buttons.get('move')!.disabled = detached;
      this.buttons.get('rotate')!.disabled = detached;
      this.positionHandles(snapshot);
    }
    this.hint.hidden = snapshot.mode === 'idle' || snapshot.exporting;
    this.moveHandles.hidden = snapshot.mode !== 'moving' || !selected?.screenBounds.visible || snapshot.exporting;
    this.rotationHandles.hidden = snapshot.mode !== 'rotating' || !selected?.screenBounds.visible || snapshot.exporting;
    if (snapshot.mode !== 'moving') this.finishMove(false);
    if (snapshot.mode !== 'rotating') this.finishRotation();
    this.updateDragIndicator(snapshot);
  }

  cancel(): void {
    this.finishMove(false);
    this.finishRotation();
    this.actions.cancelTransformDrag();
  }

  private bindMenu(): void {
    this.buttons.get('details')!.addEventListener('click', () => this.actions.details());
    this.buttons.get('attach')!.addEventListener('click', () => this.report(this.actions.attach()));
    this.buttons.get('detach')!.addEventListener('click', () => this.report(this.actions.detach()));
    this.buttons.get('move')!.addEventListener('click', () => this.report(this.actions.moveMode()));
    this.buttons.get('rotate')!.addEventListener('click', () => this.report(this.actions.rotateMode()));
    this.buttons.get('remove')!.addEventListener('click', () => this.actions.remove());
  }

  private bindMoveHandles(): void {
    this.moveHandles.querySelectorAll<HTMLElement>('[data-move]').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);
        const direction = handle.dataset.move as MoveDirection;
        this.movePointer = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          dragging: false,
          direction,
          element: handle,
        };
      });
      handle.addEventListener('pointermove', (event) => {
        this.updateMovePointer(event);
      });
      handle.addEventListener('pointerup', (event) => {
        if (this.movePointer?.dragging) this.actions.updateMoveDrag(this.viewportPoint(event), event.pointerId);
        this.finishMove(true);
      });
      handle.addEventListener('pointercancel', () => this.finishMove(false));
      handle.addEventListener('lostpointercapture', () => this.finishMove(false));
    });
  }

  private bindRotationHandles(): void {
    this.rotationHandles.querySelectorAll<HTMLElement>('[data-rotate]').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);
        this.rotationPointer = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          dragged: false,
          direction: handle.dataset.rotate as RotationDirection,
          element: handle,
        };
      });
      handle.addEventListener('pointermove', (event) => {
        if (!this.rotationPointer || event.pointerId !== this.rotationPointer.id) return;
        if (!this.rotationPointer.dragged && Math.hypot(
          event.clientX - this.rotationPointer.startX,
          event.clientY - this.rotationPointer.startY,
        ) >= 4) {
          this.rotationPointer.dragged = true;
          this.report(this.actions.beginRotationDrag(this.viewportPointFromClient(
            this.rotationPointer.startX,
            this.rotationPointer.startY,
          ), event.pointerId));
        }
        if (this.rotationPointer.dragged) {
          this.pendingRotationPoint = this.viewportPoint(event);
          if (this.rotationFrame === null) {
            const pointerId = event.pointerId;
            this.rotationFrame = requestAnimationFrame(() => {
              this.rotationFrame = null;
              if (this.pendingRotationPoint) this.actions.updateRotationDrag(this.pendingRotationPoint, pointerId);
            });
          }
        }
      });
      handle.addEventListener('pointerup', (event) => {
        if (!this.rotationPointer) return;
        if (this.rotationPointer.dragged) {
          this.actions.updateRotationDrag(this.viewportPoint(event), event.pointerId);
          this.report(this.actions.commitRotationDrag(this.rotationPointer.id));
        }
        else this.report(this.actions.rotate(this.rotationPointer.direction));
        this.finishRotation(false);
      });
      handle.addEventListener('pointercancel', () => this.finishRotation(true));
      handle.addEventListener('lostpointercapture', () => this.finishRotation(true));
    });
  }

  private updateMovePointer(event: PointerEvent): void {
    if (!this.movePointer || event.pointerId !== this.movePointer.id) return;
    const point = this.viewportPoint(event);
    if (!this.movePointer.dragging && Math.hypot(
      event.clientX - this.movePointer.startX,
      event.clientY - this.movePointer.startY,
    ) >= 4) {
      this.movePointer.dragging = true;
      this.report(this.actions.beginMoveDrag(
        this.movePointer.direction,
        this.viewportPointFromClient(this.movePointer.startX, this.movePointer.startY),
        event.pointerId,
      ));
    }
    if (!this.movePointer.dragging) return;
    this.pendingMovePoint = point;
    if (this.moveFrame === null) {
      const pointerId = event.pointerId;
      this.moveFrame = requestAnimationFrame(() => {
        this.moveFrame = null;
        if (this.pendingMovePoint) this.actions.updateMoveDrag(this.pendingMovePoint, pointerId);
      });
    }
  }

  private positionHandles(snapshot: InteractionSnapshot): void {
    const bounds = snapshot.selected!.screenBounds;
    const centerX = snapshot.selected!.contactScreenPoint?.x ?? (bounds.left + bounds.right) / 2;
    const centerY = snapshot.selected!.contactScreenPoint?.y ?? (bounds.top + bounds.bottom) / 2;
    this.moveHandles.style.left = `${centerX}px`;
    this.moveHandles.style.top = `${centerY}px`;
    this.rotationHandles.style.left = `${centerX}px`;
    this.rotationHandles.style.top = `${centerY}px`;
  }

  private rotationCenter(): { x: number; y: number } {
    const bounds = this.container.getBoundingClientRect();
    return {
      x: bounds.left + (this.contactScreenPoint?.x ?? Number.parseFloat(this.rotationHandles.style.left)),
      y: bounds.top + (this.contactScreenPoint?.y ?? Number.parseFloat(this.rotationHandles.style.top)),
    };
  }

  private finishMove(commit: boolean): void {
    if (!this.movePointer) return;
    const pointer = this.movePointer;
    this.movePointer = null;
    if (this.moveFrame !== null) cancelAnimationFrame(this.moveFrame);
    this.moveFrame = null;
    this.pendingMovePoint = null;
    if (pointer.element.hasPointerCapture(pointer.id)) pointer.element.releasePointerCapture(pointer.id);
    if (pointer.dragging) {
      if (commit) this.report(this.actions.commitMoveDrag(pointer.id));
      else this.actions.cancelTransformDrag();
    } else if (commit) {
      this.report(this.actions.move(pointer.direction));
    }
  }

  private finishRotation(cancel = true): void {
    if (this.rotationPointer) {
      const wasDragging = this.rotationPointer.dragged;
      if (this.rotationPointer.element.hasPointerCapture(this.rotationPointer.id)) {
        this.rotationPointer.element.releasePointerCapture(this.rotationPointer.id);
      }
      if (cancel && wasDragging) this.actions.cancelTransformDrag();
    }
    this.rotationPointer = null;
    if (this.rotationFrame !== null) cancelAnimationFrame(this.rotationFrame);
    this.rotationFrame = null;
    this.pendingRotationPoint = null;
  }

  private updateDragIndicator(snapshot: InteractionSnapshot): void {
    const preview = snapshot.dragPreview;
    this.dragIndicator.hidden = !preview || snapshot.exporting;
    if (!preview) return;
    const dx = preview.requested.x - preview.start.x;
    const dy = preview.requested.y - preview.start.y;
    const length = Math.hypot(dx, dy);
    this.dragIndicator.style.left = `${preview.start.x}px`;
    this.dragIndicator.style.top = `${preview.start.y}px`;
    this.dragIndicator.style.width = `${length}px`;
    this.dragIndicator.style.rotate = `${Math.atan2(dy, dx)}rad`;
    this.dragIndicator.dataset.kind = preview.kind;
    this.dragIndicator.textContent = preview.angleDegrees === null ? '' : `${Math.round(preview.angleDegrees)}°`;
  }

  private viewportPoint(event: PointerEvent): { x: number; y: number } {
    return this.viewportPointFromClient(event.clientX, event.clientY);
  }

  private viewportPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const bounds = this.container.getBoundingClientRect();
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }

  private report(result: SceneActionResult): void {
    this.actions.feedback(result);
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Overlay incompleto: ${selector}`);
  return element;
}
