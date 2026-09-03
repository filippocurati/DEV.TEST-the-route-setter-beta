import { describe, expect, it } from 'vitest';
import { nextInteractionMode } from '../../src/interaction/interactionTypes';

describe('macchina a stati 9UX', () => {
  it('abilita soltanto modalità compatibili con lo stato fisico', () => {
    expect(nextInteractionMode('detached', 'attach')).toBe('attach-targeting');
    expect(nextInteractionMode('attached', 'move')).toBe('moving');
    expect(nextInteractionMode('attached', 'rotate')).toBe('rotating');
    expect(nextInteractionMode('detached', 'move')).toBe('idle');
    expect(nextInteractionMode('attached', 'attach')).toBe('idle');
    expect(nextInteractionMode('attached', 'cancel')).toBe('idle');
  });
});
