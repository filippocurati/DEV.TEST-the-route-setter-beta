using Serilog;
using Serilog.Events;
using Serilog.Formatting;

namespace TheRouteSetter.Api.Services.Logging;

/// <summary>
/// Configura Serilog JSON, asincrono, giornaliero e con retention di sette giorni.
/// </summary>
public static class ServerLoggingConfiguration
{
    /// <summary>
    /// Applica la configurazione di logging server-side alla pipeline Serilog.
    /// </summary>
    public static void Configure(
        LoggerConfiguration loggerConfiguration,
        IConfiguration configuration,
        string contentRootPath)
    {
        var minimumLevel = ParseLevel(configuration["Logging:LogLevel:Default"]);
        var configuredPath = configuration["Logging:FilePath"] ?? "Logs/log-.json";
        var filePath = Path.GetFullPath(configuredPath, contentRootPath);
        var retentionDays = Math.Max(1, configuration.GetValue("Logging:RetentionDays", 7));
        var queueCapacity = Math.Max(1, configuration.GetValue("Logging:QueueCapacity", 2048));
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
        DeleteExpiredFiles(Path.GetDirectoryName(filePath)!, retentionDays, DateTime.UtcNow);

        var formatter = new SafeJsonLogFormatter(new SensitiveDataSanitizer());
        var fileLogger = new LoggerConfiguration()
            .MinimumLevel.Verbose()
            .WriteTo.File(
                formatter,
                filePath,
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: retentionDays,
                shared: false)
            .CreateLogger();

        loggerConfiguration
            .MinimumLevel.Is(minimumLevel)
            .MinimumLevel.Override("Microsoft.AspNetCore", ParseLevel(configuration["Logging:LogLevel:Microsoft.AspNetCore"]))
            .Enrich.FromLogContext()
            .WriteTo.Sink(new BoundedAsyncSink(fileLogger, queueCapacity));
    }

    /// <summary>
    /// Elimina i file JSON piu vecchi del periodo configurato.
    /// </summary>
    public static int DeleteExpiredFiles(string directory, int retentionDays, DateTime utcNow)
    {
        if (!Directory.Exists(directory))
        {
            return 0;
        }

        var threshold = utcNow.Date.AddDays(-retentionDays);
        var deleted = 0;
        foreach (var path in Directory.EnumerateFiles(directory, "log-*.json"))
        {
            if (File.GetLastWriteTimeUtc(path) < threshold)
            {
                File.Delete(path);
                deleted++;
            }
        }

        return deleted;
    }

    /// <summary>
    /// Converte il livello configurato nel corrispondente livello Serilog, con default Information.
    /// </summary>
    private static LogEventLevel ParseLevel(string? value) =>
        Enum.TryParse<LogEventLevel>(value, ignoreCase: true, out var level)
            ? level
            : LogEventLevel.Information;
}
