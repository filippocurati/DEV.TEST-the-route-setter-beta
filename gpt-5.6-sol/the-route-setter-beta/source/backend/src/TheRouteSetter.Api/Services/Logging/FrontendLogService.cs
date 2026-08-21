using TheRouteSetter.Api.Models;

namespace TheRouteSetter.Api.Services.Logging;

/// <summary>
/// Inoltra gli eventi frontend al provider di logging configurato sul server.
/// </summary>
public sealed class FrontendLogService : IFrontendLogService
{
    private readonly ILogger<FrontendLogService> logger;

    /// <summary>
    /// Inizializza il servizio con il logger server-side.
    /// </summary>
    public FrontendLogService(ILogger<FrontendLogService> logger)
    {
        this.logger = logger;
    }

    /// <inheritdoc />
    public void Write(FrontendLogRequest request)
    {
        logger.LogInformation(
            "Evento frontend {Level} in {Category} da {Component}: {Message}",
            request.Level,
            request.Category,
            request.Component,
            request.Message);
    }
}
