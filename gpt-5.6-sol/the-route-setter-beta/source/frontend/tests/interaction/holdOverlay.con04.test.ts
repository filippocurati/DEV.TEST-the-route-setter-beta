import { describe, expect, it, vi } from 'vitest';
import { HoldOverlay, type HoldOverlayActions } from '../../src/interaction/holdOverlay';
import type { InteractionSnapshot } from '../../src/interaction/interactionTypes';

describe('CON04 geometria e cleanup overlay', () => {
  it('posiziona le frecce sul bounding box, non sul contatto asimmetrico', () => {
    const overlay = Object.create(HoldOverlay.prototype) as HoldOverlay;
    const moveStyle = { left: '', top: '', setProperty: vi.fn() };
    const rotationStyle = { left: '', top: '' };
    Object.assign(overlay, { moveHandles: { style: moveStyle }, rotationHandles: { style: rotationStyle } });
    const snapshot = { selected: {
      id: 'Hold1', physicalState: 'attached', contactScreenPoint: { x: 125, y: 180 },
      screenBounds: { left: 100, right: 300, top: 120, bottom: 220, visible: true },
    } } as InteractionSnapshot;
    (overlay as unknown as { positionHandles(snapshot: InteractionSnapshot): void }).positionHandles(snapshot);
    expect(moveStyle.left).toBe('200px');
    expect(moveStyle.top).toBe('170px');
    expect(moveStyle.setProperty.mock.calls).toEqual([['--hold-half-width', '100px'], ['--hold-half-height', '50px']]);
    expect(rotationStyle).toEqual({ left: '125px', top: '180px' });
  });

  it('rilascia la rotazione prima di lostpointercapture senza ricorsione o doppio rollback', () => {
    const overlay = Object.create(HoldOverlay.prototype) as HoldOverlay;
    const cancel = vi.fn();
    const release = vi.fn(() => overlay.cancel());
    Object.assign(overlay, {
      actions: { cancelTransformDrag: cancel } as unknown as HoldOverlayActions,
      rotationPointer: { id: 1, dragged: true, element: { hasPointerCapture: () => true, releasePointerCapture: release } },
      movePointer: null, moveFrame: null, rotationFrame: null,
    });
    (overlay as unknown as { finishRotation(cancel: boolean): void }).finishRotation(false);
    expect(release).toHaveBeenCalledOnce();
    // Il solo cancel esplicito simulato dal listener esterno effettua il rollback.
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('mantiene pointer capture fuori canvas fino al flush del pointerup e cancella il RAF pendente', () => {
    const overlay = Object.create(HoldOverlay.prototype) as HoldOverlay;
    const handle = new EventTarget();
    let captured = false;
    const release = vi.fn(() => {
      captured = false;
      handle.dispatchEvent(new Event('lostpointercapture'));
    });
    Object.assign(handle, {
      dataset: { move: 'up' },
      setPointerCapture: vi.fn(() => { captured = true; }),
      hasPointerCapture: () => captured,
      releasePointerCapture: release,
    });
    const update = vi.fn(() => { expect(captured).toBe(true); });
    const commit = vi.fn(() => ({ status: 'invalid-endpoint', reason: 'no-surface' }));
    const cancel = vi.fn();
    const cancelFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 7));
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
    Object.assign(overlay, {
      container: { getBoundingClientRect: () => ({ left: 100, top: 80 }) },
      moveHandles: { querySelectorAll: () => [handle] },
      actions: { beginMoveDrag: () => ({ status: 'previewing' }), updateMoveDrag: update,
        commitMoveDrag: commit, cancelTransformDrag: cancel, feedback: vi.fn() },
      movePointer: null, moveFrame: null,
    });
    /** Invia coordinate client anche esterne al canvas mantenendo lo stesso puntatore. */
    const dispatch = (type: string, y: number): void => {
      handle.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), {
        pointerId: 9, pointerType: 'mouse', button: 0, clientX: 300, clientY: y,
      }));
    };
    try {
      (overlay as unknown as { bindMoveHandles(): void }).bindMoveHandles();
      dispatch('pointerdown', 300);
      dispatch('pointermove', 5);
      expect(captured).toBe(true);
      expect(update).not.toHaveBeenCalled();
      dispatch('pointerup', 6);
      expect(update).toHaveBeenCalledOnce();
      expect(update).toHaveBeenCalledWith({ x: 200, y: -74 }, 9);
      expect(commit).toHaveBeenCalledWith(9);
      expect(cancel).not.toHaveBeenCalled();
      expect(cancelFrame).toHaveBeenCalledWith(7);
      expect(release).toHaveBeenCalledOnce();
      expect(captured).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
