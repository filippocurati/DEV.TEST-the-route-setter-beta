using TheRouteSetter.Backend.Services.Catalog;

namespace TheRouteSetter.Backend.Services.ConvexHull;

/// <summary>
/// Worker in background che genera i collider Convex Hull per le prese che ne sono sprovviste.
/// L'esecuzione è asincrona e non bloccante per l'avvio del backend.
/// </summary>
public class BackgroundColliderWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackgroundColliderWorker> _logger;

    /// <summary>
    /// Inizializza il worker di generazione collider.
    /// </summary>
    public BackgroundColliderWorker(IServiceProvider serviceProvider, ILogger<BackgroundColliderWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    /// <summary>
    /// Esegue la scansione delle prese e genera i collider mancanti in background.
    /// </summary>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("BackgroundColliderWorker avviato.");

        await Task.Delay(2000, stoppingToken);

        using var scope = _serviceProvider.CreateScope();
        var discovery = scope.ServiceProvider.GetRequiredService<HoldDiscoveryService>();
        var generator = scope.ServiceProvider.GetRequiredService<ConvexHullGeneratorService>();
        var holdsRoot = discovery.GetHoldsRootPath();

        if (holdsRoot == null || !Directory.Exists(holdsRoot))
        {
            _logger.LogWarning("Directory holds non trovata: {Path}", holdsRoot);
            return;
        }

        foreach (var holdDir in Directory.GetDirectories(holdsRoot))
        {
            if (stoppingToken.IsCancellationRequested) break;

            var dirName = Path.GetFileName(holdDir);
            if (!System.Text.RegularExpressions.Regex.IsMatch(dirName, @"^Hold\d+$")) continue;

            var glbFile = Directory.GetFiles(holdDir, "*.glb").FirstOrDefault();
            if (glbFile == null) continue;

            var colliderFile = Path.Combine(holdDir, "collider.json");

            if (File.Exists(colliderFile))
            {
                _logger.LogDebug("Collider già presente per {HoldId}, salto.", dirName);
                continue;
            }

            _logger.LogInformation("Generazione collider per {HoldId}...", dirName);
            generator.GenerateOrGetCollider(holdDir, glbFile);
        }

        _logger.LogInformation("BackgroundColliderWorker completato.");
    }
}