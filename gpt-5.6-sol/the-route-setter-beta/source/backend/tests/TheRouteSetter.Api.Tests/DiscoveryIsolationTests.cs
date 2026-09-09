using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TheRouteSetter.Api.Models;
using TheRouteSetter.Api.Services.Assets;
using TheRouteSetter.Api.Services.ConvexHull;
using TheRouteSetter.Api.Tests.Support;
using Xunit;

namespace TheRouteSetter.Api.Tests;

public sealed class DiscoveryIsolationTests
{
    [Fact]
    public void Discovery_SkipsOverflowAndOrdersNumericallyWithoutGlbReads()
    {
        using var data = new AssetTestData();
        foreach (var id in new[] { "Hold2147483648", "Hold9999999999999999999999999999999", "Hold2147483647", "Hold10", "Hold02" })
        {
            var directory = Path.Combine(data.RootPath, "holds", id);
            Directory.CreateDirectory(directory);
            File.WriteAllText(Path.Combine(directory, "model.glb"), "not a GLB, must not be read");
        }
        var service = Create(data, new AssetDirectoryReader(), new CapturingLogger());
        var expected = new[] { "Hold1", "Hold02", "Hold2", "Hold10", "Hold2147483647" };
        Assert.Equal(expected, service.GetHolds().Select(item => item.Id));
        Assert.Equal(expected, service.GetHoldModels().Select(item => item.Id));
        Assert.Equal(expected, service.GetHoldStatuses().Select(item => item.Id));
        Assert.Null(service.GetHoldModel("Hold2147483648"));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Discovery_IsolatesSingleDirectoryIoFailureAndLogsErrorId(bool unauthorized)
    {
        using var data = new AssetTestData();
        var logger = new CapturingLogger();
        var service = Create(data, new FailingDirectoryReader(unauthorized), logger);
        Assert.Equal("Hold2", Assert.Single(service.GetHolds()).Id);
        Assert.Equal("Hold2", Assert.Single(service.GetHoldModels()).Id);
        Assert.Equal("Hold2", Assert.Single(service.GetHoldStatuses()).Id);
        Assert.Equal(3, logger.ErrorIds.Count);
        Assert.All(logger.ErrorIds, id => Assert.True(Guid.TryParse(id, out _)));
        Assert.Equal(3, logger.ErrorIds.Distinct().Count());
    }

    [Fact]
    public async Task Worker_FailureIsTerminalCorrelatedAndDoesNotStopNextHold()
    {
        using var data = new AssetTestData();
        var jobs = new ColliderJobStore();
        var logger = new WorkerLogger();
        using var worker = new ColliderGenerationWorker(Create(data, new AssetDirectoryReader(), new CapturingLogger()),
            jobs, new FailingProcessor(), logger);
        await worker.StartAsync(CancellationToken.None);
        await worker.ExecuteTask!.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(ColliderProcessingStatus.Failed, jobs.GetStatus("Hold1", true));
        Assert.Equal(ColliderProcessingStatus.Ready, jobs.GetStatus("Hold2", false));
        Assert.True(Guid.TryParse(logger.ErrorId, out _));
        await worker.StopAsync(CancellationToken.None);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task StartupDiscoveryFailure_RemainsTerminalWhenDirectoryBecomesReadable(bool colliderExists)
    {
        using var data = new AssetTestData();
        if (!colliderExists) File.Delete(Path.Combine(data.RootPath, "holds", "Hold1", "collider.json"));
        var reader = new RecoveringDirectoryReader();
        await using var factory = new RecoveringDiscoveryFactory(data.RootPath, reader);
        using var client = factory.CreateClient();
        var initial = await client.GetFromJsonAsync<HoldStatus[]>("/api/holds/status");
        Assert.Equal("Hold2", Assert.Single(initial!).Id);

        reader.Fail = false;
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var statuses = await client.GetFromJsonAsync<HoldStatus[]>("/api/holds/status");
            var recovered = Assert.Single(statuses!, item => item.Id == "Hold1");
            Assert.Equal(ColliderAvailability.Failed, recovered.ColliderStatus);
            Assert.Null(recovered.ColliderUrl);
            var manifest = await client.GetFromJsonAsync<HoldManifest[]>("/api/holds");
            Assert.Equal(ColliderAvailability.Failed, manifest![0].ColliderStatus);
        }
        var jobs = factory.Services.GetRequiredService<IColliderJobStore>();
        Assert.NotEqual(ColliderProcessingStatus.Failed, jobs.GetStatus("Hold2", false));
        Assert.False(jobs.TryDequeue(out _));
    }

    [Theory]
    [InlineData(ColliderProcessingStatus.Missing)]
    [InlineData(ColliderProcessingStatus.Pending)]
    [InlineData(ColliderProcessingStatus.Ready)]
    [InlineData(ColliderProcessingStatus.Failed)]
    public void CompletingDiscovery_OnlyChangesUnknownIds(ColliderProcessingStatus knownStatus)
    {
        var jobs = new ColliderJobStore();
        Assert.Equal(ColliderProcessingStatus.Missing, jobs.GetStatus("unknown", false));
        Assert.Equal(ColliderProcessingStatus.Ready, jobs.GetStatus("unknown", true));
        jobs.SetStatus("known", knownStatus);
        jobs.SetPending("queued", "temporary-model.glb");

        jobs.CompleteInitialDiscovery();
        jobs.CompleteInitialDiscovery();
        Assert.Equal(ColliderProcessingStatus.Failed, jobs.GetStatus("unknown", false));
        Assert.Equal(ColliderProcessingStatus.Failed, jobs.GetStatus("unknown", true));
        Assert.Equal(knownStatus, jobs.GetStatus("known", false));
        Assert.Equal(ColliderProcessingStatus.Pending, jobs.GetStatus("queued", false));
        Assert.True(jobs.TryDequeue(out var job));
        Assert.Equal("queued", job!.HoldId);
    }

    private sealed class RecoveringDirectoryReader : AssetDirectoryReader
    {
        public volatile bool Fail = true;
        public override string[] GetFiles(string path) => Fail && Path.GetFileName(path) == "Hold1"
            ? throw new IOException("Errore I/O simulato durante la discovery iniziale.")
            : base.GetFiles(path);
    }

    private sealed class RecoveringDiscoveryFactory(string root, AssetDirectoryReader reader) : IsolatedApiFactory(root)
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<AssetDirectoryReader>();
                services.AddSingleton(reader);
                services.RemoveAll<IColliderProcessor>();
                services.AddSingleton<IColliderProcessor, NoOpColliderProcessor>();
            });
        }
    }

    private static FileSystemAssetCatalogService Create(AssetTestData data, AssetDirectoryReader reader, CapturingLogger logger) =>
        new(Options.Create(new AssetStorageOptions { RootPath = data.RootPath }),
            new TestWebHostEnvironment { ContentRootPath = data.RootPath }, new ColliderJobStore(), logger, reader);

    private sealed class FailingDirectoryReader(bool unauthorized) : AssetDirectoryReader
    {
        public override string[] GetFiles(string path)
        {
            if (Path.GetFileName(path) == "Hold1")
            {
                if (unauthorized) throw new UnauthorizedAccessException("injected failure");
                throw new IOException("injected failure");
            }
            return base.GetFiles(path);
        }
    }

    private sealed class CapturingLogger : ILogger<FileSystemAssetCatalogService>
    {
        public List<string> ErrorIds { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            Assert.Equal(LogLevel.Error, level);
            Assert.NotNull(exception);
            var values = Assert.IsAssignableFrom<IEnumerable<KeyValuePair<string, object?>>>(state);
            ErrorIds.Add((string)values.Single(item => item.Key == "ErrorId").Value!);
        }
    }

    private sealed class WorkerLogger : ILogger<ColliderGenerationWorker>
    {
        public string? ErrorId { get; private set; }
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var values = Assert.IsAssignableFrom<IEnumerable<KeyValuePair<string, object?>>>(state);
            ErrorId = (string)values.Single(item => item.Key == "ErrorId").Value!;
        }
    }

    private sealed class FailingProcessor : IColliderProcessor
    {
        public Task<ColliderProcessingResult> ProcessAsync(string holdId, string modelPath, CancellationToken cancellationToken) =>
            holdId == "Hold1" ? throw new IOException("injected failure") : Task.FromResult(ColliderProcessingResult.Generated);
    }
}
