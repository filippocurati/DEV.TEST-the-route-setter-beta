using TheRouteSetter.Api.Models;

namespace TheRouteSetter.Api.Services.Logging;

/// <summary>
/// Inoltra gli eventi frontend al provider di logging configurato sul server.
/// </summary>
public sealed class FrontendLogService : IFrontendLogService
{
    private readonly ILogger<FrontendLogService> logger;
    private readonly ISensitiveDataSanitizer sanitizer;

    /// <summary>
    /// Inizializza il servizio con il logger server-side.
    /// </summary>
    public FrontendLogService(ILogger<FrontendLogService> logger, ISensitiveDataSanitizer sanitizer)
    {
        this.logger = logger;
        this.sanitizer = sanitizer;
    }

    /// <inheritdoc />
    public FrontendLogResponse Write(FrontendLogRequest request, string requestId)
    {
        var correlation = new FrontendLogResponse(
            request.Level is LogLevel.Error or LogLevel.Critical ? request.ErrorId ?? Guid.NewGuid().ToString("N") : null,
            request.RequestId ?? requestId);
        var properties = new Dictionary<string, object?>
        {
            ["Category"] = sanitizer.Sanitize(request.Category),
            ["Component"] = sanitizer.Sanitize(request.Component),
            ["RequestId"] = correlation.RequestId,
            ["ErrorId"] = correlation.ErrorId,
            ["IngestionRequestId"] = requestId
        };

        if (request.Context is not null)
        {
            foreach (var item in request.Context.Take(20))
            {
                // Il contesto browser sconosciuto non autorizza la persistenza di dati personali arbitrari.
                var safeValue = SensitiveDataSanitizer.IsSensitiveKey(item.Key) || !AllowedContextKeys.Contains(item.Key)
                    ? "[REDACTED]" : sanitizer.Sanitize(item.Value, 500);
                properties[$"Context.{sanitizer.Sanitize(item.Key, 80)}"] = safeValue;
            }
        }

        using (logger.BeginScope(properties))
        {
            logger.Log(request.Level!.Value, "Evento frontend: {FrontendMessage}", sanitizer.Sanitize(request.Message, 2000));
        }
        return correlation;
    }

    private static readonly HashSet<string> AllowedContextKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "operation", "assetId", "holdId", "status", "statusCode", "errorType", "retryCount", "phase",
        "resource", "errorClass", "event"
    };
}
