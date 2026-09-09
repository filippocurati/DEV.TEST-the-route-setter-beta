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
        var statusCode = MapStatusCode(exception);
        var response = ApiErrors.Create(context, statusCode, exception, logger);

        if (context.Response.HasStarted)
        {
            context.Abort();
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.Headers["X-Request-Id"] = context.TraceIdentifier;
        await context.Response.WriteAsJsonAsync(
            response,
            context.RequestAborted);
    }

    /// <summary>
    /// Associa alle eccezioni note uno stato HTTP coerente senza esporne il contenuto.
    /// </summary>
    private static int MapStatusCode(Exception exception) => exception switch
    {
        BadHttpRequestException badRequest => badRequest.StatusCode,
        ArgumentException => StatusCodes.Status400BadRequest,
        FileNotFoundException or KeyNotFoundException => StatusCodes.Status404NotFound,
        _ => StatusCodes.Status500InternalServerError
    };
}
