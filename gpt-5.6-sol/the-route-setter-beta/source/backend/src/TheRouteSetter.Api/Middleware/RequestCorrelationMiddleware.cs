using Serilog.Context;

namespace TheRouteSetter.Api.Middleware;

/// <summary>
/// Associa ogni evento prodotto durante una richiesta al relativo RequestId.
/// </summary>
public sealed class RequestCorrelationMiddleware
{
    private readonly RequestDelegate next;

    /// <summary>
    /// Inizializza il middleware con il componente successivo della pipeline.
    /// </summary>
    public RequestCorrelationMiddleware(RequestDelegate next)
    {
        this.next = next;
    }

    /// <summary>
    /// Propaga il RequestId nel contesto Serilog e nella risposta HTTP.
    /// </summary>
    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = context.TraceIdentifier;
        context.Response.Headers["X-Request-Id"] = requestId;

        using (LogContext.PushProperty("RequestId", requestId))
        using (LogContext.PushProperty("Component", "Backend"))
        {
            await next(context);
        }
    }
}
