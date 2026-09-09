import { redact, toAppError, type ErrorCategory } from './AppError';

/** Payload diagnostico ridotto ai campi sicuri accettati dall'endpoint dei log. */
export interface FrontendLogDto {
  readonly level: 'Error';
  readonly category: ErrorCategory;
  readonly component: string;
  readonly message: string;
  readonly errorId?: string;
  readonly requestId?: string;
  readonly context: Readonly<Record<string, string>>;
}

export const ERROR_REPORTER_DEFAULTS = Object.freeze({
  maxQueue: 20,
  maxDedupe: 100,
  dedupeMs: 30_000,
  throttleMs: 1_000,
  maxAttempts: 3,
  retryBaseMs: 1_000,
  maxRetryMs: 8_000,
  timeoutMs: 5_000,
});

type ReporterSettings = { -readonly [K in keyof typeof ERROR_REPORTER_DEFAULTS]: number };

/** Permette limiti piu restrittivi e un trasporto sostituibile per l'invio dei log. */
export interface ErrorReporterOptions extends Partial<ReporterSettings> {
  readonly fetch?: typeof fetch;
}

/** Voce volatile con il numero di tentativi gia consumati. */
interface PendingLog {
  readonly dto: FrontendLogDto;
  attempts: number;
}

/** Coda volatile: un solo invio alla volta, nessun lavoro nel ciclo di rendering o persistenza locale. */
export class ErrorReporter {
  private readonly settings: ReporterSettings;
  private readonly transport: typeof fetch;
  private readonly queue: PendingLog[] = [];
  private readonly seen = new Map<string, number>();
  private timer?: ReturnType<typeof setTimeout>;
  private requestTimer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private uninstall?: () => void;
  private disposed = false;
  private notifying = false;

  /** Vincola le opzioni ai massimi previsti e collega la notifica UI al trasporto HTTP. */
  constructor(
    private readonly showSafeMessage: (message: string) => void | Promise<void>,
    options: ErrorReporterOptions = {},
  ) {
    const settings: ReporterSettings = { ...ERROR_REPORTER_DEFAULTS };
    for (const key of Object.keys(settings) as (keyof typeof settings)[]) {
      const value = options[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        settings[key] = Math.max(1, Math.min(ERROR_REPORTER_DEFAULTS[key], Math.floor(value)));
      }
    }
    this.settings = settings;
    this.transport = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  /** Restituisce subito il testo per il catch della UI; non notifica di nuovo il callback globale. */
  report(error: unknown, component: string, safeMessage?: string): string {
    const appError = toAppError(error, safeMessage);
    if (this.disposed) return appError.publicMessage;
    const dto: FrontendLogDto = {
      level: 'Error', category: appError.category,
      component: redact(component, 80).trim() || 'Frontend',
      message: appError.publicMessage,
      errorId: appError.errorId, requestId: appError.requestId, context: appError.context,
    };
    const now = Date.now();
    for (const [key, time] of this.seen) {
      if (now - time >= this.settings.dedupeMs) this.seen.delete(key);
    }
    const key = JSON.stringify(dto);
    if (this.seen.has(key) || this.queue.length >= this.settings.maxQueue) return appError.publicMessage;
    if (this.seen.size >= this.settings.maxDedupe) this.seen.delete(this.seen.keys().next().value!);
    this.seen.set(key, now);
    this.queue.push({ dto, attempts: 0 });
    this.schedule(this.settings.throttleMs);
    return appError.publicMessage;
  }

  /** Non sopprime la diagnostica nativa del browser con preventDefault. */
  installGlobal(target: Window = window): () => void {
    this.uninstall?.();
    if (this.disposed) return () => {};
    const notify = (error: unknown, component: string): void => {
      if (this.notifying || this.disposed) return;
      this.notifying = true;
      try {
        const message = this.report(error, component);
        void Promise.resolve(this.showSafeMessage(message)).catch(() => {});
      } catch {
        // Un guasto della UI diagnostica non deve generare un secondo errore globale.
      } finally {
        this.notifying = false;
      }
    };
    const onError = (event: ErrorEvent): void => notify(event.error, 'GlobalError');
    const onRejection = (event: PromiseRejectionEvent): void => notify(event.reason, 'GlobalPromise');
    target.addEventListener('error', onError, { capture: true });
    target.addEventListener('unhandledrejection', onRejection);
    const uninstall = (): void => {
      target.removeEventListener('error', onError, { capture: true });
      target.removeEventListener('unhandledrejection', onRejection);
      if (this.uninstall === uninstall) this.uninstall = undefined;
    };
    this.uninstall = uninstall;
    return uninstall;
  }

  /** Interrompe invii e timer, rimuove gli handler globali e svuota i dati della sessione. */
  dispose(): void {
    this.disposed = true;
    this.uninstall?.();
    clearTimeout(this.timer);
    clearTimeout(this.requestTimer);
    this.controller?.abort();
    this.queue.length = 0;
    this.seen.clear();
  }

  /** Pianifica un invio soltanto quando non esistono timer o richieste concorrenti. */
  private schedule(delay: number): void {
    if (this.disposed || this.timer !== undefined || this.controller || !this.queue.length) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.send();
    }, delay);
  }

  /** Invia la testa della coda con timeout e retry limitati, senza segnalare errori del reporter stesso. */
  private async send(): Promise<void> {
    const entry = this.queue[0];
    const controller = new AbortController();
    this.controller = controller;
    entry.attempts += 1;
    let retry = false;
    try {
      const aborted = new Promise<undefined>((resolve) => {
        controller.signal.addEventListener('abort', () => resolve(undefined), { once: true });
      });
      this.requestTimer = setTimeout(() => controller.abort(), this.settings.timeoutMs);
      // Il trasporto dei log non usa gli helper applicativi e non segnala mai il proprio fallimento.
      const response = await Promise.race([this.transport('/api/logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.dto), signal: controller.signal,
        credentials: 'same-origin', redirect: 'error',
      }), aborted]);
      retry = !response || response.status === 408 || response.status === 429 || response.status >= 500;
      // Il 202 conclude l'invio; gli ID della ricevuta non sostituiscono quelli dell'errore originale.
    } catch {
      retry = true;
    } finally {
      clearTimeout(this.requestTimer);
      this.requestTimer = undefined;
      this.controller = undefined;
    }
    if (this.disposed) return;
    if (retry && entry.attempts < this.settings.maxAttempts) {
      this.schedule(Math.max(this.settings.throttleMs,
        Math.min(this.settings.maxRetryMs, this.settings.retryBaseMs * 2 ** (entry.attempts - 1))));
    } else {
      this.queue.shift();
      this.schedule(this.settings.throttleMs);
    }
  }
}
