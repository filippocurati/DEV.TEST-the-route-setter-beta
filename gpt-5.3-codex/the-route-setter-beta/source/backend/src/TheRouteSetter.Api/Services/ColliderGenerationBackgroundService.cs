using TheRouteSetter.Application.Assets;
using TheRouteSetter.Application.ConvexHull;

namespace TheRouteSetter.Api.Services;

public sealed class ColliderGenerationBackgroundService : BackgroundService
{
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(2);

    private readonly IAssetDiscoveryService assetDiscoveryService;
    private readonly IColliderGenerationService colliderGenerationService;
    private readonly ILogger<ColliderGenerationBackgroundService> logger;

    public ColliderGenerationBackgroundService(
        IAssetDiscoveryService assetDiscoveryService,
        IColliderGenerationService colliderGenerationService,
        ILogger<ColliderGenerationBackgroundService> logger)
    {
        this.assetDiscoveryService = assetDiscoveryService;
        this.colliderGenerationService = colliderGenerationService;
        this.logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                AssetCatalogSnapshot snapshot = await assetDiscoveryService.GetSnapshotAsync(stoppingToken);
                foreach (HoldAsset hold in snapshot.Holds.Where(static currentHold => !currentHold.IsColliderReady))
                {
                    ColliderGenerationResult result = await colliderGenerationService.EnsureColliderAsync(
                        hold.AbsoluteModelPath,
                        hold.AbsoluteColliderPath,
                        stoppingToken);

                    logger.LogInformation(
                        "Collider ensured for hold {HoldId}. Regenerated: {WasRegenerated}",
                        hold.Id,
                        result.WasRegenerated);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Errore durante la generazione asincrona dei collider");
            }

            await Task.Delay(IdleDelay, stoppingToken);
        }
    }
}
