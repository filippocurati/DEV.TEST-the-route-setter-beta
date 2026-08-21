using System.Text.Json;
using TheRouteSetter.Api.Contracts;

namespace TheRouteSetter.Api.Middleware;

public sealed class GlobalExceptionHandlingMiddleware
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly RequestDelegate next;
    private readonly ILogger<GlobalExceptionHandlingMiddleware> logger;

    public GlobalExceptionHandlingMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlingMiddleware> logger)
    {
        this.next = next;
        this.logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            string errorId = Guid.NewGuid().ToString("N");
            string requestId = context.TraceIdentifier;

            logger.LogError(
                exception,
                "Unhandled exception intercepted. ErrorId: {ErrorId}, RequestId: {RequestId}, Component: {Component}",
                errorId,
                requestId,
                "backend");

            if (context.Response.HasStarted)
            {
                return;
            }

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";

            var errorResponse = new ApiErrorResponseDto(
                errorId,
                "Si e verificato un errore interno. Fornisci il codice errore al supporto tecnico.");

            string payload = JsonSerializer.Serialize(errorResponse, JsonSerializerOptions);
            await context.Response.WriteAsync(payload);
        }
    }
}
