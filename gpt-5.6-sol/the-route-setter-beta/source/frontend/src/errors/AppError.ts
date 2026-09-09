export const GENERIC_PUBLIC_MESSAGE = 'Si e verificato un errore. Riprova o ricarica la pagina.';

export type ErrorCategory = 'Unknown' | 'JavaScript' | 'Network' | 'Http' | 'Parsing'
  | 'AssetLoad' | 'Configuration' | 'Rendering' | 'Physics' | 'Export' | 'UI';

/** Metadati ammessi per classificare e correlare un errore senza esporre dettagli interni. */
export interface AppErrorOptions {
  readonly category?: ErrorCategory;
  readonly errorId?: string;
  readonly requestId?: string;
  readonly context?: Readonly<Record<string, string>>;
}

/** Scarta valori sensibili invece di tentare di conservarne frammenti potenzialmente privati. */
export function redact(value: string, maxLength = 500): string {
  if (/(?:https?:|blob:|data:|file:|www\.|[a-z]:[\\/]|[\\/]|@|<|>|bearer\b|password|passwd|secret|token|api[-_ ]?key|authorization|cookie)/i.test(value)) {
    return '[REDACTED]';
  }
  return value.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, maxLength);
}

/** Accetta identificatori esadecimali a 128 bit, con o senza separatori UUID. */
export function validErrorId(value: unknown): string | undefined {
  return typeof value === 'string' && /^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(value)
    ? value : undefined;
}

/** Limita la correlazione HTTP a 128 caratteri appartenenti all'alfabeto consentito. */
export function validRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-z\d][a-z\d._:-]{0,127}$/i.test(value)
    ? value : undefined;
}

/** Solo il codice applicativo puo dichiarare un messaggio pubblico sicuro, mai un oggetto ricevuto. */
export class AppError extends Error {
  readonly publicMessage: string;
  readonly category: ErrorCategory;
  readonly errorId?: string;
  readonly requestId?: string;
  readonly context: Readonly<Record<string, string>>;

  /** Normalizza il messaggio pubblico e congela solo i metadati validati dalla lista consentita. */
  constructor(safeMessage: string, options: AppErrorOptions = {}) {
    const publicMessage = redact(safeMessage, 500).trim() || GENERIC_PUBLIC_MESSAGE;
    super(publicMessage);
    this.name = 'AppError';
    this.publicMessage = publicMessage;
    this.category = options.category ?? 'Unknown';
    this.errorId = validErrorId(options.errorId);
    this.requestId = validRequestId(options.requestId);
    const context: Record<string, string> = {};
    // Lista chiusa: niente payload, stack, URL o proprieta arbitrarie dell'eccezione.
    for (const key of ['operation', 'resource', 'status', 'errorClass', 'event']) {
      const value = options.context?.[key];
      if (typeof value === 'string') context[key] = redact(value);
    }
    this.context = Object.freeze(context);
    Object.freeze(this);
  }
}

/** Non legge message, stack, cause o proprieta personalizzate degli errori sconosciuti. */
export function toAppError(
  error: unknown,
  safeMessage = GENERIC_PUBLIC_MESSAGE,
  options: AppErrorOptions = {},
): AppError {
  let errorClass = 'Unknown';
  try {
    if (error instanceof AppError) return error;
    if (error instanceof TypeError) errorClass = 'TypeError';
    else if (error instanceof SyntaxError) errorClass = 'SyntaxError';
    else if (error instanceof RangeError) errorClass = 'RangeError';
    else if (error instanceof ReferenceError) errorClass = 'ReferenceError';
    else if (error instanceof Error) errorClass = 'Error';
  } catch {
    // Anche un valore lanciato con un proxy ostile resta un errore sconosciuto.
  }
  return new AppError(safeMessage, { ...options, context: { ...options.context, errorClass } });
}
