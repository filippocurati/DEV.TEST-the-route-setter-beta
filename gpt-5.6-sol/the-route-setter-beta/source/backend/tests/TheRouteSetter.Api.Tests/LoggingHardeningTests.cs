using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Serilog;
using Serilog.Events;
using Serilog.Parsing;
using TheRouteSetter.Api.Services.Logging;
using Xunit;

namespace TheRouteSetter.Api.Tests;

public sealed class LoggingHardeningTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), $"log-hardening-{Guid.NewGuid():N}");

    public LoggingHardeningTests() => Directory.CreateDirectory(directory);

    [Theory]
    [InlineData("Trace", 6)]
    [InlineData("Debug", 5)]
    [InlineData("Information", 4)]
    [InlineData("Warning", 3)]
    [InlineData("Error", 2)]
    [InlineData("Critical", 1)]
    [InlineData("None", 0)]
    public void Configuration_MapsEveryDotNetLevel(string minimum, int expectedCount)
    {
        using (var logger = CreateLogger(new() { ["Logging:LogLevel:Default"] = minimum }))
        {
            foreach (var level in Enum.GetValues<LogEventLevel>()) logger.Write(level, "MARKER-{Level}", level);
        }
        var events = ReadEvents();
        try
        {
            Assert.Equal(expectedCount, events.Length);
            Assert.DoesNotContain(events, item => item.RootElement.GetProperty("level").GetString() is "Verbose" or "Fatal");
        }
        finally { foreach (var item in events) item.Dispose(); }
    }

    [Fact]
    public void Configuration_UsesLongestArbitraryCategoryOverrideIncludingNone()
    {
        using (var logger = CreateLogger(new()
        {
            ["Logging:LogLevel:Default"] = "None",
            ["Logging:LogLevel:Custom"] = "Trace",
            ["Logging:LogLevel:Custom.Noisy"] = "None",
            ["Logging:LogLevel:Custom.Noisy.FatalOnly"] = "Critical"
        }))
        {
            logger.ForContext("SourceContext", "Other").Fatal("DROP-DEFAULT");
            logger.ForContext("SourceContext", "Custom.Component").Verbose("KEEP-TRACE");
            logger.ForContext("SourceContext", "Custom.Noisy").Fatal("DROP-NONE");
            logger.ForContext("SourceContext", "Custom.Noisy.FatalOnly").Error("DROP-ERROR");
            logger.ForContext("SourceContext", "Custom.Noisy.FatalOnly").Fatal("KEEP-CRITICAL");
            logger.ForContext("Category", "Custom.Browser").Debug("KEEP-BROWSER");
        }
        var content = string.Join("\n", Directory.GetFiles(directory).Select(File.ReadAllText));
        Assert.DoesNotContain("DROP-", content);
        Assert.Contains("KEEP-TRACE", content);
        Assert.Contains("KEEP-CRITICAL", content);
        Assert.Contains("KEEP-BROWSER", content);
    }

    [Theory]
    [InlineData("Authorization: Basic dXNlcjpwYXNz", "dXNlcjpwYXNz")]
    [InlineData("Bearer a.b.c", "a.b.c")]
    [InlineData("password=\"a password with spaces\" next=ok", "password with spaces")]
    [InlineData("pwd='another private phrase';", "private phrase")]
    [InlineData("Context.api-key=private-key", "private-key")]
    [InlineData("Cookie=session-private;", "session-private")]
    [InlineData("person@example.invalid", "person@example.invalid")]
    [InlineData("https://example.invalid/path?unknown=personal-value", "personal-value")]
    [InlineData("phone=+39 123 456 789", "123 456")]
    public void Sanitizer_RedactsAdversarialSyntheticData(string input, string forbidden)
    {
        var sanitized = new SensitiveDataSanitizer().Sanitize(input);
        Assert.DoesNotContain(forbidden, sanitized);
        Assert.Contains("[REDACTED]", sanitized);
    }

    [Fact]
    public void Formatter_SanitizesNestedKeysBeforeInterpolatingProperties()
    {
        var value = new StructureValue([
            new LogEventProperty("Context.pwd", new ScalarValue("secret phrase one")),
            new LogEventProperty("Nested", new SequenceValue([
                new DictionaryValue([new(new ScalarValue("prefix.api-key"), new ScalarValue("secret phrase two"))]),
                new StructureValue([new LogEventProperty("Authorization", new ScalarValue("Basic secret-three"))])
            ]))
        ]);
        var logEvent = new LogEvent(DateTimeOffset.UtcNow, LogEventLevel.Error, new Exception("password=\"exception secret phrase\""),
            new MessageTemplateParser().Parse("Unlabelled {Password} nested {@Payload} auth {ContextAuthorization}"),
            [new("Password", new ScalarValue("secret zero")), new("Payload", value), new("ContextAuthorization", new ScalarValue("secret four"))]);
        using var writer = new StringWriter();
        new SafeJsonLogFormatter(new SensitiveDataSanitizer()).Format(logEvent, writer);
        using var document = JsonDocument.Parse(writer.ToString());
        Assert.DoesNotContain("secret", document.RootElement.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("[REDACTED]", writer.ToString());
    }

    [Fact]
    public void Retention_UsesExactAgeCustomPatternAndSweepsAgainAfterMidnight()
    {
        var beforeMidnight = new DateTime(2026, 9, 8, 23, 59, 0, DateTimeKind.Utc);
        var expired = WriteFile("custom.audit-20260901.json", beforeMidnight.AddDays(-7).AddSeconds(-1));
        var expiresAtRollover = WriteFile("custom.audit-20260901_001.json", beforeMidnight.AddDays(-7).AddSeconds(30));
        var recent = WriteFile("custom.audit-20260908.json", beforeMidnight);
        var unrelated = WriteFile("log-20260801.json", beforeMidnight.AddDays(-30));
        var notRolling = WriteFile("custom.audit-backup.json", beforeMidnight.AddDays(-30));
        var retention = new LogFileRetention(Path.Combine(directory, "custom.audit-.json"), 7);
        Assert.Equal(1, retention.SweepIfDue(beforeMidnight));
        Assert.False(File.Exists(expired));
        Assert.True(File.Exists(expiresAtRollover));
        Assert.Equal(1, retention.SweepIfDue(beforeMidnight.AddMinutes(2)));
        Assert.False(File.Exists(expiresAtRollover));
        Assert.True(File.Exists(recent));
        Assert.True(File.Exists(unrelated));
        Assert.True(File.Exists(notRolling));
    }

    [Fact]
    public void AsyncConfiguration_ActuallyRunsRetentionForConfiguredPattern()
    {
        var expired = WriteFile("custom.audit-20000101.json", DateTime.UtcNow.AddDays(-30));
        using (var logger = CreateLogger(new() { ["Logging:FilePath"] = "custom.audit-.json" })) logger.Information("event");
        Assert.False(File.Exists(expired));
        Assert.Single(Directory.GetFiles(directory, "custom.audit-*.json"));
    }

    [Fact]
    public async Task BoundedSink_DropsExcessDrainsAcceptedEventsAndRunsMaintenanceOffProducer()
    {
        using var started = new ManualResetEventSlim();
        using var release = new ManualResetEventSlim();
        var targetSink = new BlockingSink(started, release);
        var target = new LoggerConfiguration().WriteTo.Sink(targetSink).CreateLogger();
        var callerThread = Environment.CurrentManagedThreadId;
        var maintenanceThread = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        var sink = new BoundedAsyncSink(target, 2, () => maintenanceThread.TrySetResult(Environment.CurrentManagedThreadId));
        try
        {
            var logEvent = new LogEvent(DateTimeOffset.UtcNow, LogEventLevel.Information, null, new MessageTemplateParser().Parse("event"), []);
            sink.Emit(logEvent);
            Assert.True(started.Wait(TimeSpan.FromSeconds(5)));
            for (var index = 0; index < 10000; index++) sink.Emit(logEvent);
            Assert.Equal(1, targetSink.Count);
            Assert.NotEqual(callerThread, await maintenanceThread.Task.WaitAsync(TimeSpan.FromSeconds(5)));
            release.Set();
            await Task.Run(sink.Dispose).WaitAsync(TimeSpan.FromSeconds(5));
            Assert.Equal(3, targetSink.Count);
        }
        finally { release.Set(); sink.Dispose(); }
    }

    private sealed class BlockingSink(ManualResetEventSlim started, ManualResetEventSlim release) : Serilog.Core.ILogEventSink
    {
        private int count;
        public int Count => Volatile.Read(ref count);
        public void Emit(LogEvent logEvent)
        {
            Interlocked.Increment(ref count);
            started.Set();
            release.Wait(TimeSpan.FromSeconds(10));
        }
    }

    private Serilog.Core.Logger CreateLogger(Dictionary<string, string?> settings)
    {
        settings.TryAdd("Logging:FilePath", "log-.json");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var logger = new LoggerConfiguration();
        ServerLoggingConfiguration.Configure(logger, configuration, directory);
        return logger.CreateLogger();
    }

    private string WriteFile(string name, DateTime lastWrite)
    {
        var path = Path.Combine(directory, name);
        File.WriteAllText(path, "{}");
        File.SetLastWriteTimeUtc(path, lastWrite);
        return path;
    }

    private JsonDocument[] ReadEvents() => Directory.GetFiles(directory).SelectMany(File.ReadAllLines).Select(line => JsonDocument.Parse(line)).ToArray();

    public void Dispose() => Directory.Delete(directory, true);
}
