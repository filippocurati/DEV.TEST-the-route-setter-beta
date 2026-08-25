import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  commandForKeyboardCode,
  ContinuousCommandController,
  ROTATION_STEP_RADIANS,
  TRANSLATION_STEP_METERS,
} from '../../src/input/holdCommands';

describe('comandi hold', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('definisce passi esatti e shortcut coerenti', () => {
    expect(TRANSLATION_STEP_METERS).toBe(0.01);
    expect(ROTATION_STEP_RADIANS).toBeCloseTo(Math.PI / 180);
    expect(commandForKeyboardCode('ArrowUp')).toBe('move-up');
    expect(commandForKeyboardCode('ArrowDown')).toBe('move-down');
    expect(commandForKeyboardCode('ArrowLeft')).toBe('move-left');
    expect(commandForKeyboardCode('ArrowRight')).toBe('move-right');
    expect(commandForKeyboardCode('KeyQ')).toBe('rotate-counterclockwise');
    expect(commandForKeyboardCode('KeyE')).toBe('rotate-clockwise');
  });

  it('applica un solo passo per una pressione breve', () => {
    vi.useFakeTimers();
    const execute = vi.fn();
    const controller = new ContinuousCommandController();

    controller.start('key:ArrowUp', 'move-up', execute);
    vi.advanceTimersByTime(200);
    controller.stop('key:ArrowUp');
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

  it('ignora keydown ripetuti per lo stesso comando attivo', () => {
    vi.useFakeTimers();
    const execute = vi.fn();
    const controller = new ContinuousCommandController();

    controller.start('key:KeyQ', 'rotate-counterclockwise', execute);
    controller.start('key:KeyQ', 'rotate-counterclockwise', execute);

    expect(execute).toHaveBeenCalledTimes(1);
    controller.stopAll();
  });
});
