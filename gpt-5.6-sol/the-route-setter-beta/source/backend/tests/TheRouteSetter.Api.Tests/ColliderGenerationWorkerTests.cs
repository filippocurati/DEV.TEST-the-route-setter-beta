using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;
using TheRouteSetter.Api.Models;
using TheRouteSetter.Api.Services.Assets;
using TheRouteSetter.Api.Services.ConvexHull;
using TheRouteSetter.Api.Tests.Support;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica che il backlog collider non ritardi la disponibilita dell'host.
/// </summary>
public sealed class ColliderGenerationWorkerTests
{
    /// <summary>
    /// Verifica che StartAsync termini mentre il processore collider rimane intenzionalmente sospeso.
    /// </summary>
    [Fact]
    public async Task StartAsync_DoesNotWaitForColliderProcessing()
    {
        var jobs = new ColliderJobStore();
        var processor = new BlockingColliderProcessor();
        var worker = new ColliderGenerationWorker(
            new SingleModelCatalog(),
            jobs,
            processor,
            NullLogger<ColliderGenerationWorker>.Instance);

        await worker.StartAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(1));
        await processor.Started.Task.WaitAsync(TimeSpan.FromSeconds(1));

        Assert.Equal(ColliderProcessingStatus.Pending, jobs.GetStatus("Hold1", colliderFileExists: false));
        processor.Release.TrySetResult();
        await WaitForStatusAsync(jobs, ColliderProcessingStatus.Ready);
        await worker.StopAsync(CancellationToken.None);
    }

    /// <summary>
    /// Verifica via HTTP che l'API risponda mentre il backlog collider resta sospeso.
    /// </summary>
    [Fact]
    public async Task ApiHost_IsAvailableWhileColliderBacklogIsProcessing()
    {
        using var data = new AssetTestData();
        var processor = new BlockingColliderProcessor();
        await using var factory = new BacklogApiFactory(data.RootPath, processor);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/system/health").WaitAsync(TimeSpan.FromSeconds(2));
        var holds = await client.GetFromJsonAsync<HoldManifest[]>("/api/holds");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(holds);
        Assert.All(holds, hold => Assert.Equal(ColliderAvailability.Pending, hold.ColliderStatus));
        processor.Release.TrySetResult();
    }

    /// <summary>
    /// Attende in modo limitato il completamento del singolo lavoro in background.
    /// </summary>
    private static async Task WaitForStatusAsync(IColliderJobStore jobs, ColliderProcessingStatus expected)
    {
        for (var attempt = 0; attempt < 100; attempt++)
        {
            if (jobs.GetStatus("Hold1", colliderFileExists: false) == expected)
            {
                return;
            }

            await Task.Delay(10);
        }

        Assert.Fail($"Stato collider {expected} non raggiunto entro il timeout.");
    }

    /// <summary>
    /// Simula un catalogo con un singolo modello valido.
    /// </summary>
    private sealed class SingleModelCatalog : IAssetCatalogService
    {
        /// <inheritdoc />
        public AssetFile? GetWall() => null;

        /// <inheritdoc />
        public IReadOnlyList<HoldManifest> GetHolds() => [];

        /// <inheritdoc />
        public IReadOnlyList<HoldModelAsset> GetHoldModels() => [new("Hold1", "hold1.glb")];

        /// <inheritdoc />
        public AssetFile? GetHoldModel(string id) => null;

        /// <inheritdoc />
        public AssetFile? GetHoldPreview(string id) => null;

        /// <inheritdoc />
        public AssetFile? GetHoldCollider(string id) => null;

        /// <inheritdoc />
        public AssetFile? GetHoldOptionalAsset(string id, string fileName) => null;
    }

    /// <summary>
    /// Mantiene il processore sospeso per dimostrare che l'avvio non ne attende il completamento.
    /// </summary>
    private sealed class BlockingColliderProcessor : IColliderProcessor
    {
        /// <summary>
        /// Segnala l'ingresso nel processore.
        /// </summary>
        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        /// <summary>
        /// Consente al test di completare il lavoro sospeso.
        /// </summary>
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        /// <inheritdoc />
        public async Task<ColliderProcessingResult> ProcessAsync(
            string holdId,
            string modelPath,
            CancellationToken cancellationToken)
        {
            Started.TrySetResult();
            await Release.Task.WaitAsync(cancellationToken);
            return ColliderProcessingResult.Generated;
        }
    }

    /// <summary>
    /// Avvia l'applicazione reale sostituendo solo il processore con una versione sospesa.
    /// </summary>
    private sealed class BacklogApiFactory : WebApplicationFactory<Program>
    {
        private readonly string rootPath;
        private readonly BlockingColliderProcessor processor;

        /// <summary>
        /// Inizializza la factory con asset temporanei e processore controllato dal test.
        /// </summary>
        public BacklogApiFactory(string rootPath, BlockingColliderProcessor processor)
        {
            this.rootPath = rootPath;
            this.processor = processor;
        }

        /// <summary>
        /// Configura la radice asset e mantiene attivo il worker di produzione.
        /// </summary>
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AssetStorage:RootPath"] = rootPath,
                    ["AssetStorage:MainWallDirectory"] = "main-wall",
                    ["AssetStorage:HoldsDirectory"] = "holds"
                });
            });
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IColliderProcessor>();
                services.AddSingleton<IColliderProcessor>(processor);
            });
        }
    }
}
