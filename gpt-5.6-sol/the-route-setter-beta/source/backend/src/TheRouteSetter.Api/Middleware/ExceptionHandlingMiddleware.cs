using TheRouteSetter.Api.Models;

namespace TheRouteSetter.Api.Middleware;

/// <summary>
/// Intercetta centralmente le eccezioni e restituisce un contratto sicuro e correlabile.
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate next;
    private readonly ILogger<ExceptionHandlingMiddleware> logger;

    /// <summary>
    /// Inizializza il middleware con pipeline e logger server-side.
    /// </summary>
    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        this.next = next;
        this.logger = logger;
    }

    /// <summary>
    /// Prosegue la richiesta e traduce eventuali errori non gestiti.
    /// </summary>
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception) when (!context.RequestAborted.IsCancellationRequested)
        {
            await WriteErrorAsync(context, exception);
        }
    }

    /// <summary>
    /// Registra il dettaglio tecnico e invia al client esclusivamente informazioni sicure.
    /// </summary>
    private async Task WriteErrorAsync(HttpContext context, Exception exception)
    {
        var errorId = Guid.NewGuid().ToString("N");
        var statusCode = MapStatusCode(exception);
        var message = statusCode switch
        {
            StatusCodes.Status400BadRequest => "La richiesta non e valida.",
            StatusCodes.Status404NotFound => "La risorsa richiesta non e disponibile.",
            _ => "Si e verificato un errore inatteso. Riprova o comunica l'identificativo al supporto."
        };

        using (logger.BeginScope(new Dictionary<string, object?>
        {
            ["ErrorId"] = errorId,
            ["RequestId"] = context.TraceIdentifier,
            ["Component"] = "Backend",
            ["Category"] = "UnhandledException"
        }))
        {
            logger.LogError(exception, "Errore backend non gestito {ErrorId}", errorId);
        }

        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.Headers["X-Request-Id"] = context.TraceIdentifier;
        await context.Response.WriteAsJsonAsync(
            new ErrorResponse(errorId, context.TraceIdentifier, message),
            context.RequestAborted);
    }

    /// <summary>
    /// Associa alle eccezioni note uno stato HTTP coerente senza esporne il contenuto.
    /// </summary>
    private static int MapStatusCode(Exception exception) => exception switch
    {
        BadHttpRequestException or ArgumentException => StatusCodes.Status400BadRequest,
        FileNotFoundException or KeyNotFoundException => StatusCodes.Status404NotFound,
        _ => StatusCodes.Status500InternalServerError
    };
}
