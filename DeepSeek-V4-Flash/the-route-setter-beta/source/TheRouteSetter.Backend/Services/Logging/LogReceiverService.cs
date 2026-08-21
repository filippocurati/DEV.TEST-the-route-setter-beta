using TheRouteSetter.Backend.Models;

namespace TheRouteSetter.Backend.Services.Logging;

/// <summary>
/// Servizio per la ricezione di eventi di log dal frontend.
/// I log sono inoltrati al sistema di logging ASP.NET Core.
/// </summary>
public class LogReceiverService
{
    private readonly ILogger<LogReceiverService> _logger;

    /// <summary>
    /// Inizializza il servizio di ricezione log.
    /// </summary>
    public LogReceiverService(ILogger<LogReceiverService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Registra un evento di log proveniente dal frontend.
    /// </summary>
    public void Log(LogEntry entry)
    {
        var logLevel = ParseLogLevel(entry.Level);
        var message = "[Frontend:{Component}] [{Category}] {Message}";
        if (!string.IsNullOrEmpty(entry.Details))
        {
            message += " | Dettagli: {Details}";
        }

        _logger.Log(logLevel, message, entry.Component, entry.Category, entry.Message, entry.Details);
    }

    private static LogLevel ParseLogLevel(string level)
    {
        return level.ToLowerInvariant() switch
        {
            "trace" => LogLevel.Trace,
            "debug" => LogLevel.Debug,
            "information" => LogLevel.Information,
            "warning" => LogLevel.Warning,
            "error" => LogLevel.Error,
            "critical" => LogLevel.Critical,
            _ => LogLevel.Information
        };
    }
}