import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContinuousCommandController,
  ROTATION_STEP_RADIANS,
  TRANSLATION_STEP_METERS,
} from '../../src/input/holdCommands';

describe('comandi hold', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('definisce passi esatti per gli handle mouse', () => {
    expect(TRANSLATION_STEP_METERS).toBe(0.01);
    expect(ROTATION_STEP_RADIANS).toBeCloseTo(Math.PI / 180);
  });

  it('applica un solo passo per una pressione breve', () => {
    vi.useFakeTimers();
    const execute = vi.fn();
    const controller = new ContinuousCommandController();

    controller.start('pointer:move-up', 'move-up', execute);
    vi.advanceTimersByTime(200);
    controller.stop('pointer:move-up');
    vi.advanceTimersByTime(500);

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('ripete il comando durante una pressione continua e si arresta al rilascio', () => {
    vi.useFakeTimers();
    const execute = vi.fn();
    const controller = new ContinuousCommandController();

    controller.start('button:move-right', 'move-right', execute);
    vi.advanceTimersByTime(500);
    controller.stop('button:move-right');
    const callsAtRelease = execute.mock.calls.length;
    vi.advanceTimersByTime(500);

    expect(callsAtRelease).toBeGreaterThan(1);
    expect(execute).toHaveBeenCalledTimes(callsAtRelease);
  });

  it('ignora pointerdown ripetuti per lo stesso comando attivo', () => {
    vi.useFakeTimers();
    const execute = vi.fn();
    const controller = new ContinuousCommandController();

    controller.start('pointer:rotate', 'rotate-counterclockwise', execute);
    controller.start('pointer:rotate', 'rotate-counterclockwise', execute);

    expect(execute).toHaveBeenCalledTimes(1);
    controller.stopAll();
  });
});
