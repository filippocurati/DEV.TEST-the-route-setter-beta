using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using TheRouteSetter.Api.Services.ConvexHull;

namespace TheRouteSetter.Api.Tests.Support;

/// <summary>
/// Crea una gerarchia asset temporanea e deterministica per i test.
/// </summary>
public sealed class AssetTestData : IDisposable
{
    /// <summary>
    /// Inizializza parete, prese valide e cartelle da ignorare.
    /// </summary>
    public AssetTestData()
    {
        RootPath = Path.Combine(Path.GetTempPath(), $"route-setter-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(RootPath, "main-wall"));
        Directory.CreateDirectory(Path.Combine(RootPath, "holds", "Hold1"));
        Directory.CreateDirectory(Path.Combine(RootPath, "holds", "Hold2"));
        Directory.CreateDirectory(Path.Combine(RootPath, "holds", "Hold3"));
        Directory.CreateDirectory(Path.Combine(RootPath, "holds", "hold4"));

        File.WriteAllBytes(Path.Combine(RootPath, "main-wall", "wall.glb"), "WALL-BYTES"u8.ToArray());
        File.WriteAllBytes(Path.Combine(RootPath, "holds", "Hold1", "hold1.glb"), "MODEL-ONE"u8.ToArray());
        File.WriteAllBytes(Path.Combine(RootPath, "holds", "Hold1", "PREV_hold1.png"), "PREVIEW"u8.ToArray());
        File.WriteAllText(Path.Combine(RootPath, "holds", "Hold1", "collider.json"), "{\"vertices\":[]}");
        File.WriteAllText(Path.Combine(RootPath, "holds", "Hold1", "material.bin"), "OPTIONAL");
        File.WriteAllBytes(Path.Combine(RootPath, "holds", "Hold2", "hold2.glb"), "MODEL-TWO"u8.ToArray());
        File.WriteAllText(Path.Combine(RootPath, "holds", "Hold3", "readme.txt"), "No model");
        File.WriteAllBytes(Path.Combine(RootPath, "holds", "hold4", "hold4.glb"), "INVALID-NAME"u8.ToArray());
    }

    /// <summary>
    /// Percorso assoluto della gerarchia temporanea.
    /// </summary>
    public string RootPath { get; }

    /// <summary>
    /// Elimina tutti i file temporanei creati dal test.
    /// </summary>
    public void Dispose()
    {
        if (Directory.Exists(RootPath))
        {
            Directory.Delete(RootPath, recursive: true);
        }
    }
}

/// <summary>
/// Ospita l'API puntandola alla gerarchia asset temporanea.
/// </summary>
public sealed class AssetApiFactory : WebApplicationFactory<Program>
{
    private readonly string rootPath;

    /// <summary>
    /// Inizializza la factory con la radice asset del test.
    /// </summary>
    public AssetApiFactory(string rootPath)
    {
        this.rootPath = rootPath;
    }

    /// <summary>
    /// Sostituisce la configurazione asset prima dell'avvio dell'host.
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
            services.RemoveAll<IHostedService>();
            services.RemoveAll<IColliderJobStore>();
            services.RemoveAll<IColliderProcessor>();
            services.AddSingleton<IColliderJobStore, TestColliderJobStore>();
            services.AddSingleton<IColliderProcessor, NoOpColliderProcessor>();
        });
    }
}

/// <summary>
/// Mantiene lo stato collider dei test senza dipendere dal contenuto dei file temporanei.
/// </summary>
public sealed class TestColliderJobStore : IColliderJobStore
{
    private readonly Dictionary<string, ColliderProcessingStatus> statuses = new(StringComparer.Ordinal);

    /// <inheritdoc />
    public ColliderProcessingStatus GetStatus(string holdId, bool colliderFileExists)
    {
        return statuses.TryGetValue(holdId, out var status)
            ? status
            : colliderFileExists ? ColliderProcessingStatus.Ready : ColliderProcessingStatus.Missing;
    }

    /// <inheritdoc />
    public void SetStatus(string holdId, ColliderProcessingStatus status)
    {
        statuses[holdId] = status;
    }

    /// <inheritdoc />
    public void SetPending(string holdId, string modelPath)
    {
        statuses[holdId] = ColliderProcessingStatus.Pending;
    }

    /// <inheritdoc />
    public bool TryDequeue(out ColliderJob? job)
    {
        job = null;
        return false;
    }
}

/// <summary>
/// Evita la generazione reale dei collider nei test API dedicati alla fase di discovery.
/// </summary>
public sealed class NoOpColliderProcessor : IColliderProcessor
{
    /// <inheritdoc />
    public Task<ColliderProcessingResult> ProcessAsync(string holdId, string modelPath, CancellationToken cancellationToken)
    {
        return Task.FromResult(ColliderProcessingResult.Reused);
    }
}

/// <summary>
/// Fornisce il content root minimo richiesto dal servizio file system nei test unitari.
/// </summary>
public sealed class TestWebHostEnvironment : IWebHostEnvironment
{
    /// <inheritdoc />
    public string ApplicationName { get; set; } = "TheRouteSetter.Api.Tests";

    /// <inheritdoc />
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();

    /// <inheritdoc />
    public string WebRootPath { get; set; } = string.Empty;

    /// <inheritdoc />
    public string EnvironmentName { get; set; } = "Test";

    /// <inheritdoc />
    public string ContentRootPath { get; set; } = string.Empty;

    /// <inheritdoc />
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
