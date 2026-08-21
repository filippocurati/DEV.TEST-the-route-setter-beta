using TheRouteSetter.Api.Services.Assets;

namespace TheRouteSetter.Api.Services.ConvexHull;

/// <summary>
/// Verifica e genera i collider dopo l'avvio, senza ritardare la disponibilita HTTP.
/// </summary>
public sealed class ColliderGenerationWorker : BackgroundService
{
    private readonly IAssetCatalogService assets;
    private readonly IColliderJobStore jobs;
    private readonly IColliderProcessor processor;
    private readonly ILogger<ColliderGenerationWorker> logger;

    /// <summary>
    /// Inizializza il worker con discovery, coda e processore collider.
    /// </summary>
    public ColliderGenerationWorker(
        IAssetCatalogService assets,
        IColliderJobStore jobs,
        IColliderProcessor processor,
        ILogger<ColliderGenerationWorker> logger)
    {
        this.assets = assets;
        this.jobs = jobs;
        this.processor = processor;
        this.logger = logger;
    }

    /// <summary>
    /// Esegue la scansione leggera iniziale e avvia il calcolo senza attenderne il completamento.
    /// </summary>
    public override Task StartAsync(CancellationToken cancellationToken)
    {
        foreach (var model in assets.GetHoldModels())
        {
            jobs.SetPending(model.Id, model.ModelPath);
        }

        return base.StartAsync(cancellationToken);
    }

    /// <summary>
    /// Cede immediatamente il controllo all'host, quindi elabora in sequenza il backlog accodato.
    /// </summary>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();

        while (!stoppingToken.IsCancellationRequested && jobs.TryDequeue(out var job))
        {
            try
            {
                await processor.ProcessAsync(job!.HoldId, job.ModelPath, stoppingToken);
                jobs.SetStatus(job.HoldId, ColliderProcessingStatus.Ready);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                jobs.SetStatus(job!.HoldId, ColliderProcessingStatus.Failed);
                logger.LogError(exception, "Generazione collider non riuscita per {HoldId}", job.HoldId);
            }
        }
    }
}
