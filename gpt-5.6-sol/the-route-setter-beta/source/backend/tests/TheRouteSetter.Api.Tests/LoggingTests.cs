using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Serilog;
using Serilog.Events;
using TheRouteSetter.Api.Services.Logging;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica struttura JSON, sanitizzazione, soglia, asincronia e retention dei log.
/// </summary>
public sealed class LoggingTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), $"logging-tests-{Guid.NewGuid():N}");

    /// <summary>
    /// Crea la directory temporanea usata dai test file.
    /// </summary>
    public LoggingTests()
    {
        Directory.CreateDirectory(directory);
    }

    /// <summary>
    /// Verifica campi minimi, correlazione e mascheramento nel JSON prodotto.
    /// </summary>
    [Fact]
    public void JsonFormatter_ProducesStructuredSanitizedEvent()
    {
        var formatter = new SafeJsonLogFormatter(new SensitiveDataSanitizer());
        var logEvent = new LogEvent(
            DateTimeOffset.UtcNow,
            LogEventLevel.Error,
            new InvalidOperationException("token=exception-secret"),
            new Serilog.Parsing.MessageTemplateParser().Parse("Errore password={Password} Authorization: Bearer abc.def.ghi"),
            [
                new LogEventProperty("Password", new ScalarValue("plain-secret")),
                new LogEventProperty("ApiKey", new ScalarValue("property-secret")),
                new LogEventProperty("Category", new ScalarValue("Frontend")),
                new LogEventProperty("Component", new ScalarValue("Catalog")),
                new LogEventProperty("RequestId", new ScalarValue("req-1")),
                new LogEventProperty("ErrorId", new ScalarValue("err-1"))
            ]);
        using var writer = new StringWriter();

        formatter.Format(logEvent, writer);
        using var document = JsonDocument.Parse(writer.ToString());
        var root = document.RootElement;

        Assert.Equal("Error", root.GetProperty("level").GetString());
        Assert.Equal("Frontend", root.GetProperty("category").GetString());
        Assert.Equal("Catalog", root.GetProperty("component").GetString());
        Assert.Equal("req-1", root.GetProperty("requestId").GetString());
        Assert.Equal("err-1", root.GetProperty("errorId").GetString());
        Assert.DoesNotContain("plain-secret", writer.ToString());
        Assert.DoesNotContain("property-secret", writer.ToString());
        Assert.DoesNotContain("abc.def.ghi", writer.ToString());
        Assert.DoesNotContain("exception-secret", writer.ToString());
        Assert.Contains("[REDACTED]", writer.ToString());
    }

    /// <summary>
    /// Verifica la mascheratura dei principali formati sensibili accettabili nel contesto diagnostico.
    /// </summary>
    [Theory]
    [InlineData("Authorization: Bearer abc.def.ghi", "abc.def.ghi")]
    [InlineData("{\"password\":\"super-secret\"}", "super-secret")]
    [InlineData("Server=db;User Id=admin;Password=db-secret;", "db-secret")]
    [InlineData("api_key=my-key", "my-key")]
    public void Sanitizer_MasksSensitiveFormats(string input, string forbiddenValue)
    {
        var sanitized = new SensitiveDataSanitizer().Sanitize(input);

        Assert.DoesNotContain(forbiddenValue, sanitized);
        Assert.Contains("[REDACTED]", sanitized);
    }

    /// <summary>
    /// Verifica che il sink asincrono ritorni senza attendere il target lento.
    /// </summary>
    [Fact]
    public void BoundedAsyncSink_DoesNotBlockProducer()
    {
        using var target = new SlowLogger();
        using var sink = new BoundedAsyncSink(target, capacity: 2);
        var logEvent = new LogEvent(
            DateTimeOffset.UtcNow,
            LogEventLevel.Information,
            exception: null,
            new Serilog.Parsing.MessageTemplateParser().Parse("event"),
            []);
        var watch = System.Diagnostics.Stopwatch.StartNew();

        for (var index = 0; index < 100; index++)
        {
            sink.Emit(logEvent);
        }

        watch.Stop();
        Assert.True(watch.Elapsed < TimeSpan.FromMilliseconds(100));
    }

    /// <summary>
    /// Verifica che la soglia Information escluda Debug e produca JSON su file.
    /// </summary>
    [Fact]
    public void Configuration_UsesMinimumLevelAndWritesJsonFile()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Logging:LogLevel:Default"] = "Information",
            ["Logging:LogLevel:Microsoft.AspNetCore"] = "Warning",
            ["Logging:FilePath"] = "log-.json",
            ["Logging:RetentionDays"] = "7",
            ["Logging:QueueCapacity"] = "32"
        }).Build();
        var loggerConfiguration = new LoggerConfiguration();
        ServerLoggingConfiguration.Configure(loggerConfiguration, configuration, directory);
        using (var logger = loggerConfiguration.CreateLogger())
        {
            logger.Debug("DEBUG-MARKER");
            logger.Information("INFO-MARKER");
        }

        var content = string.Join(Environment.NewLine, Directory.GetFiles(directory, "log-*.json").Select(File.ReadAllText));
        Assert.Contains("INFO-MARKER", content);
        Assert.DoesNotContain("DEBUG-MARKER", content);
        Assert.All(content.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries), line => JsonDocument.Parse(line).Dispose());
    }

    /// <summary>
    /// Verifica eliminazione oltre sette giorni e conservazione dei file recenti.
    /// </summary>
    [Fact]
    public void DeleteExpiredFiles_EnforcesSevenDayRetention()
    {
        var now = new DateTime(2026, 8, 21, 12, 0, 0, DateTimeKind.Utc);
        var expired = Path.Combine(directory, "log-20260810.json");
        var retained = Path.Combine(directory, "log-20260820.json");
        File.WriteAllText(expired, "{}");
        File.WriteAllText(retained, "{}");
        File.SetLastWriteTimeUtc(expired, now.AddDays(-8));
        File.SetLastWriteTimeUtc(retained, now.AddDays(-1));

        var deleted = ServerLoggingConfiguration.DeleteExpiredFiles(directory, 7, now);

        Assert.Equal(1, deleted);
        Assert.False(File.Exists(expired));
        Assert.True(File.Exists(retained));
    }

    /// <summary>
    /// Elimina i file temporanei della suite.
    /// </summary>
    public void Dispose()
    {
        if (Directory.Exists(directory))
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    /// <summary>
    /// Logger Serilog volutamente lento usato per verificare il disaccoppiamento.
    /// </summary>
    private sealed class SlowLogger : Serilog.ILogger, IDisposable
    {
        private readonly Serilog.ILogger inner = new LoggerConfiguration().CreateLogger();

        /// <inheritdoc />
        public void Write(LogEvent logEvent)
        {
            Thread.Sleep(200);
            inner.Write(logEvent);
        }

        /// <inheritdoc />
        public bool IsEnabled(LogEventLevel level) => inner.IsEnabled(level);

        /// <inheritdoc />
        public Serilog.ILogger ForContext(Serilog.Core.ILogEventEnricher enricher) => this;

        /// <inheritdoc />
        public Serilog.ILogger ForContext(IEnumerable<Serilog.Core.ILogEventEnricher> enrichers) => this;

        /// <inheritdoc />
        public Serilog.ILogger ForContext(string propertyName, object? value, bool destructureObjects = false) => this;

        /// <inheritdoc />
        public Serilog.ILogger ForContext<TSource>() => this;

        /// <inheritdoc />
        public Serilog.ILogger ForContext(Type source) => this;

        /// <inheritdoc />
        public void Dispose() => (inner as IDisposable)?.Dispose();
    }
}
