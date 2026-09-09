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
        var overrides = configuration.GetSection("Logging:LogLevel").GetChildren()
            .Where(section => !section.Key.Equals("Default", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(section => section.Key.Length)
            .Select(section => (Category: section.Key, Level: ParseLevel(section.Value))).ToArray();
        var configuredPath = configuration["Logging:FilePath"] ?? "Logs/log-.json";
        var filePath = Path.GetFullPath(configuredPath, contentRootPath);
        var retentionDays = Math.Max(1, configuration.GetValue("Logging:RetentionDays", 7));
        var queueCapacity = Math.Max(1, configuration.GetValue("Logging:QueueCapacity", 2048));
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
        var retention = new LogFileRetention(filePath, retentionDays);

        var formatter = new SafeJsonLogFormatter(new SensitiveDataSanitizer());
        var fileLogger = new LoggerConfiguration()
            .MinimumLevel.Verbose()
            .WriteTo.File(
                formatter,
                filePath,
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: null,
                shared: false)
            .CreateLogger();

        loggerConfiguration
            .MinimumLevel.Verbose()
            .Enrich.FromLogContext()
            .Filter.ByIncludingOnly(logEvent =>
            {
                var category = logEvent.Properties.TryGetValue("Category", out var explicitCategory) ? explicitCategory
                    : logEvent.Properties.GetValueOrDefault("SourceContext");
                var name = (category as ScalarValue)?.Value as string ?? "";
                var threshold = minimumLevel;
                foreach (var item in overrides)
                {
                    if (!name.StartsWith(item.Category, StringComparison.OrdinalIgnoreCase)) continue;
                    threshold = item.Level;
                    break;
                }
                return (int)logEvent.Level >= (int)threshold;
            })
            .WriteTo.Sink(new BoundedAsyncSink(fileLogger, queueCapacity, () => retention.SweepIfDue(DateTime.UtcNow)));
    }

    /// <summary>
    /// Elimina i file JSON piu vecchi del periodo configurato.
    /// </summary>
    public static int DeleteExpiredFiles(string directory, int retentionDays, DateTime utcNow)
    {
        return new LogFileRetention(Path.Combine(directory, "log-.json"), retentionDays).SweepIfDue(utcNow);
    }

    /// <summary>
    /// Converte il livello configurato nel corrispondente livello Serilog, con default Information.
    /// </summary>
    private static LogLevel ParseLevel(string? value) =>
        Enum.TryParse<LogLevel>(value, ignoreCase: true, out var level) && Enum.IsDefined(level)
            ? level
            : LogLevel.Information;
}
