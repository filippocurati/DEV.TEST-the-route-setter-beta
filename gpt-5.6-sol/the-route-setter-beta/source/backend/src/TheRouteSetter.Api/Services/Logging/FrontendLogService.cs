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
    public void Write(FrontendLogRequest request, string requestId)
    {
        var properties = new Dictionary<string, object?>
        {
            ["Category"] = sanitizer.Sanitize(request.Category),
            ["Component"] = sanitizer.Sanitize(request.Component),
            ["RequestId"] = requestId
        };

        if (request.Context is not null)
        {
            foreach (var item in request.Context.Take(20))
            {
                properties[$"Context.{sanitizer.Sanitize(item.Key, 80)}"] = sanitizer.Sanitize(item.Value, 500);
            }
        }

        using (logger.BeginScope(properties))
        {
            logger.Log(request.Level, "Evento frontend: {FrontendMessage}", sanitizer.Sanitize(request.Message));
        }
    }
}
