/** Comandi elementari disponibili per la presa selezionata. */
export type HoldCommand =
  | 'move-up'
  | 'move-down'
  | 'move-left'
  | 'move-right'
  | 'rotate-counterclockwise'
  | 'rotate-clockwise';

export const TRANSLATION_STEP_METERS = 0.01;
export const ROTATION_STEP_RADIANS = Math.PI / 180;

const keyboardCommands: Readonly<Record<string, HoldCommand>> = {
  ArrowUp: 'move-up',
  ArrowDown: 'move-down',
  ArrowLeft: 'move-left',
  ArrowRight: 'move-right',
  KeyQ: 'rotate-counterclockwise',
  KeyE: 'rotate-clockwise',
};

/** Restituisce il comando associato a uno shortcut fisico di tastiera. */
export function commandForKeyboardCode(code: string): HoldCommand | undefined {
  return keyboardCommands[code];
}

/** Indica se l'evento proviene da un controllo in cui le shortcut non devono intervenire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

/**
 * Gestisce click singolo e ripetizione continua per pulsanti e tastiera usando lo stesso callback.
 * La prima ripetizione parte dopo un breve ritardo per non duplicare il click singolo.
 */
export class ContinuousCommandController {
  private readonly active = new Map<string, {
    readonly kind: 'timeout' | 'interval';
    readonly id: ReturnType<typeof setTimeout>;
  }>();

  /** Avvia un comando con un'applicazione immediata e poi ripetuta. */
  start(key: string, command: HoldCommand, execute: (command: HoldCommand) => void): void {
    if (this.active.has(key)) {
      return;
    }

    execute(command);
    const timeout = globalThis.setTimeout(() => {
      const interval = globalThis.setInterval(() => execute(command), 60);
      this.active.set(key, { kind: 'interval', id: interval });
    }, 300);
    this.active.set(key, { kind: 'timeout', id: timeout });
  }

  /** Interrompe un comando attivo senza produrre passi aggiuntivi. */
  stop(key: string): void {
    const timer = this.active.get(key);
    if (!timer) {
      return;
    }

    if (timer.kind === 'timeout') {
      globalThis.clearTimeout(timer.id);
    } else {
      globalThis.clearInterval(timer.id);
    }
    this.active.delete(key);
  }

  /** Interrompe tutti i comandi, ad esempio alla perdita di focus della finestra. */
  stopAll(): void {
    [...this.active.keys()].forEach((key) => this.stop(key));
  }
}
